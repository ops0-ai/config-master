import { db } from '../index';
import { permissions, roles, rolePermissions, userRoles, organizations, users, mdmProfiles } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// Define system permissions
const systemPermissions = [
  // Dashboard permissions
  { resource: 'dashboard', action: 'read', description: 'View dashboard and analytics' },
  
  // Settings permissions  
  { resource: 'settings', action: 'read', description: 'View organization settings' },
  { resource: 'settings', action: 'write', description: 'Modify organization settings' },
  
  // User management permissions
  { resource: 'users', action: 'read', description: 'View users and roles' },
  { resource: 'users', action: 'write', description: 'Create and modify users' },
  { resource: 'users', action: 'delete', description: 'Delete users' },
  
  // Role management permissions
  { resource: 'roles', action: 'read', description: 'View roles and permissions' },
  { resource: 'roles', action: 'write', description: 'Create and modify roles' },
  { resource: 'roles', action: 'delete', description: 'Delete roles' },
  
  // Server management permissions
  { resource: 'servers', action: 'read', description: 'View servers' },
  { resource: 'servers', action: 'write', description: 'Create and modify servers' },
  { resource: 'servers', action: 'execute', description: 'Test server connections' },
  { resource: 'servers', action: 'delete', description: 'Delete servers' },
  
  // Server group permissions
  { resource: 'server-groups', action: 'read', description: 'View server groups' },
  { resource: 'server-groups', action: 'write', description: 'Create and modify server groups' },
  { resource: 'server-groups', action: 'execute', description: 'Manage server group operations' },
  { resource: 'server-groups', action: 'delete', description: 'Delete server groups' },
  
  // PEM key permissions
  { resource: 'pem-keys', action: 'read', description: 'View PEM keys' },
  { resource: 'pem-keys', action: 'write', description: 'Upload and modify PEM keys' },
  { resource: 'pem-keys', action: 'execute', description: 'Test PEM key connections' },
  { resource: 'pem-keys', action: 'delete', description: 'Delete PEM keys' },
  
  // Configuration permissions
  { resource: 'configurations', action: 'read', description: 'View configurations' },
  { resource: 'configurations', action: 'write', description: 'Create and modify configurations' },
  { resource: 'configurations', action: 'execute', description: 'Validate and test configurations' },
  { resource: 'configurations', action: 'approve', description: 'Approve or reject configurations for deployment' },
  { resource: 'configurations', action: 'delete', description: 'Delete configurations' },
  
  // Deployment permissions
  { resource: 'deployments', action: 'read', description: 'View deployments' },
  { resource: 'deployments', action: 'write', description: 'Create and modify deployments' },
  { resource: 'deployments', action: 'execute', description: 'Execute and redeploy configurations' },
  { resource: 'deployments', action: 'delete', description: 'Delete deployments' },
  
  // Training permissions
  { resource: 'training', action: 'read', description: 'Access infrastructure training modules' },
  
  // Chat permissions
  { resource: 'chat', action: 'read', description: 'View configuration chat' },
  { resource: 'chat', action: 'write', description: 'Use AI configuration assistant' },
  { resource: 'chat', action: 'delete', description: 'Delete chat conversations' },
  
  // Audit log permissions
  { resource: 'audit-logs', action: 'view', description: 'View audit logs' },
  { resource: 'audit-logs', action: 'export', description: 'Export audit logs' },
  
  // AWS integration permissions
  { resource: 'aws-integrations', action: 'read', description: 'View AWS integrations' },
  { resource: 'aws-integrations', action: 'write', description: 'Create and modify AWS integrations' },
  { resource: 'aws-integrations', action: 'delete', description: 'Delete AWS integrations' },
  
  // MDM permissions
  { resource: 'mdm', action: 'read', description: 'View MDM profiles and devices' },
  { resource: 'mdm', action: 'write', description: 'Create and modify MDM profiles' },
  { resource: 'mdm', action: 'execute', description: 'Send commands to MDM devices' },
  { resource: 'mdm', action: 'delete', description: 'Delete MDM profiles' },
  
  // AWS integration additional permissions
  { resource: 'aws-integrations', action: 'sync', description: 'Sync AWS instances' },
  { resource: 'aws-integrations', action: 'import', description: 'Import AWS instances as servers' },
  
  // GitHub integration permissions
  { resource: 'github-integrations', action: 'read', description: 'View GitHub integrations' },
  { resource: 'github-integrations', action: 'write', description: 'Create and modify GitHub integrations' },
  { resource: 'github-integrations', action: 'delete', description: 'Delete GitHub integrations' },
  { resource: 'github-integrations', action: 'validate', description: 'Validate GitHub tokens' },
  { resource: 'github-integrations', action: 'sync', description: 'Sync configurations to GitHub' },
  
  // Asset management permissions
  { resource: 'asset', action: 'read', description: 'View assets and asset details' },
  { resource: 'asset', action: 'create', description: 'Create new assets' },
  { resource: 'asset', action: 'update', description: 'Update asset information' },
  { resource: 'asset', action: 'delete', description: 'Delete assets' },
  { resource: 'asset', action: 'assign', description: 'Assign assets to users and manage assignments' },
  { resource: 'asset', action: 'import', description: 'Import assets from CSV files' },
  { resource: 'asset', action: 'export', description: 'Export assets to CSV files' },
];

// Define system roles with their permissions
const systemRoles = {
  admin: {
    name: 'Administrator',
    description: 'Full access to all platform features and settings',
    permissions: [
      'dashboard:read', 'settings:read', 'settings:write',
      'users:read', 'users:write', 'users:delete',
      'roles:read', 'roles:write', 'roles:delete',
      'servers:read', 'servers:write', 'servers:execute', 'servers:delete',
      'server-groups:read', 'server-groups:write', 'server-groups:execute', 'server-groups:delete',
      'pem-keys:read', 'pem-keys:write', 'pem-keys:execute', 'pem-keys:delete',
      'configurations:read', 'configurations:write', 'configurations:execute', 'configurations:approve', 'configurations:delete',
      'deployments:read', 'deployments:write', 'deployments:execute', 'deployments:delete',
      'training:read', 'chat:read', 'chat:write', 'chat:delete',
      'audit-logs:view', 'audit-logs:export',
      'aws-integrations:read', 'aws-integrations:write', 'aws-integrations:delete', 
      'aws-integrations:sync', 'aws-integrations:import',
      'github-integrations:read', 'github-integrations:write', 'github-integrations:delete',
      'mdm:read', 'mdm:write', 'mdm:execute', 'mdm:delete',
      'github-integrations:validate', 'github-integrations:sync',
      'asset:read', 'asset:create', 'asset:update', 'asset:delete', 'asset:assign', 'asset:import', 'asset:export'
    ]
  },
  operator: {
    name: 'Operator',
    description: 'Can manage infrastructure and execute deployments',
    permissions: [
      'dashboard:read', 'settings:read',
      'servers:read', 'servers:write', 'servers:execute',
      'server-groups:read', 'server-groups:write', 'server-groups:execute',
      'pem-keys:read', 'pem-keys:write', 'pem-keys:execute',
      'configurations:read', 'configurations:write', 'configurations:execute',
      'deployments:read', 'deployments:write', 'deployments:execute',
      'training:read', 'chat:read', 'chat:write', 'chat:delete',
      'aws-integrations:read', 'aws-integrations:sync', 'aws-integrations:import',
      'github-integrations:read', 'github-integrations:write', 'github-integrations:validate', 'github-integrations:sync',
      'mdm:read', 'mdm:write', 'mdm:execute',
      'audit-logs:view',
      'asset:read', 'asset:create', 'asset:update', 'asset:assign', 'asset:import', 'asset:export'
    ]
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to view infrastructure and deployments',
    permissions: [
      'dashboard:read',
      'servers:read', 'server-groups:read', 'pem-keys:read',
      'configurations:read', 'deployments:read',
      'training:read', 'chat:read',
      'asset:read'
    ]
  },
  trainee: {
    name: 'Trainee',
    description: 'Access to training modules only',
    permissions: [
      'training:read'
    ]
  }
};

export async function seedRBACData() {
  console.log('🌱 Seeding RBAC permissions and roles...');
  
  try {
    // Insert system permissions (with deduplication)
    console.log('📝 Creating system permissions...');
    for (const perm of systemPermissions) {
      const existingPerm = await db
        .select()
        .from(permissions)
        .where(and(
          eq(permissions.resource, perm.resource),
          eq(permissions.action, perm.action)
        ))
        .limit(1);
      
      if (existingPerm.length === 0) {
        await db
          .insert(permissions)
          .values(perm);
      }
    }
    
    // Get all permissions for role assignment
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(
      allPermissions.map(p => [`${p.resource}:${p.action}`, p.id])
    );
    
    console.log('👑 Creating system roles...');
    
    // Create roles for each organization
    const orgs = await db.select().from(organizations);
    
    for (const org of orgs) {
      for (const [roleKey, roleData] of Object.entries(systemRoles)) {
        // Check if role already exists
        const existingRole = await db
          .select()
          .from(roles)
          .where(and(
            eq(roles.name, roleData.name),
            eq(roles.organizationId, org.id)
          ))
          .limit(1);
        
        if (existingRole.length === 0) {
          // Create the role
          const [newRole] = await db
            .insert(roles)
            .values({
              name: roleData.name,
              description: roleData.description,
              organizationId: org.id,
              isSystem: true,
              createdBy: org.ownerId,
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
          
          console.log(`  ✅ Created role: ${roleData.name} for organization ${org.name}`);
          
          // Assign admin role to organization owner
          if (roleKey === 'admin') {
            await db
              .insert(userRoles)
              .values({
                userId: org.ownerId,
                roleId: newRole.id,
                assignedBy: org.ownerId,
              })
              .onConflictDoNothing();
            
            console.log(`  👤 Assigned admin role to organization owner`);
          }
        }
      }
    }
    
    // Ensure each organization has a default MDM profile
    await ensureDefaultMDMProfiles(orgs);
    
    console.log('✅ RBAC seeding completed successfully!');
  } catch (error) {
    console.error('❌ RBAC seeding failed:', error);
    throw error;
  }
}

// Function to ensure each organization has a default MDM profile with unique enrollment key
async function ensureDefaultMDMProfiles(organizations: any[]): Promise<void> {
  console.log('🔐 Ensuring default MDM profiles for organizations...');
  
  for (const org of organizations) {
    try {
      // Check if organization already has an MDM profile
      const existingProfile = await db
        .select()
        .from(mdmProfiles)
        .where(eq(mdmProfiles.organizationId, org.id))
        .limit(1);
      
      if (existingProfile.length === 0) {
        // Generate unique enrollment key for this organization
        const enrollmentKey = crypto.randomBytes(32).toString('hex');
        
        // Create default MDM profile
        await db
          .insert(mdmProfiles)
          .values({
            name: `${org.name} Default MDM Profile`,
            description: 'Default MDM profile created automatically for organization',
            organizationId: org.id,
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
            createdBy: org.ownerId,
          });
        
        console.log(`  ✅ Created default MDM profile for organization: ${org.name}`);
        console.log(`  🔑 Enrollment key: ${enrollmentKey}`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Failed to create MDM profile for organization ${org.name}:`, error);
    }
  }
}

// Helper function to check if user has permission
export async function hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
  try {
    // First check if user has super_admin role directly in users table (for default admin)
    const userResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (userResult.length > 0 && userResult[0].role === 'super_admin') {
      return true; // Super admin has access to everything
    }
    
    // Then check role-based permissions
    const result = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.isActive, true),
          eq(roles.isActive, true),
          eq(permissions.resource, resource),
          eq(permissions.action, action)
        )
      )
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

// Helper function to get user permissions
export async function getUserPermissions(userId: string): Promise<Array<{resource: string, action: string}>> {
  try {
    const result = await db
      .select({
        resource: permissions.resource,
        action: permissions.action,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.isActive, true),
          eq(roles.isActive, true)
        )
      );
    
    return result;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}