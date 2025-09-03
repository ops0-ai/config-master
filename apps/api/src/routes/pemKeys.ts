import { Router } from 'express';
import { db } from '../index';
import { pemKeys, servers, serverGroups } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import { featureFlagMiddleware } from '../middleware/featureFlags';
import Joi from 'joi';
import crypto from 'crypto';
import { SecureKeyManager } from '../utils/keyManagement';

const router = Router();

const pemKeySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  privateKey: Joi.string().required(),
});

router.get('/', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const pemKeyList = await db
      .select({
        id: pemKeys.id,
        name: pemKeys.name,
        description: pemKeys.description,
        fingerprint: pemKeys.fingerprint,
        createdAt: pemKeys.createdAt,
        updatedAt: pemKeys.updatedAt,
      })
      .from(pemKeys)
      .where(eq(pemKeys.organizationId, req.user!.organizationId));

    res.json(pemKeyList);
  } catch (error) {
    console.error('Error fetching PEM keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const pemKey = await db
      .select({
        id: pemKeys.id,
        name: pemKeys.name,
        description: pemKeys.description,
        fingerprint: pemKeys.fingerprint,
        createdAt: pemKeys.createdAt,
        updatedAt: pemKeys.updatedAt,
      })
      .from(pemKeys)
      .where(
        and(
          eq(pemKeys.id, req.params.id),
          eq(pemKeys.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!pemKey[0]) {
      return res.status(404).json({ error: 'PEM key not found' });
    }

    res.json(pemKey[0]);
  } catch (error) {
    console.error('Error fetching PEM key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = pemKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (!value.privateKey.includes('BEGIN') || !value.privateKey.includes('PRIVATE KEY')) {
      return res.status(400).json({ error: 'Invalid private key format' });
    }

    const keyManager = SecureKeyManager.getInstance();
    const encryptionResult = keyManager.encryptPemKey(value.privateKey, req.user!.organizationId);
    
    const encryptedPrivateKey = encryptionResult.encryptedKey;
    const fingerprint = encryptionResult.fingerprint;

    const newPemKey = await db
      .insert(pemKeys)
      .values({
        name: value.name,
        description: value.description,
        encryptedPrivateKey,
        fingerprint,
        organizationId: req.user!.organizationId,
      })
      .returning({
        id: pemKeys.id,
        name: pemKeys.name,
        description: pemKeys.description,
        fingerprint: pemKeys.fingerprint,
        createdAt: pemKeys.createdAt,
      });

    res.status(201).json(newPemKey[0]);
  } catch (error) {
    console.error('Error creating PEM key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const updateSchema = Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().optional(),
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingPemKey = await db
      .select()
      .from(pemKeys)
      .where(
        and(
          eq(pemKeys.id, req.params.id),
          eq(pemKeys.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingPemKey[0]) {
      return res.status(404).json({ error: 'PEM key not found' });
    }

    const updatedPemKey = await db
      .update(pemKeys)
      .set({
        ...value,
        updatedAt: new Date(),
      })
      .where(eq(pemKeys.id, req.params.id))
      .returning({
        id: pemKeys.id,
        name: pemKeys.name,
        description: pemKeys.description,
        fingerprint: pemKeys.fingerprint,
        createdAt: pemKeys.createdAt,
        updatedAt: pemKeys.updatedAt,
      });

    res.json(updatedPemKey[0]);
  } catch (error) {
    console.error('Error updating PEM key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to fix/migrate existing PEM keys
router.post('/migrate/:id', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const pemKeyId = req.params.id;
    
    // Get the existing key
    const existingPemKey = await db
      .select()
      .from(pemKeys)
      .where(
        and(
          eq(pemKeys.id, pemKeyId),
          eq(pemKeys.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingPemKey[0]) {
      return res.status(404).json({ error: 'PEM key not found' });
    }

    const keyManager = SecureKeyManager.getInstance();
    
    try {
      // Try to decrypt the existing key
      console.log('🔄 Attempting to decrypt existing PEM key for migration...');
      const decryptedKey = keyManager.decryptPemKey(
        existingPemKey[0].encryptedPrivateKey, 
        req.user!.organizationId
      );
      
      if (!decryptedKey) {
        throw new Error('Failed to decrypt existing key');
      }
      
      // Re-encrypt with current encryption system
      console.log('🔒 Re-encrypting with current system...');
      const encryptionResult = keyManager.encryptPemKey(decryptedKey, req.user!.organizationId);
      
      // Update the key in database
      const updatedPemKey = await db
        .update(pemKeys)
        .set({
          encryptedPrivateKey: encryptionResult.encryptedKey,
          fingerprint: encryptionResult.fingerprint,
          updatedAt: new Date(),
        })
        .where(eq(pemKeys.id, pemKeyId))
        .returning({
          id: pemKeys.id,
          name: pemKeys.name,
          description: pemKeys.description,
          fingerprint: pemKeys.fingerprint,
          updatedAt: pemKeys.updatedAt,
        });

      console.log('✅ PEM key migration completed successfully');
      
      res.json({
        success: true,
        message: 'PEM key successfully migrated to current encryption system',
        key: updatedPemKey[0]
      });
      
    } catch (decryptError) {
      console.error('❌ Failed to migrate PEM key:', decryptError);
      
      res.status(400).json({
        error: 'Unable to migrate PEM key. The key may be corrupted or encrypted with an incompatible system.',
        details: decryptError instanceof Error ? decryptError.message : 'Unknown error',
        suggestion: 'Please delete this key and re-upload the original PEM file.'
      });
    }
    
  } catch (error) {
    console.error('Error in PEM key migration:', error);
    res.status(500).json({ error: 'Internal server error during migration' });
  }
});

// Endpoint to test PEM key functionality
router.post('/test/:id', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const pemKeyId = req.params.id;
    const keyManager = SecureKeyManager.getInstance();
    
    // Validate key integrity
    const validation = await keyManager.validateKeyIntegrity(pemKeyId, req.user!.organizationId);
    
    res.json({
      success: validation.isValid,
      fingerprint: validation.fingerprint,
      details: validation.details,
      canConnect: validation.isValid
    });
    
  } catch (error) {
    console.error('Error testing PEM key:', error);
    res.status(500).json({ 
      error: 'Internal server error during key test',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/:id', featureFlagMiddleware('pemKeys'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const existingPemKey = await db
      .select()
      .from(pemKeys)
      .where(
        and(
          eq(pemKeys.id, req.params.id),
          eq(pemKeys.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingPemKey[0]) {
      return res.status(404).json({ error: 'PEM key not found' });
    }

    // Check if the key is being used by servers or server groups
    const [serversUsingKey, groupsUsingKey] = await Promise.all([
      db.select({ id: servers.id }).from(servers).where(eq(servers.pemKeyId, req.params.id)),
      db.select({ id: serverGroups.id }).from(serverGroups).where(eq(serverGroups.defaultPemKeyId, req.params.id))
    ]);

    if (serversUsingKey.length > 0 || groupsUsingKey.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete PEM key. It is being used by ${serversUsingKey.length} server(s) and ${groupsUsingKey.length} server group(s). Please remove the key from those resources first.` 
      });
    }

    await db.delete(pemKeys).where(eq(pemKeys.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting PEM key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as pemKeyRoutes };