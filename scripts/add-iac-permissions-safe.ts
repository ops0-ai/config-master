import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, or } from 'drizzle-orm';
import { config } from 'dotenv';
import { roles, permissions, rolePermissions } from '@config-management/database';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function addIACPermissionsSafely() {
  console.log('🔧 SAFELY adding IAC permissions to existing roles...');
  console.log('⚠️  This will ONLY ADD permissions, not remove any existing ones');
  
  try {
    // Get all Administrator and Operator roles
    const allRoles = await db
      .select()
      .from(roles)
      .where(or(eq(roles.name, 'Administrator'), eq(roles.name, 'Operator')));
    
    console.log(`📋 Found ${allRoles.length} roles to update`);
    
    // Get all permissions to create a map
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(
      allPermissions.map(p => [`${p.resource}:${p.action}`, p.id])
    );
    
    console.log(`📋 Found ${allPermissions.length} permissions`);
    
    // IAC and AI Assistant permissions to add
    const permissionsToAdd = [
      'iac:read', 'iac:write', 'iac:execute',
      'ai-assistant:read', 'ai-assistant:write', 'ai-assistant:execute', 'ai-assistant:delete'
    ];
    
    for (const role of allRoles) {
      console.log(`\n🎭 Processing role: ${role.name} (${role.id})`);
      
      // Check existing permissions for this role
      const existingPerms = await db
        .select({
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(
          eq(rolePermissions.roleId, role.id) && 
          (eq(permissions.resource, 'iac') || eq(permissions.resource, 'ai-assistant'))
        );
      
      console.log(`  📊 Existing IAC/AI Assistant permissions: ${existingPerms.length}`);
      
      let added = 0;
      let skipped = 0;
      
      for (const permissionKey of permissionsToAdd) {
        const permissionId = permissionMap.get(permissionKey);
        if (permissionId) {
          // Check if permission already exists
          const [resource, action] = permissionKey.split(':');
          const alreadyExists = existingPerms.some(p => 
            p.resource === resource && p.action === action
          );
          
          if (alreadyExists) {
            console.log(`    ⏭️  Skipped ${permissionKey} (already exists)`);
            skipped++;
          } else {
            try {
              await db
                .insert(rolePermissions)
                .values({
                  roleId: role.id,
                  permissionId: permissionId,
                })
                .onConflictDoNothing();
              added++;
              console.log(`    ✅ Added ${permissionKey}`);
            } catch (error) {
              console.log(`    ⚠️  Error adding ${permissionKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } else {
          console.log(`    ⚠️  Permission not found: ${permissionKey}`);
        }
      }
      
      console.log(`  📊 Summary: ${added} added, ${skipped} skipped`);
    }
    
    // Verify the fix
    console.log('\n🔍 Verification:');
    for (const role of allRoles) {
      const finalPerms = await db
        .select({
          resource: permissions.resource,
          action: permissions.action,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, role.id));
      
      const iacPerms = finalPerms.filter(p => p.resource === 'iac');
      const aiAssistantPerms = finalPerms.filter(p => p.resource === 'ai-assistant');
      console.log(`  🎭 ${role.name}: ${iacPerms.length} IAC permissions, ${aiAssistantPerms.length} AI Assistant permissions`);
      
      for (const perm of [...iacPerms, ...aiAssistantPerms]) {
        console.log(`    ✅ ${perm.resource}:${perm.action}`);
      }
    }
    
    console.log('\n✅ IAC and AI Assistant permissions safely added!');
    console.log('🔒 All existing permissions were preserved');
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

addIACPermissionsSafely();
