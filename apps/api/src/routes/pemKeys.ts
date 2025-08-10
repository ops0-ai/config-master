import { Router } from 'express';
import { db } from '../index';
import { pemKeys, servers, serverGroups } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import crypto from 'crypto';
import { SecureKeyManager } from '../utils/keyManagement';

const router = Router();

const pemKeySchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  privateKey: Joi.string().required(),
});

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.get('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.post('/', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.put('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.delete('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
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