import { Router } from 'express';
import { db } from '../index';
import { organizations, userOrganizations } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const router = Router();

// Get current organization details
router.get('/current', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'No organization found for user' });
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Update organization profile
const updateOrgSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});

router.put('/current', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    
    if (!organizationId || !userId) {
      return res.status(400).json({ error: 'No organization found for user' });
    }

    // Validate request body
    const validatedData = updateOrgSchema.parse(req.body);

    // Check if user is owner or admin
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user is owner or has admin role
    const isOwner = organization.ownerId === userId;
    
    if (!isOwner && req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized to update organization' });
    }

    // Update organization
    const [updated] = await db
      .update(organizations)
      .set({
        name: validatedData.name,
        description: validatedData.description,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get all organizations for a user (for multi-tenancy)
router.get('/user-organizations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Get all organizations the user belongs to
    const userOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        role: userOrganizations.role,
        isActive: userOrganizations.isActive,
        createdAt: organizations.createdAt,
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.isActive, true)
        )
      );

    res.json(userOrgs);
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    res.status(500).json({ error: 'Failed to fetch user organizations' });
  }
});

// Switch to a different organization
router.post('/switch', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const { organizationId } = req.body;
    
    if (!userId || !organizationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify user has access to this organization
    const [membership] = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId),
          eq(userOrganizations.isActive, true)
        )
      );

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to access this organization' });
    }

    // Get the organization details
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    // Generate a new JWT token with the updated organizationId
    const token = jwt.sign(
      { 
        userId: userId,
        organizationId: organizationId 
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      organization,
      token,
      message: 'Successfully switched organization',
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    res.status(500).json({ error: 'Failed to switch organization' });
  }
});

export default router;