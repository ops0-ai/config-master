import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { users } from '@config-management/database';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
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

    req.user = {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role,
      organizationId: decoded.organizationId,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};