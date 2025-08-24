import { Router, Response } from 'express';
import { db } from '../index';
import { auditLogs, users } from '@config-management/database';
import { eq, desc, and, ilike, gte, lte } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import { featureFlagMiddleware } from '../middleware/featureFlags';

const router = Router();

// Get audit logs with pagination, filtering, and search
router.get('/', featureFlagMiddleware('auditLogs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canView = await hasPermission(req.user!.id, 'audit-logs', 'view');
    
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions to view audit logs' });
    }

    const { 
      page = '1', 
      limit = '50', 
      search = '', 
      action = '', 
      resource = '', 
      userId = '',
      startDate = '', 
      endDate = '' 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    let whereConditions = [eq(auditLogs.organizationId, req.user!.organizationId)];

    if (search) {
      whereConditions.push(
        ilike(auditLogs.action, `%${search}%`)
      );
    }

    if (action) {
      whereConditions.push(eq(auditLogs.action, action as string));
    }

    if (resource) {
      whereConditions.push(eq(auditLogs.resource, resource as string));
    }

    if (userId) {
      whereConditions.push(eq(auditLogs.userId, userId as string));
    }

    if (startDate) {
      whereConditions.push(gte(auditLogs.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      whereConditions.push(lte(auditLogs.createdAt, new Date(endDate as string)));
    }

    // Get audit logs with user information
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count for pagination
    const totalCount = await db
      .select({ count: auditLogs.id })
      .from(auditLogs)
      .where(and(...whereConditions));

    const totalPages = Math.ceil(totalCount.length / limitNum);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount: totalCount.length,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch audit logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get distinct actions for filtering dropdown
router.get('/actions', featureFlagMiddleware('auditLogs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canView = await hasPermission(req.user!.id, 'audit-logs', 'view');
    
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const actions = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, req.user!.organizationId))
      .orderBy(auditLogs.action);

    res.json(actions.map(a => a.action));
  } catch (error) {
    console.error('Error fetching audit log actions:', error);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

// Get distinct resources for filtering dropdown
router.get('/resources', featureFlagMiddleware('auditLogs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canView = await hasPermission(req.user!.id, 'audit-logs', 'view');
    
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const resources = await db
      .selectDistinct({ resource: auditLogs.resource })
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, req.user!.organizationId))
      .orderBy(auditLogs.resource);

    res.json(resources.map(r => r.resource));
  } catch (error) {
    console.error('Error fetching audit log resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get audit log statistics
router.get('/stats', featureFlagMiddleware('auditLogs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canView = await hasPermission(req.user!.id, 'audit-logs', 'view');
    
    if (!canView) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { days = '7' } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get activity counts by day
    const activityStats = await db
      .select({
        date: auditLogs.createdAt,
        action: auditLogs.action,
        resource: auditLogs.resource,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, req.user!.organizationId),
          gte(auditLogs.createdAt, startDate)
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    // Group by date
    const dailyActivity = activityStats.reduce((acc: any, log) => {
      const date = log.date.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date]++;
      return acc;
    }, {});

    // Group by action
    const actionStats = activityStats.reduce((acc: any, log) => {
      if (!acc[log.action]) {
        acc[log.action] = 0;
      }
      acc[log.action]++;
      return acc;
    }, {});

    // Group by resource
    const resourceStats = activityStats.reduce((acc: any, log) => {
      if (!acc[log.resource]) {
        acc[log.resource] = 0;
      }
      acc[log.resource]++;
      return acc;
    }, {});

    res.json({
      totalLogs: activityStats.length,
      dailyActivity,
      actionStats,
      resourceStats,
      period: `${daysNum} days`
    });

  } catch (error) {
    console.error('Error fetching audit log stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;