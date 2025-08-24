import { Router } from 'express';
import { db } from '../index';
import { organizations, userOrganizations, users, mdmDevices, servers, configurations, deployments, roles, userRoles, permissions, rolePermissions, mdmProfiles, conversations, assets } from '@config-management/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = Router();

// Get organization statistics (needs to be first to avoid route conflicts)
router.get('/:id/stats', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching stats for organization: ${id}`);
    
    // Query users directly from users table (primary relationship)
    const usersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.organizationId, id));
      
    const configurationsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(configurations)
      .where(eq(configurations.organizationId, id));
      
    const deploymentsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deployments)
      .where(eq(deployments.organizationId, id));
      
    const serversResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(servers)
      .where(eq(servers.organizationId, id));
      
    const conversationsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.organizationId, id));
      
    const assetsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assets)
      .where(eq(assets.organizationId, id));

    const stats = {
      users: usersResult[0]?.count || 0,
      configurations: configurationsResult[0]?.count || 0,
      deployments: deploymentsResult[0]?.count || 0,
      servers: serversResult[0]?.count || 0,
      conversations: conversationsResult[0]?.count || 0,
      assets: assetsResult[0]?.count || 0
    };
    
    console.log(`📊 Organization ${id} stats:`, stats);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching organization stats:', error);
    res.status(500).json({ error: 'Failed to fetch organization stats' });
  }
});

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

// System permissions for RBAC
const systemPermissions = [
  { resource: 'dashboard', action: 'read', description: 'View dashboard and analytics' },
  { resource: 'settings', action: 'read', description: 'View organization settings' },
  { resource: 'settings', action: 'write', description: 'Modify organization settings' },
  { resource: 'users', action: 'read', description: 'View users and roles' },
  { resource: 'users', action: 'write', description: 'Create and modify users' },
  { resource: 'users', action: 'delete', description: 'Delete users' },
  { resource: 'roles', action: 'read', description: 'View roles and permissions' },
  { resource: 'roles', action: 'write', description: 'Create and modify roles' },
  { resource: 'roles', action: 'delete', description: 'Delete roles' },
  { resource: 'servers', action: 'read', description: 'View servers' },
  { resource: 'servers', action: 'write', description: 'Create and modify servers' },
  { resource: 'servers', action: 'execute', description: 'Test server connections' },
  { resource: 'servers', action: 'delete', description: 'Delete servers' },
  { resource: 'server-groups', action: 'read', description: 'View server groups' },
  { resource: 'server-groups', action: 'write', description: 'Create and modify server groups' },
  { resource: 'server-groups', action: 'execute', description: 'Manage server group operations' },
  { resource: 'server-groups', action: 'delete', description: 'Delete server groups' },
  { resource: 'pem-keys', action: 'read', description: 'View PEM keys' },
  { resource: 'pem-keys', action: 'write', description: 'Upload and modify PEM keys' },
  { resource: 'pem-keys', action: 'execute', description: 'Test PEM key connections' },
  { resource: 'pem-keys', action: 'delete', description: 'Delete PEM keys' },
  { resource: 'configurations', action: 'read', description: 'View configurations' },
  { resource: 'configurations', action: 'write', description: 'Create and modify configurations' },
  { resource: 'configurations', action: 'execute', description: 'Validate and test configurations' },
  { resource: 'configurations', action: 'approve', description: 'Approve or reject configurations for deployment' },
  { resource: 'configurations', action: 'delete', description: 'Delete configurations' },
  { resource: 'deployments', action: 'read', description: 'View deployments' },
  { resource: 'deployments', action: 'write', description: 'Create and modify deployments' },
  { resource: 'deployments', action: 'execute', description: 'Execute and redeploy configurations' },
  { resource: 'deployments', action: 'delete', description: 'Delete deployments' },
  { resource: 'training', action: 'read', description: 'Access infrastructure training modules' },
  { resource: 'chat', action: 'read', description: 'View configuration chat' },
  { resource: 'chat', action: 'write', description: 'Use AI configuration assistant' },
  { resource: 'chat', action: 'delete', description: 'Delete chat conversations' },
  { resource: 'audit-logs', action: 'view', description: 'View audit logs' },
  { resource: 'audit-logs', action: 'export', description: 'Export audit logs' },
  { resource: 'aws-integrations', action: 'read', description: 'View AWS integrations' },
  { resource: 'aws-integrations', action: 'write', description: 'Create and modify AWS integrations' },
  { resource: 'aws-integrations', action: 'delete', description: 'Delete AWS integrations' },
  { resource: 'aws-integrations', action: 'sync', description: 'Sync AWS instances' },
  { resource: 'aws-integrations', action: 'import', description: 'Import AWS instances as servers' },
  { resource: 'mdm', action: 'read', description: 'View MDM profiles and devices' },
  { resource: 'mdm', action: 'write', description: 'Create and modify MDM profiles' },
  { resource: 'mdm', action: 'execute', description: 'Send commands to MDM devices' },
  { resource: 'mdm', action: 'delete', description: 'Delete MDM profiles' },
  { resource: 'github-integrations', action: 'read', description: 'View GitHub integrations' },
  { resource: 'github-integrations', action: 'write', description: 'Create and modify GitHub integrations' },
  { resource: 'github-integrations', action: 'delete', description: 'Delete GitHub integrations' },
  { resource: 'github-integrations', action: 'validate', description: 'Validate GitHub tokens' },
  { resource: 'github-integrations', action: 'sync', description: 'Sync configurations to GitHub' },
];

// All permissions for admin role
const adminPermissions = systemPermissions.map(p => `${p.resource}:${p.action}`);

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

// Get current organization's feature flags
router.get('/current/features', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'No organization found for user' });
    }

    const [organization] = await db
      .select({ featuresEnabled: organizations.featuresEnabled })
      .from(organizations)
      .where(eq(organizations.id, organizationId));

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Return features with defaults for any missing ones
    const defaultFeatures = {
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
    };

    const features = {
      ...defaultFeatures,
      ...(organization.featuresEnabled || {}),
    };

    res.json({ features });
  } catch (error) {
    console.error('Error fetching organization features:', error);
    res.status(500).json({ error: 'Failed to fetch organization features' });
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
    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 6;
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    // Build search conditions
    let whereCondition = undefined;
    if (search) {
      whereCondition = sql`${organizations.name} ILIKE ${`%${search}%`}`;
    }

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(organizations)
      .where(whereCondition);
    
    const totalOrganizations = totalResult.count as number;
    const totalPages = Math.ceil(totalOrganizations / limit);

    // Get paginated organization data
    let query = db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset(offset);

    if (whereCondition) {
      query = query.where(whereCondition);
    }

    const basicOrgs = await query;

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

    const response = {
      organizations: orgsWithStats,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrganizations,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      }
    };

    console.log(`🔍 Organizations (page ${page}/${totalPages}, search: "${search}"):`, orgsWithStats.length, 'results');
    res.json(response);
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

    // Create RBAC roles for the new organization and assign admin permissions
    await createRBACForOrganization(newOrg[0], newUser[0].id);
    
    console.log(`✅ Created RBAC roles and assigned Administrator permissions to ${newUser[0].email} for organization ${newOrg[0].name}`);

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


// Export the RBAC function for use in admin user creation
export { createRBACForOrganization };

export default router;