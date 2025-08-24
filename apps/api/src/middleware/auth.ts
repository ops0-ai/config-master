import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { users, organizations, systemSettings } from '@config-management/database';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
    isSuperAdmin: boolean;
  };
  organizationFeatures?: {
    servers?: boolean;
    serverGroups?: boolean;
    pemKeys?: boolean;
    configurations?: boolean;
    deployments?: boolean;
    chat?: boolean;
    training?: boolean;
    awsIntegrations?: boolean;
    githubIntegrations?: boolean;
    mdm?: boolean;
    assets?: boolean;
    auditLogs?: boolean;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user[0] || !user[0].isActive) {
      return res.status(401).json({ error: 'Invalid token or inactive user.' });
    }

    // Check maintenance mode (only allow super admins and administrators during maintenance)
    const maintenanceMode = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'maintenance_mode'))
      .limit(1);

    if (maintenanceMode[0] && maintenanceMode[0].value === true) {
      // During maintenance mode, only super admins and administrators are allowed
      if (!user[0].isSuperAdmin && user[0].role !== 'administrator' && user[0].role !== 'super_admin') {
        return res.status(503).json({ 
          error: 'System is currently under maintenance. Please try again later.',
          code: 'MAINTENANCE_MODE'
        });
      }
    }

    // Check if user's organization is active (skip for super admins)
    if (!user[0].isSuperAdmin) {
      const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, decoded.organizationId))
        .limit(1);

      if (!organization[0] || !organization[0].isActive) {
        return res.status(403).json({ 
          error: 'Organization has been disabled. Please contact your global administrator for assistance.',
          code: 'ORGANIZATION_DISABLED'
        });
      }
    }

    req.user = {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role,
      organizationId: decoded.organizationId,
      isSuperAdmin: user[0].isSuperAdmin || decoded.isSuperAdmin,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};