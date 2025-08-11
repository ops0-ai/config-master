import { Router } from 'express';
import { db } from '../index';
import { 
  servers, 
  configurations, 
  deployments, 
  pemKeys, 
  conversations, 
  messages,
  auditLogs,
  configurationStates
} from '@config-management/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get dashboard statistics
router.get('/stats', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const organizationId = req.user!.organizationId;

    // Get server stats
    const totalServers = await db
      .select({ count: sql<number>`count(*)` })
      .from(servers)
      .where(eq(servers.organizationId, organizationId));

    const onlineServers = await db
      .select({ count: sql<number>`count(*)` })
      .from(servers)
      .where(
        and(
          eq(servers.organizationId, organizationId),
          eq(servers.status, 'online')
        )
      );

    // Get configuration stats
    const totalConfigurations = await db
      .select({ count: sql<number>`count(*)` })
      .from(configurations)
      .where(eq(configurations.organizationId, organizationId));

    const approvedConfigurations = await db
      .select({ count: sql<number>`count(*)` })
      .from(configurations)
      .where(
        and(
          eq(configurations.organizationId, organizationId),
          eq(configurations.approvalStatus, 'approved')
        )
      );

    // Get active drifts (configuration states with drift detected)
    const activeDrifts = await db
      .select({ count: sql<number>`count(*)` })
      .from(configurationStates)
      .where(
        and(
          eq(configurationStates.organizationId, organizationId),
          eq(configurationStates.driftDetected, true)
        )
      );

    // Get recent deployments (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDeployments = await db
      .select({ count: sql<number>`count(*)` })
      .from(deployments)
      .where(
        and(
          eq(deployments.organizationId, organizationId),
          sql`${deployments.createdAt} >= ${twentyFourHoursAgo}`
        )
      );

    // Get PEM keys count
    const totalPemKeys = await db
      .select({ count: sql<number>`count(*)` })
      .from(pemKeys)
      .where(eq(pemKeys.organizationId, organizationId));

    // Get conversations stats
    const totalConversations = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(eq(conversations.organizationId, organizationId));

    const activeConversations = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.isActive, true)
        )
      );

    // Get total configurations generated in chat
    const generatedConfigs = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          sql`${messages.generatedConfiguration} IS NOT NULL AND ${messages.generatedConfiguration} != ''`
        )
      );

    // Calculate success rate for deployments
    const completedDeployments = await db
      .select({ count: sql<number>`count(*)` })
      .from(deployments)
      .where(
        and(
          eq(deployments.organizationId, organizationId),
          eq(deployments.status, 'completed')
        )
      );

    const failedDeployments = await db
      .select({ count: sql<number>`count(*)` })
      .from(deployments)
      .where(
        and(
          eq(deployments.organizationId, organizationId),
          eq(deployments.status, 'failed')
        )
      );

    const totalFinishedDeployments = completedDeployments[0].count + failedDeployments[0].count;
    const deploymentSuccessRate = totalFinishedDeployments > 0 
      ? Math.round((completedDeployments[0].count / totalFinishedDeployments) * 100)
      : 100;

    res.json({
      totalServers: totalServers[0].count,
      onlineServers: onlineServers[0].count,
      totalConfigurations: totalConfigurations[0].count,
      approvedConfigurations: approvedConfigurations[0].count,
      activeDrifts: activeDrifts[0].count,
      recentDeployments: recentDeployments[0].count,
      pemKeys: totalPemKeys[0].count,
      conversations: {
        total: totalConversations[0].count,
        active: activeConversations[0].count,
        generatedConfigs: generatedConfigs[0].count
      },
      infrastructure: {
        serverUptime: totalServers[0].count > 0 
          ? Math.round((onlineServers[0].count / totalServers[0].count) * 100)
          : 0,
        configurationCompliance: totalConfigurations[0].count > 0
          ? Math.round(((totalConfigurations[0].count - activeDrifts[0].count) / totalConfigurations[0].count) * 100)
          : 100,
        deploymentSuccessRate
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activity
router.get('/activity', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const organizationId = req.user!.organizationId;
    const limit = parseInt(req.query.limit as string) || 10;

    // Get recent audit logs as activity
    const activities = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId
      })
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    // Format activities for the dashboard
    const formattedActivities = activities.map(activity => {
      let type: 'deployment' | 'drift' | 'server_added' | 'configuration_created' | 'conversation' = 'configuration_created';
      let status: 'success' | 'error' | 'warning' | 'info' = 'info';
      let description = '';

      // Map audit log actions to activity types and descriptions
      switch (activity.action) {
        case 'create':
          if (activity.resource === 'servers') {
            type = 'server_added';
            description = `New server added to infrastructure`;
            status = 'success';
          } else if (activity.resource === 'configurations') {
            type = 'configuration_created';
            description = `New configuration created`;
            status = 'success';
          } else if (activity.resource === 'conversations') {
            type = 'conversation';
            description = `New conversation started`;
            status = 'info';
          } else if (activity.resource === 'deployments') {
            type = 'deployment';
            description = `Deployment initiated`;
            status = 'info';
          }
          break;
        case 'update':
          if (activity.resource === 'deployments') {
            type = 'deployment';
            const details = activity.details as any;
            if (details?.status === 'completed') {
              description = `Deployment completed successfully`;
              status = 'success';
            } else if (details?.status === 'failed') {
              description = `Deployment failed`;
              status = 'error';
            } else if (details?.status === 'running') {
              description = `Deployment started`;
              status = 'info';
            } else {
              description = `Deployment updated`;
              status = 'info';
            }
          } else if (activity.resource === 'servers') {
            type = 'server_added';
            description = `Server configuration updated`;
            status = 'info';
          }
          break;
        case 'delete':
          if (activity.resource === 'servers') {
            type = 'server_added';
            description = `Server removed from infrastructure`;
            status = 'warning';
          } else if (activity.resource === 'configurations') {
            type = 'configuration_created';
            description = `Configuration deleted`;
            status = 'warning';
          }
          break;
        default:
          description = `${activity.action} ${activity.resource}`;
          status = 'info';
      }

      return {
        id: activity.id,
        type,
        description,
        timestamp: activity.createdAt,
        status
      };
    });

    res.json(formattedActivities);
  } catch (error) {
    console.error('Error fetching dashboard activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get infrastructure health details
router.get('/health', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const organizationId = req.user!.organizationId;

    // Get server health by status
    const serversByStatus = await db
      .select({
        status: servers.status,
        count: sql<number>`count(*)`
      })
      .from(servers)
      .where(eq(servers.organizationId, organizationId))
      .groupBy(servers.status);

    // Get deployment status distribution (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deploymentsByStatus = await db
      .select({
        status: deployments.status,
        count: sql<number>`count(*)`
      })
      .from(deployments)
      .where(
        and(
          eq(deployments.organizationId, organizationId),
          sql`${deployments.createdAt} >= ${thirtyDaysAgo}`
        )
      )
      .groupBy(deployments.status);

    // Get configuration approval status
    const configurationsByApproval = await db
      .select({
        approvalStatus: configurations.approvalStatus,
        count: sql<number>`count(*)`
      })
      .from(configurations)
      .where(eq(configurations.organizationId, organizationId))
      .groupBy(configurations.approvalStatus);

    // Get drift detection summary
    const driftSummary = await db
      .select({
        driftDetected: configurationStates.driftDetected,
        count: sql<number>`count(*)`
      })
      .from(configurationStates)
      .where(eq(configurationStates.organizationId, organizationId))
      .groupBy(configurationStates.driftDetected);

    res.json({
      servers: serversByStatus.reduce((acc, item) => {
        acc[item.status || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      deployments: deploymentsByStatus.reduce((acc, item) => {
        acc[item.status || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      configurations: configurationsByApproval.reduce((acc, item) => {
        acc[item.approvalStatus || 'unknown'] = item.count;
        return acc;
      }, {} as Record<string, number>),
      drift: driftSummary.reduce((acc, item) => {
        acc[item.driftDetected ? 'detected' : 'compliant'] = item.count;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error('Error fetching health data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as dashboardRoutes };