import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { users, organizations } from '@config-management/database';
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