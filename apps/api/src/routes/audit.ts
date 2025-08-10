import { Router } from 'express';
import { db } from '../index';
import { auditLogs } from '@config-management/database';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, req.user!.organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as auditRoutes };