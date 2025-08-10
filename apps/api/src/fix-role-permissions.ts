import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { roles, permissions, rolePermissions } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

// Define the admin permissions
const adminPermissions = [
  'dashboard:read', 'settings:read', 'settings:write',
  'users:read', 'users:write', 'users:delete',
  'roles:read', 'roles:write', 'roles:delete',
  'servers:read', 'servers:write', 'servers:delete',
  'server-groups:read', 'server-groups:write', 'server-groups:delete',
  'pem-keys:read', 'pem-keys:write', 'pem-keys:delete',
  'configurations:read', 'configurations:write', 'configurations:delete',
  'deployments:read', 'deployments:write', 'deployments:execute', 'deployments:delete',
  'training:read', 'chat:read', 'chat:write'
];

async function fixRolePermissions() {
  console.log('🔧 Fixing role-permission associations...');
  
  try {
    // Get all Administrator roles
    const adminRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.name, 'Administrator'));
    
    console.log(`📋 Found ${adminRoles.length} Administrator roles`);
    
    // Get all permissions to create a map
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(
      allPermissions.map(p => [`${p.resource}:${p.action}`, p.id])
    );
    
    console.log(`📋 Found ${allPermissions.length} permissions`);
    
    for (const role of adminRoles) {
      console.log(`\n🎭 Processing role: ${role.name} (${role.id})`);
      
      // Check existing permissions for this role
      const existingPerms = await db
        .select({
          permissionId: rolePermissions.permissionId,
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id));
      
      console.log(`  📊 Current permissions: ${existingPerms.length}`);
      
      if (existingPerms.length > 0) {
        console.log('  🗑️ Clearing existing permissions...');
        await db
          .delete(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));
      }
      
      console.log('  ➕ Adding admin permissions...');
      let added = 0;
      
      for (const permissionKey of adminPermissions) {
        const permissionId = permissionMap.get(permissionKey);
        if (permissionId) {
          await db
            .insert(rolePermissions)
            .values({
              roleId: role.id,
              permissionId: permissionId,
            })
            .onConflictDoNothing();
          added++;
        } else {
          console.log(`    ⚠️  Permission not found: ${permissionKey}`);
        }
      }
      
      console.log(`  ✅ Added ${added} permissions to role`);
    }
    
    // Verify the fix
    console.log('\n🔍 Verification:');
    for (const role of adminRoles) {
      const finalPerms = await db
        .select({
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id));
      
      console.log(`  🎭 ${role.name}: ${finalPerms.length} permissions`);
      
      // Check key permissions
      const hasUsersRead = finalPerms.some(p => p.resource === 'users' && p.action === 'read');
      const hasRolesRead = finalPerms.some(p => p.resource === 'roles' && p.action === 'read');
      console.log(`    ${hasUsersRead ? '✅' : '❌'} users:read`);
      console.log(`    ${hasRolesRead ? '✅' : '❌'} roles:read`);
    }
    
    console.log('\n✅ Role-permission fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixRolePermissions();