import { Router } from 'express';
import { db } from '../index';
import { deployments, configurations, servers, serverGroups } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';

const router = Router();

const deploymentSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  section: Joi.string().default('general'),
  configurationId: Joi.string().uuid().required(),
  targetType: Joi.string().valid('server', 'serverGroup').required(),
  targetId: Joi.string().uuid().required(),
});

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const deploys = await db
      .select({
        id: deployments.id,
        name: deployments.name,
        description: deployments.description,
        section: deployments.section,
        version: deployments.version,
        parentDeploymentId: deployments.parentDeploymentId,
        configurationId: deployments.configurationId,
        targetType: deployments.targetType,
        targetId: deployments.targetId,
        status: deployments.status,
        logs: deployments.logs,
        startedAt: deployments.startedAt,
        completedAt: deployments.completedAt,
        createdAt: deployments.createdAt,
        configuration: {
          id: configurations.id,
          name: configurations.name,
          type: configurations.type,
        },
        server: {
          id: servers.id,
          name: servers.name,
        },
        serverGroup: {
          id: serverGroups.id,
          name: serverGroups.name,
        },
      })
      .from(deployments)
      .leftJoin(configurations, eq(deployments.configurationId, configurations.id))
      .leftJoin(servers, eq(deployments.targetId, servers.id))
      .leftJoin(serverGroups, eq(deployments.targetId, serverGroups.id))
      .where(eq(deployments.organizationId, req.user!.organizationId))
      .orderBy(deployments.createdAt);

    // Format the response to include target info
    const formattedDeployments = deploys.map(deploy => ({
      ...deploy,
      target: deploy.targetType === 'server' && deploy.server?.id
        ? { id: deploy.server.id, name: deploy.server.name, type: 'server' as const }
        : deploy.targetType === 'serverGroup' && deploy.serverGroup?.id
        ? { id: deploy.serverGroup.id, name: deploy.serverGroup.name, type: 'serverGroup' as const }
        : null,
      server: undefined,
      serverGroup: undefined,
    }));
    
    res.json(formattedDeployments);
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const deploy = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.id, req.params.id),
          eq(deployments.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!deploy[0]) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json(deploy[0]);
  } catch (error) {
    console.error('Error fetching deployment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = deploymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify configuration exists
    const config = await db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.id, value.configurationId),
          eq(configurations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!config[0]) {
      return res.status(400).json({ error: 'Configuration not found' });
    }

    // Verify target exists
    if (value.targetType === 'server') {
      const server = await db
        .select()
        .from(servers)
        .where(
          and(
            eq(servers.id, value.targetId),
            eq(servers.organizationId, req.user!.organizationId)
          )
        )
        .limit(1);

      if (!server[0]) {
        return res.status(400).json({ error: 'Server not found' });
      }
    } else {
      const group = await db
        .select()
        .from(serverGroups)
        .where(
          and(
            eq(serverGroups.id, value.targetId),
            eq(serverGroups.organizationId, req.user!.organizationId)
          )
        )
        .limit(1);

      if (!group[0]) {
        return res.status(400).json({ error: 'Server group not found' });
      }
    }

    // Check if this is a redeploy (same name + config + target)
    const existingDeployments = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.name, value.name),
          eq(deployments.configurationId, value.configurationId),
          eq(deployments.targetId, value.targetId),
          eq(deployments.organizationId, req.user!.organizationId)
        )
      )
      .orderBy(deployments.version);

    const nextVersion = existingDeployments.length > 0 
      ? Math.max(...existingDeployments.map(d => d.version || 1)) + 1 
      : 1;

    const parentDeploymentId = existingDeployments.length > 0 
      ? existingDeployments[0].id 
      : null;

    const deploymentData = {
      ...value,
      description: value.description || null,
      section: value.section || 'general',
      version: nextVersion,
      parentDeploymentId,
      organizationId: req.user!.organizationId,
      executedBy: req.user!.id,
      status: 'pending' as const,
    };

    const newDeployment = await db
      .insert(deployments)
      .values(deploymentData)
      .returning();
    
    res.status(201).json(newDeployment[0]);
  } catch (error) {
    console.error('Error creating deployment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/run', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Check if user has execute permission for deployments
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canExecute = await hasPermission(req.user!.id, 'deployments', 'execute');
    
    if (!canExecute) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: { resource: 'deployments', action: 'execute' }
      });
    }
    
    const deployment = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.id, req.params.id),
          eq(deployments.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!deployment[0]) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    let targetDeployment = deployment[0];

    // If this is a redeployment (completed/failed), create a new version
    if (['completed', 'failed', 'cancelled'].includes(deployment[0].status)) {
      console.log(`Creating new deployment version for redeployment of ${deployment[0].name}`);
      
      const newVersion = deployment[0].version + 1;
      const newDeploymentData = {
        name: deployment[0].name,
        description: deployment[0].description,
        section: deployment[0].section,
        version: newVersion,
        parentDeploymentId: deployment[0].parentDeploymentId || deployment[0].id,
        configurationId: deployment[0].configurationId,
        targetType: deployment[0].targetType,
        targetId: deployment[0].targetId,
        status: 'running' as const,
        startedAt: new Date(),
        logs: `🔄 Redeployment v${newVersion} started...\n`,
        executedBy: req.user!.id,
        organizationId: req.user!.organizationId,
      };

      const newDeployment = await db
        .insert(deployments)
        .values(newDeploymentData)
        .returning();

      targetDeployment = newDeployment[0];
    } else {
      // For pending deployments, just update the existing one
      if (deployment[0].status === 'running') {
        return res.status(400).json({ error: 'Deployment is already running' });
      }

      await db
        .update(deployments)
        .set({
          status: 'running',
          startedAt: new Date(),
          logs: 'Deployment started...\n',
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, req.params.id));
    }

    // Execute actual Ansible deployment
    const { AnsibleExecutionService } = await import('../services/ansibleExecution');
    const ansibleService = AnsibleExecutionService.getInstance();

    // Run deployment asynchronously
    (async () => {
      try {
        await ansibleService.executePlaybook({
          deploymentId: targetDeployment.id,
          configurationId: targetDeployment.configurationId,
          targetType: targetDeployment.targetType as 'server' | 'serverGroup',
          targetId: targetDeployment.targetId,
          organizationId: targetDeployment.organizationId,
          onProgress: async (logs: string) => {
            try {
              // Update logs in real-time
              const currentDeployment = await db
                .select()
                .from(deployments)
                .where(eq(deployments.id, targetDeployment.id))
                .limit(1);
              
              if (currentDeployment[0]) {
                await db
                  .update(deployments)
                  .set({
                    logs: (currentDeployment[0].logs || '') + logs,
                    updatedAt: new Date(),
                  })
                  .where(eq(deployments.id, targetDeployment.id));
              }
            } catch (error) {
              console.error('Error updating deployment logs:', error);
            }
          }
        });

        // Mark as completed
        await db
          .update(deployments)
          .set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deployments.id, targetDeployment.id));

      } catch (error) {
        console.error('Ansible execution error:', error);
        
        // Mark as failed with error message
        await db
          .update(deployments)
          .set({
            status: 'failed',
            completedAt: new Date(),
            logs: `\n❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            updatedAt: new Date(),
          })
          .where(eq(deployments.id, targetDeployment.id));
      }
    })().catch((error) => {
      // Additional safety net to prevent uncaught promise rejections
      console.error('Deployment execution error:', error);
    });

    res.json({ message: 'Deployment started' });
  } catch (error) {
    console.error('Error running deployment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/cancel', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Check if user has execute permission for deployments
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canExecute = await hasPermission(req.user!.id, 'deployments', 'execute');
    
    if (!canExecute) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: { resource: 'deployments', action: 'execute' }
      });
    }
    
    const deployment = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.id, req.params.id),
          eq(deployments.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!deployment[0]) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (!['pending', 'running'].includes(deployment[0].status)) {
      return res.status(400).json({ error: 'Deployment cannot be cancelled' });
    }

    // Try to cancel running Ansible process
    const { AnsibleExecutionService } = await import('../services/ansibleExecution');
    const ansibleService = AnsibleExecutionService.getInstance();
    const processCancelled = ansibleService.cancelDeployment(req.params.id);

    await db
      .update(deployments)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        logs: (deployment[0].logs || '') + 
          (processCancelled 
            ? '\n\n🛑 Deployment cancelled by user (process terminated)'
            : '\n\n🛑 Deployment cancelled by user'
          ),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, req.params.id));

    res.json({ message: 'Deployment cancelled' });
  } catch (error) {
    console.error('Error cancelling deployment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const deployment = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.id, req.params.id),
          eq(deployments.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!deployment[0]) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    if (deployment[0].status === 'running') {
      return res.status(400).json({ error: 'Cannot delete a running deployment' });
    }

    await db.delete(deployments).where(eq(deployments.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting deployment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as deploymentRoutes };