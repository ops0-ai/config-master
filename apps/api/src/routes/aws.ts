import { Router, Response } from 'express';
import { db } from '../index';
import { awsIntegrations, awsInstances, servers } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import { featureFlagMiddleware } from '../middleware/featureFlags';
import { AWSService } from '../services/awsService';
import Joi from 'joi';
import crypto from 'crypto';

const router = Router();
const awsService = new AWSService();

// Generate consistent external ID based on organization ID
function generateExternalId(organizationId: string): string {
  const hash = crypto.createHash('sha256').update(`pulse-${organizationId}`).digest('hex');
  // Take first 32 characters to create a consistent UUID-like string
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

// Validation schemas
const createIntegrationSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  roleArn: Joi.string().required().pattern(/^arn:aws:iam::\d{12}:role\/[a-zA-Z0-9+=,.@_-]+$/),
  regions: Joi.array().items(Joi.string()).min(1).required(),
});

const testConnectionSchema = Joi.object({
  roleArn: Joi.string().required().pattern(/^arn:aws:iam::\d{12}:role\/[a-zA-Z0-9+=,.@_-]+$/),
  externalId: Joi.string().required(),
});

// Get all AWS integrations for the organization
router.get('/', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const integrations = await db
      .select()
      .from(awsIntegrations)
      .where(eq(awsIntegrations.organizationId, req.user!.organizationId))
      .orderBy(awsIntegrations.createdAt);

    res.json(integrations);
  } catch (error) {
    console.error('Error fetching AWS integrations:', error);
    res.status(500).json({ error: 'Failed to fetch AWS integrations' });
  }
});

// Get available AWS regions
router.get('/regions', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const regions = await awsService.getAvailableRegions();
    res.json(regions);
  } catch (error) {
    console.error('Error fetching AWS regions:', error);
    res.status(500).json({ error: 'Failed to fetch AWS regions' });
  }
});

// Get IAM policy requirements
router.get('/iam-policy', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const policy = AWSService.generateIAMPolicy();
    const externalId = generateExternalId(req.user!.organizationId);
    
    res.json({
      externalId,
      trustPolicy: policy.trustPolicy,
      permissionsPolicy: policy.permissionsPolicy,
      instructions: policy.instructions
    });
  } catch (error) {
    console.error('Error generating IAM policy:', error);
    res.status(500).json({ error: 'Failed to generate IAM policy' });
  }
});

// Test AWS connection
router.post('/test-connection', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { error, value } = testConnectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { roleArn, externalId } = value;
    
    const result = await awsService.testConnection(roleArn, externalId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'AWS connection successful',
        identity: result.identity
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing AWS connection:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to test AWS connection' 
    });
  }
});

// Create new AWS integration
router.post('/', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { error, value } = createIntegrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, roleArn, regions } = value;
    const externalId = generateExternalId(req.user!.organizationId);

    // Test connection first
    const connectionTest = await awsService.testConnection(roleArn, externalId);
    if (!connectionTest.success) {
      return res.status(400).json({
        error: 'AWS connection failed',
        details: connectionTest.error
      });
    }

    // Create integration
    const integration = await db
      .insert(awsIntegrations)
      .values({
        organizationId: req.user!.organizationId,
        name,
        roleArn,
        externalId,
        regions,
        isActive: true,
        syncStatus: 'pending',
      })
      .returning();

    if (!integration[0]) {
      return res.status(500).json({ error: 'Failed to create integration' });
    }

    // Start initial sync in the background
    setImmediate(async () => {
      try {
        await awsService.fetchInstances(
          integration[0].id,
          roleArn,
          externalId,
          regions
        );
        console.log('✅ Initial AWS sync completed for integration:', integration[0].id);
      } catch (syncError) {
        console.error('❌ Initial AWS sync failed:', syncError);
      }
    });

    res.status(201).json({
      ...integration[0],
      message: 'AWS integration created successfully. Initial sync started in background.'
    });
  } catch (error) {
    console.error('Error creating AWS integration:', error);
    res.status(500).json({ error: 'Failed to create AWS integration' });
  }
});

// Get AWS integration by ID
router.get('/:id', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const integration = await db
      .select()
      .from(awsIntegrations)
      .where(
        and(
          eq(awsIntegrations.id, req.params.id),
          eq(awsIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'AWS integration not found' });
    }

    res.json(integration[0]);
  } catch (error) {
    console.error('Error fetching AWS integration:', error);
    res.status(500).json({ error: 'Failed to fetch AWS integration' });
  }
});

// Update AWS integration
router.put('/:id', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const updateSchema = Joi.object({
      name: Joi.string().min(1).max(255).optional(),
      regions: Joi.array().items(Joi.string()).min(1).optional(),
      isActive: Joi.boolean().optional(),
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const integration = await db
      .update(awsIntegrations)
      .set({
        ...value,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(awsIntegrations.id, req.params.id),
          eq(awsIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .returning();

    if (!integration[0]) {
      return res.status(404).json({ error: 'AWS integration not found' });
    }

    res.json(integration[0]);
  } catch (error) {
    console.error('Error updating AWS integration:', error);
    res.status(500).json({ error: 'Failed to update AWS integration' });
  }
});

// Delete AWS integration
router.delete('/:id', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const integration = await db
      .select()
      .from(awsIntegrations)
      .where(
        and(
          eq(awsIntegrations.id, req.params.id),
          eq(awsIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'AWS integration not found' });
    }

    // Delete the integration (cascade will delete instances)
    await db
      .delete(awsIntegrations)
      .where(eq(awsIntegrations.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting AWS integration:', error);
    res.status(500).json({ error: 'Failed to delete AWS integration' });
  }
});

// Sync AWS instances
router.post('/:id/sync', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const integration = await db
      .select()
      .from(awsIntegrations)
      .where(
        and(
          eq(awsIntegrations.id, req.params.id),
          eq(awsIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'AWS integration not found' });
    }

    if (!integration[0].isActive) {
      return res.status(400).json({ error: 'AWS integration is not active' });
    }

    // Update status to syncing
    await db
      .update(awsIntegrations)
      .set({
        syncStatus: 'syncing',
        updatedAt: new Date(),
      })
      .where(eq(awsIntegrations.id, req.params.id));

    // Start sync
    const result = await awsService.fetchInstances(
      integration[0].id,
      integration[0].roleArn,
      integration[0].externalId,
      integration[0].regions
    );

    res.json({
      success: result.success,
      instanceCount: result.instanceCount,
      errors: result.errors,
      message: result.success 
        ? `Successfully synced ${result.instanceCount} instances`
        : `Sync completed with ${result.errors.length} errors`
    });
  } catch (error) {
    console.error('Error syncing AWS instances:', error);
    
    // Update status to error
    await db
      .update(awsIntegrations)
      .set({
        syncStatus: 'error',
        updatedAt: new Date(),
      })
      .where(eq(awsIntegrations.id, req.params.id));

    res.status(500).json({ error: 'Failed to sync AWS instances' });
  }
});

// Get AWS instances for an integration
router.get('/:id/instances', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { region, state } = req.query;
    
    // Verify integration ownership
    const integration = await db
      .select()
      .from(awsIntegrations)
      .where(
        and(
          eq(awsIntegrations.id, req.params.id),
          eq(awsIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'AWS integration not found' });
    }

    let whereClause = [eq(awsInstances.integrationId, req.params.id)];
    
    if (region) {
      whereClause.push(eq(awsInstances.region, region as string));
    }
    
    if (state) {
      whereClause.push(eq(awsInstances.state, state as string));
    }

    const instances = await db
      .select()
      .from(awsInstances)
      .where(and(...whereClause))
      .orderBy(awsInstances.region, awsInstances.name);

    res.json(instances);
  } catch (error) {
    console.error('Error fetching AWS instances:', error);
    res.status(500).json({ error: 'Failed to fetch AWS instances' });
  }
});

// Import AWS instance as server
router.post('/:id/instances/:instanceId/import', featureFlagMiddleware('awsIntegrations'), async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { name, groupId, pemKeyId, username } = req.body;
    
    // Get the AWS instance
    const awsInstance = await db
      .select()
      .from(awsInstances)
      .where(
        and(
          eq(awsInstances.integrationId, req.params.id),
          eq(awsInstances.instanceId, req.params.instanceId)
        )
      )
      .limit(1);

    if (!awsInstance[0]) {
      return res.status(404).json({ error: 'AWS instance not found' });
    }

    // Verify integration ownership
    const integration = await db
      .select()
      .from(awsIntegrations)
      .where(
        and(
          eq(awsIntegrations.id, req.params.id),
          eq(awsIntegrations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!integration[0]) {
      return res.status(404).json({ error: 'AWS integration not found' });
    }

    const instance = awsInstance[0];
    
    // Create server record
    const server = await db
      .insert(servers)
      .values({
        name: name || instance.name || `AWS-${instance.instanceId}`,
        hostname: instance.publicDns || instance.privateDns || instance.publicIp || instance.privateIp || '',
        ipAddress: instance.publicIp || instance.privateIp || '',
        port: 22,
        username: username || 'ec2-user',
        operatingSystem: instance.platform === 'windows' ? 'Windows' : 'Linux',
        groupId: groupId || null,
        pemKeyId: pemKeyId || null,
        organizationId: req.user!.organizationId,
        status: instance.state === 'running' ? 'online' : 'offline',
        metadata: {
          source: 'aws',
          awsInstanceId: instance.instanceId,
          awsRegion: instance.region,
          instanceType: instance.instanceType,
          tags: instance.tags,
          ...instance.metadata
        }
      })
      .returning();

    res.status(201).json({
      success: true,
      server: server[0],
      message: 'AWS instance imported as server successfully'
    });
  } catch (error) {
    console.error('Error importing AWS instance:', error);
    res.status(500).json({ error: 'Failed to import AWS instance' });
  }
});

export { router as awsRoutes };