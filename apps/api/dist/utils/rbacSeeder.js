"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedRBACData = seedRBACData;
exports.hasPermission = hasPermission;
exports.getUserPermissions = getUserPermissions;
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
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
    { resource: 'servers', action: 'delete', description: 'Delete servers' },
    // Server group permissions
    { resource: 'server-groups', action: 'read', description: 'View server groups' },
    { resource: 'server-groups', action: 'write', description: 'Create and modify server groups' },
    { resource: 'server-groups', action: 'delete', description: 'Delete server groups' },
    // PEM key permissions
    { resource: 'pem-keys', action: 'read', description: 'View PEM keys' },
    { resource: 'pem-keys', action: 'write', description: 'Upload and modify PEM keys' },
    { resource: 'pem-keys', action: 'delete', description: 'Delete PEM keys' },
    // Configuration permissions
    { resource: 'configurations', action: 'read', description: 'View configurations' },
    { resource: 'configurations', action: 'write', description: 'Create and modify configurations' },
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
            'servers:read', 'servers:write', 'servers:delete',
            'server-groups:read', 'server-groups:write', 'server-groups:delete',
            'pem-keys:read', 'pem-keys:write', 'pem-keys:delete',
            'configurations:read', 'configurations:write', 'configurations:delete',
            'deployments:read', 'deployments:write', 'deployments:execute', 'deployments:delete',
            'training:read', 'chat:read', 'chat:write'
        ]
    },
    operator: {
        name: 'Operator',
        description: 'Can manage infrastructure and execute deployments',
        permissions: [
            'dashboard:read', 'settings:read',
            'servers:read', 'servers:write',
            'server-groups:read', 'server-groups:write',
            'pem-keys:read', 'pem-keys:write',
            'configurations:read', 'configurations:write',
            'deployments:read', 'deployments:write', 'deployments:execute',
            'training:read', 'chat:read', 'chat:write'
        ]
    },
    viewer: {
        name: 'Viewer',
        description: 'Read-only access to view infrastructure and deployments',
        permissions: [
            'dashboard:read',
            'servers:read', 'server-groups:read', 'pem-keys:read',
            'configurations:read', 'deployments:read',
            'training:read', 'chat:read'
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
async function seedRBACData() {
    console.log('🌱 Seeding RBAC permissions and roles...');
    try {
        // Insert system permissions (with deduplication)
        console.log('📝 Creating system permissions...');
        for (const perm of systemPermissions) {
            const existingPerm = await index_1.db
                .select()
                .from(database_1.permissions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.permissions.resource, perm.resource), (0, drizzle_orm_1.eq)(database_1.permissions.action, perm.action)))
                .limit(1);
            if (existingPerm.length === 0) {
                await index_1.db
                    .insert(database_1.permissions)
                    .values(perm);
            }
        }
        // Get all permissions for role assignment
        const allPermissions = await index_1.db.select().from(database_1.permissions);
        const permissionMap = new Map(allPermissions.map(p => [`${p.resource}:${p.action}`, p.id]));
        console.log('👑 Creating system roles...');
        // Create roles for each organization
        const orgs = await index_1.db.select().from(database_1.organizations);
        for (const org of orgs) {
            for (const [roleKey, roleData] of Object.entries(systemRoles)) {
                // Check if role already exists
                const existingRole = await index_1.db
                    .select()
                    .from(database_1.roles)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.name, roleData.name), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, org.id)))
                    .limit(1);
                if (existingRole.length === 0) {
                    // Create the role
                    const [newRole] = await index_1.db
                        .insert(database_1.roles)
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
                            await index_1.db
                                .insert(database_1.rolePermissions)
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
                        await index_1.db
                            .insert(database_1.userRoles)
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
        console.log('✅ RBAC seeding completed successfully!');
    }
    catch (error) {
        console.error('❌ RBAC seeding failed:', error);
        throw error;
    }
}
// Helper function to check if user has permission
async function hasPermission(userId, resource, action) {
    try {
        const result = await index_1.db
            .select()
            .from(database_1.userRoles)
            .innerJoin(database_1.roles, (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, database_1.roles.id))
            .innerJoin(database_1.rolePermissions, (0, drizzle_orm_1.eq)(database_1.roles.id, database_1.rolePermissions.roleId))
            .innerJoin(database_1.permissions, (0, drizzle_orm_1.eq)(database_1.rolePermissions.permissionId, database_1.permissions.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true), (0, drizzle_orm_1.eq)(database_1.roles.isActive, true), (0, drizzle_orm_1.eq)(database_1.permissions.resource, resource), (0, drizzle_orm_1.eq)(database_1.permissions.action, action)))
            .limit(1);
        return result.length > 0;
    }
    catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}
// Helper function to get user permissions
async function getUserPermissions(userId) {
    try {
        const result = await index_1.db
            .select({
            resource: database_1.permissions.resource,
            action: database_1.permissions.action,
        })
            .from(database_1.userRoles)
            .innerJoin(database_1.roles, (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, database_1.roles.id))
            .innerJoin(database_1.rolePermissions, (0, drizzle_orm_1.eq)(database_1.roles.id, database_1.rolePermissions.roleId))
            .innerJoin(database_1.permissions, (0, drizzle_orm_1.eq)(database_1.rolePermissions.permissionId, database_1.permissions.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true), (0, drizzle_orm_1.eq)(database_1.roles.isActive, true)));
        return result;
    }
    catch (error) {
        console.error('Error getting user permissions:', error);
        return [];
    }
}
//# sourceMappingURL=rbacSeeder.js.map