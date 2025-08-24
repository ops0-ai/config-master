import { Router } from 'express';
import { db } from '../index';
import { organizations, users, userRoles, roles, permissions, rolePermissions, userOrganizations, mdmProfiles } from '@config-management/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';
import { z } from 'zod';
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

// Get all permissions dynamically from database
async function getAllSystemPermissions() {
  const allPermissions = await db.select().from(permissions);
  return allPermissions.map(p => ({
    resource: p.resource,
    action: p.action,
    description: p.description
  }));
}

// All permissions for admin role - will be populated dynamically

// Function to create RBAC roles and permissions for a new organization
async function createRBACForOrganization(organization: any, adminUserId: string) {
  try {
    console.log(`🔐 Creating RBAC system for organization: ${organization.name}`);
    
    // Get all system permissions (they should already exist)
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(allPermissions.map(p => [`${p.resource}:${p.action}`, p.id]));
    const allPermissionKeys = allPermissions.map(p => `${p.resource}:${p.action}`);
    
    console.log(`  📋 Found ${allPermissions.length} total permissions in system`);
    
    // Create Administrator role with all permissions
    const [adminRole] = await db
      .insert(roles)
      .values({
        name: 'Administrator',
        description: 'Full access to all platform features and settings',
        organizationId: organization.id,
        isSystem: true,
        createdBy: organization.ownerId,
      })
      .returning();
    
    // Assign ALL permissions to Administrator role
    let assignedPermissions = 0;
    for (const permissionKey of allPermissionKeys) {
      const permissionId = permissionMap.get(permissionKey);
      if (permissionId) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: adminRole.id,
            permissionId: permissionId,
          })
          .onConflictDoNothing();
        assignedPermissions++;
      }
    }
    
    // Create other standard roles
    const standardRoles = [
      {
        name: 'Developer',
        description: 'Access to configurations, deployments, and basic server management',
        permissions: [
          'dashboard:read', 'servers:read', 'servers:write', 'server-groups:read',
          'pem-keys:read', 'pem-keys:write', 'configurations:read', 'configurations:write',
          'configurations:execute', 'deployments:read', 'deployments:write', 'deployments:execute',
          'training:read', 'chat:read', 'chat:write', 'aws-integrations:read',
          'github-integrations:read', 'github-integrations:write', 'github-integrations:sync',
          'asset:read', 'asset:create', 'asset:update', 'asset:assign'
        ]
      },
      {
        name: 'Viewer',
        description: 'Read-only access to most resources',
        permissions: [
          'dashboard:read', 'servers:read', 'server-groups:read', 'pem-keys:read',
          'configurations:read', 'deployments:read', 'training:read', 'chat:read',
          'aws-integrations:read', 'github-integrations:read', 'mdm:read', 'asset:read'
        ]
      }
    ];
    
    for (const roleData of standardRoles) {
      const [newRole] = await db
        .insert(roles)
        .values({
          name: roleData.name,
          description: roleData.description,
          organizationId: organization.id,
          isSystem: true,
          createdBy: organization.ownerId,
        })
        .returning();
      
      // Assign permissions to the role
      for (const permissionKey of roleData.permissions) {
        const permissionId = permissionMap.get(permissionKey);
        if (permissionId) {
          await db
            .insert(rolePermissions)
            .values({
              roleId: newRole.id,
              permissionId: permissionId,
            })
            .onConflictDoNothing();
        }
      }
    }
    
    // Assign Administrator role to the admin user
    await db
      .insert(userRoles)
      .values({
        userId: adminUserId,
        roleId: adminRole.id,
        assignedBy: organization.ownerId,
        isActive: true,
      })
      .onConflictDoNothing();
    
    // Create default MDM profile for the organization
    const enrollmentKey = crypto.randomBytes(32).toString('hex');
    await db
      .insert(mdmProfiles)
      .values({
        name: `${organization.name} Default MDM Profile`,
        description: 'Default MDM profile created automatically for organization',
        organizationId: organization.id,
        profileType: 'macos',
        allowRemoteCommands: true,
        allowLockDevice: true,
        allowShutdown: false,
        allowRestart: true,
        allowWakeOnLan: true,
        requireAuthentication: true,
        maxSessionDuration: 3600,
        allowedIpRanges: [],
        enrollmentKey: enrollmentKey,
        isActive: true,
        createdBy: organization.ownerId,
      });
    
    console.log(`  ✅ Created Administrator role with ${assignedPermissions} permissions`);
    console.log(`  ✅ Created 2 additional roles: Developer, Viewer`);
    console.log(`  👤 Assigned Administrator role to admin user`);
    console.log(`  📱 Created default MDM profile with enrollment key: ${enrollmentKey}`);
    
  } catch (error) {
    console.error(`❌ Failed to create RBAC for organization ${organization.name}:`, error);
    throw error;
  }
}

// Middleware to check super admin access
const superAdminMiddleware = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is super admin
    const user = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]?.isSuperAdmin) {
      return res.status(403).json({ 
        error: 'Super admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/organizations
 * Get all organizations with user counts (Super Admin only)
 */
router.get('/organizations', authMiddleware, superAdminMiddleware, auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Get organizations with user counts
    const orgsWithCounts = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        description: organizations.description,
        ownerId: organizations.ownerId,
        isActive: organizations.isActive,
        isPrimary: organizations.isPrimary,
        featuresEnabled: organizations.featuresEnabled,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        userCount: sql`count(${users.id})`
      })
      .from(organizations)
      .leftJoin(users, eq(users.organizationId, organizations.id))
      .groupBy(
        organizations.id,
        organizations.name,
        organizations.description,
        organizations.ownerId,
        organizations.isActive,
        organizations.isPrimary,
        organizations.featuresEnabled,
        organizations.createdAt,
        organizations.updatedAt
      )
      .orderBy(desc(organizations.createdAt));

    // Format the response
    const formattedOrgs = orgsWithCounts.map(org => ({
      ...org,
      _count: {
        users: Number(org.userCount) || 0
      },
      // Ensure featuresEnabled has all required fields with defaults
      featuresEnabled: {
        servers: true,
        serverGroups: true,
        pemKeys: true,
        configurations: true,
        deployments: true,
        chat: true,
        training: true,
        awsIntegrations: true,
        githubIntegrations: true,
        mdm: true,
        assets: true,
        auditLogs: true,
        ...(org.featuresEnabled || {})
      }
    }));

    res.json({ organizations: formattedOrgs });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * PUT /api/admin/organizations/:id/features
 * Update organization feature flags (Super Admin only)
 */
router.put('/organizations/:id/features', authMiddleware, superAdminMiddleware, auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    const { featuresEnabled } = req.body;

    if (!id || !featuresEnabled) {
      return res.status(400).json({ error: 'Organization ID and features are required' });
    }

    // Validate that the organization exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existingOrg[0]) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Update the organization's features
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        featuresEnabled,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();

    res.json({ 
      message: 'Organization features updated successfully',
      organization: updatedOrg
    });
  } catch (error) {
    console.error('Error updating organization features:', error);
    res.status(500).json({ error: 'Failed to update organization features' });
  }
});

/**
 * PUT /api/admin/organizations/:id/status
 * Update organization active status (Super Admin only)
 */
router.put('/organizations/:id/status', authMiddleware, superAdminMiddleware, auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Organization ID and status are required' });
    }

    // Check if organization exists and if it's primary
    const existingOrg = await db
      .select({
        id: organizations.id,
        isPrimary: organizations.isPrimary,
        isActive: organizations.isActive
      })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existingOrg[0]) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Prevent deactivating primary organization
    if (existingOrg[0].isPrimary && !isActive) {
      return res.status(400).json({ 
        error: 'Cannot deactivate primary organization',
        code: 'PRIMARY_ORG_PROTECTION'
      });
    }

    // Update the organization status
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        isActive,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();

    res.json({ 
      message: `Organization ${isActive ? 'activated' : 'deactivated'} successfully`,
      organization: updatedOrg
    });
  } catch (error) {
    console.error('Error updating organization status:', error);
    res.status(500).json({ error: 'Failed to update organization status' });
  }
});

/**
 * GET /api/admin/organizations/:id/users
 * Get users in a specific organization (Super Admin only)
 */
router.get('/organizations/:id/users', authMiddleware, superAdminMiddleware, auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Get users in the organization with their roles
    const orgUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        isSuperAdmin: users.isSuperAdmin,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(users)
      .where(eq(users.organizationId, id))
      .orderBy(desc(users.createdAt));

    res.json({ users: orgUsers });
  } catch (error) {
    console.error('Error fetching organization users:', error);
    res.status(500).json({ error: 'Failed to fetch organization users' });
  }
});

/**
 * GET /api/admin/stats
 * Get platform statistics (Super Admin only)
 */
router.get('/stats', authMiddleware, superAdminMiddleware, auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // Get overall platform statistics
    const [orgCount] = await db
      .select({ count: sql`count(*)` })
      .from(organizations);

    const [userCount] = await db
      .select({ count: sql`count(*)` })
      .from(users);

    const [activeOrgCount] = await db
      .select({ count: sql`count(*)` })
      .from(organizations)
      .where(eq(organizations.isActive, true));

    const [activeUserCount] = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(eq(users.isActive, true));

    const stats = {
      organizations: {
        total: Number(orgCount.count),
        active: Number(activeOrgCount.count),
        inactive: Number(orgCount.count) - Number(activeOrgCount.count)
      },
      users: {
        total: Number(userCount.count),
        active: Number(activeUserCount.count),
        inactive: Number(userCount.count) - Number(activeUserCount.count)
      }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

/**
 * POST /api/admin/organizations
 * Create new organization (Super Admin only)
 */
router.post('/organizations', authMiddleware, superAdminMiddleware, auditMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
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

    // Create organization first with default feature flags enabled
    const newOrg = await db
      .insert(organizations)
      .values({
        id: orgId,
        name,
        description,
        ownerId: adminUserId,
        isActive: true,
        isPrimary: false,
        featuresEnabled: {
          servers: true,
          serverGroups: true,
          pemKeys: true,
          configurations: true,
          deployments: true,
          chat: true,
          training: true,
          awsIntegrations: true,
          githubIntegrations: true,
          mdm: true,
          assets: true,
          auditLogs: true,
        },
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

    // Create RBAC roles for the new organization and assign admin permissions
    await createRBACForOrganization(newOrg[0], newUser[0].id);
    
    console.log(`✅ Created RBAC roles and assigned Administrator permissions to ${newUser[0].email} for organization ${newOrg[0].name}`);

    res.status(201).json({
      organization: {
        ...newOrg[0],
        _count: {
          users: 1
        }
      },
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
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

export { router as adminRoutes };