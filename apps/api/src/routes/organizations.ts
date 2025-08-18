import { Router } from 'express';
import { db } from '../index';
import { organizations, userOrganizations, users, mdmDevices, servers, configurations, deployments, roles, userRoles } from '@config-management/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = Router();

// Validation schemas
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1).max(255),
  adminPassword: z.string().min(6),
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

// Middleware to check super admin access
const requireSuperAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

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
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get all organizations for a user (for multi-tenancy)
router.get('/user-organizations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin;
    
    if (!userId) {
      return res.status(400).json({ error: 'User not found' });
    }

    let userOrgs;

    if (isSuperAdmin) {
      // Super admins can access all active organizations
      userOrgs = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          description: organizations.description,
          role: sql<string>`'super_admin'`,
          isActive: sql<boolean>`true`,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(eq(organizations.isActive, true))
        .orderBy(organizations.name);
    } else {
      // Regular users can only access organizations they belong to
      userOrgs = await db
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
            eq(userOrganizations.isActive, true),
            eq(organizations.isActive, true)
          )
        );
    }

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
    if (!req.user?.isSuperAdmin) {
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
        organizationId: organizationId,
        isSuperAdmin: req.user?.isSuperAdmin
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

// Super Admin endpoints
// Get all organizations (Super Admin only)
router.get('/admin/all', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Get basic organization data first
    const basicOrgs = await db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt));

    // Manually add counts for each organization
    const orgsWithStats = await Promise.all(
      basicOrgs.map(async (org) => {
        const [userCount] = await db.execute(sql`SELECT COUNT(*)::int as count FROM users WHERE organization_id = ${org.id}`);
        const [serverCount] = await db.execute(sql`SELECT COUNT(*)::int as count FROM servers WHERE organization_id = ${org.id}`);
        const [configCount] = await db.execute(sql`SELECT COUNT(*)::int as count FROM configurations WHERE organization_id = ${org.id}`);
        const [deploymentCount] = await db.execute(sql`SELECT COUNT(*)::int as count FROM deployments WHERE organization_id = ${org.id}`);
        const [mdmDeviceCount] = await db.execute(sql`SELECT COUNT(*)::int as count FROM mdm_devices WHERE organization_id = ${org.id}`);

        return {
          ...org,
          userCount: userCount.count || 0,
          serverCount: serverCount.count || 0,
          configCount: configCount.count || 0,
          deploymentCount: deploymentCount.count || 0,
          mdmDeviceCount: mdmDeviceCount.count || 0,
        };
      })
    );

    console.log('🔍 Organizations with stats:', JSON.stringify(orgsWithStats, null, 2));
    res.json(orgsWithStats);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get organization statistics (Super Admin only)
router.get('/admin/stats', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const stats = await db
      .select({
        totalOrgs: sql<number>`COUNT(${organizations.id})`,
        activeOrgs: sql<number>`COUNT(CASE WHEN ${organizations.isActive} = true THEN 1 END)`,
        inactiveOrgs: sql<number>`COUNT(CASE WHEN ${organizations.isActive} = false THEN 1 END)`,
      })
      .from(organizations);

    // Get most active organization by deployment count
    const mostActive = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        deploymentCount: sql<number>`COUNT(${deployments.id})`,
      })
      .from(organizations)
      .leftJoin(deployments, eq(deployments.organizationId, organizations.id))
      .where(eq(organizations.isActive, true))
      .groupBy(organizations.id, organizations.name)
      .orderBy(desc(sql`COUNT(${deployments.id})`))
      .limit(1);

    // Get recent activity across all orgs
    const recentActivity = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        lastDeployment: sql<Date>`MAX(${deployments.createdAt})`,
      })
      .from(organizations)
      .leftJoin(deployments, eq(deployments.organizationId, organizations.id))
      .where(eq(organizations.isActive, true))
      .groupBy(organizations.id, organizations.name)
      .having(sql`MAX(${deployments.createdAt}) IS NOT NULL`)
      .orderBy(desc(sql`MAX(${deployments.createdAt})`))
      .limit(5);

    res.json({
      overview: stats[0],
      mostActiveOrg: mostActive[0] || null,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching organization stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new organization (Super Admin only)
router.post('/admin/create', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const validatedData = createOrganizationSchema.parse(req.body);
    const { name, description, adminEmail, adminName, adminPassword } = validatedData;

    // Check if user with this email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate IDs first
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminUserId = crypto.randomUUID();
    const orgId = crypto.randomUUID();

    // Create organization first
    const newOrg = await db
      .insert(organizations)
      .values({
        id: orgId,
        name,
        description,
        ownerId: adminUserId, // Organization admin is the owner
        isActive: true,
        isPrimary: false,
      })
      .returning();

    // Create admin user for the organization (after organization exists)
    const newUser = await db
      .insert(users)
      .values({
        id: adminUserId,
        email: adminEmail,
        name: adminName,
        passwordHash,
        role: 'admin',
        organizationId: orgId,
        isActive: true,
      })
      .returning();

    // Create user-organization relationship
    await db
      .insert(userOrganizations)
      .values({
        userId: newUser[0].id,
        organizationId: newOrg[0].id,
        role: 'admin',
        isActive: true,
      });

    // Assign Administrator role to the organization admin user
    const [adminRole] = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.name, 'Administrator'),
          eq(roles.organizationId, newOrg[0].id)
        )
      )
      .limit(1);

    if (adminRole) {
      await db
        .insert(userRoles)
        .values({
          userId: newUser[0].id,
          roleId: adminRole.id,
          isActive: true,
        });
      console.log(`✅ Assigned Administrator role to ${newUser[0].email} for organization ${newOrg[0].name}`);
    } else {
      console.warn(`⚠️ Administrator role not found for organization ${newOrg[0].name}. User will have limited permissions.`);
    }

    res.status(201).json({
      organization: newOrg[0],
      adminUser: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        role: newUser[0].role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update organization (Super Admin only)
router.patch('/admin/:orgId', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const validatedData = updateOrganizationSchema.parse(req.body);
    const orgId = req.params.orgId;

    // Check if organization exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!existingOrg.length) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Prevent disabling primary organization
    if (validatedData.isActive === false && existingOrg[0].isPrimary) {
      return res.status(400).json({ error: 'Cannot disable primary organization' });
    }

    // Update organization
    const updatedOrg = await db
      .update(organizations)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    res.json(updatedOrg[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.issues });
    }
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete/Disable organization (Super Admin only)
router.delete('/admin/:orgId', authMiddleware, requireSuperAdmin, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const orgId = req.params.orgId;

    // Check if organization exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!existingOrg.length) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Prevent deleting primary organization
    if (existingOrg[0].isPrimary) {
      return res.status(400).json({ error: 'Cannot delete primary organization' });
    }

    // Just disable the organization instead of deleting
    const disabledOrg = await db
      .update(organizations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    // Also disable all users in the organization
    await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.organizationId, orgId));

    res.json({ 
      message: 'Organization disabled successfully',
      organization: disabledOrg[0] 
    });
  } catch (error) {
    console.error('Error disabling organization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;