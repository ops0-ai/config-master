import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, roles, userRoles, rolePermissions, permissions } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function debugUserPermissions() {
  const currentUserId = 'ae76aed9-dd6b-4f55-9559-08466a782e73';
  
  console.log(`🔍 Debugging permissions for user: ${currentUserId}\n`);
  
  try {
    // Get user info
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1);
    
    if (!user[0]) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`👤 User: ${user[0].name} (${user[0].email})`);
    console.log(`🏢 Organization: ${user[0].organizationId}`);
    console.log(`📅 Created: ${user[0].createdAt}\n`);
    
    // Get all user roles with details
    const userRoleDetails = await db
      .select({
        roleId: roles.id,
        roleName: roles.name,
        roleDescription: roles.description,
        isSystem: roles.isSystem,
        roleActive: roles.isActive,
        userRoleActive: userRoles.isActive,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, currentUserId));
    
    console.log(`📋 User Roles (${userRoleDetails.length}):`);
    if (userRoleDetails.length === 0) {
      console.log('  ❌ No roles assigned to this user!\n');
    } else {
      userRoleDetails.forEach(role => {
        console.log(`  • ${role.roleName}: ${role.roleDescription}`);
        console.log(`    Role ID: ${role.roleId}`);
        console.log(`    System Role: ${role.isSystem}`);
        console.log(`    Role Active: ${role.roleActive}`);
        console.log(`    User Role Active: ${role.userRoleActive}`);
        console.log(`    Assigned: ${role.assignedAt}`);
        console.log('');
      });
    }
    
    // Get all permissions for this user
    const userPermissions = await db
      .select({
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(userRoles.userId, currentUserId),
        eq(userRoles.isActive, true),
        eq(roles.isActive, true)
      ));
    
    console.log(`🔑 User Permissions (${userPermissions.length}):`);
    if (userPermissions.length === 0) {
      console.log('  ❌ No permissions found!\n');
    } else {
      const permissionsByResource: Record<string, any[]> = {};
      userPermissions.forEach(perm => {
        if (!permissionsByResource[perm.resource]) {
          permissionsByResource[perm.resource] = [];
        }
        permissionsByResource[perm.resource].push(perm);
      });
      
      Object.entries(permissionsByResource).forEach(([resource, perms]) => {
        console.log(`  📂 ${resource}:`);
        perms.forEach(perm => {
          console.log(`    ✓ ${perm.action} (via ${perm.roleName})`);
        });
      });
      console.log('');
    }
    
    // Test specific permissions
    const testPermissions = [
      { resource: 'users', action: 'read' },
      { resource: 'roles', action: 'read' },
      { resource: 'roles', action: 'write' },
    ];
    
    console.log('🧪 Testing Specific Permissions:');
    for (const testPerm of testPermissions) {
      const hasIt = userPermissions.some(p => 
        p.resource === testPerm.resource && p.action === testPerm.action
      );
      console.log(`  ${hasIt ? '✅' : '❌'} ${testPerm.resource}:${testPerm.action}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

debugUserPermissions();