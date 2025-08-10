import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, roles, userRoles } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function fixCurrentUserRole() {
  const currentUserId = 'ae76aed9-dd6b-4f55-9559-08466a782e73'; // From the logs
  
  console.log(`🔍 Fixing role for user: ${currentUserId}`);
  
  try {
    // Get current user info
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1);
    
    if (!user[0]) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log(`👤 Found user: ${user[0].name} (${user[0].email})`);
    console.log(`🏢 Organization: ${user[0].organizationId}`);
    
    // Find admin role for this organization
    const adminRole = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.name, 'Administrator'),
        eq(roles.organizationId, user[0].organizationId!)
      ))
      .limit(1);
    
    if (!adminRole[0]) {
      console.log('❌ Admin role not found for this organization');
      process.exit(1);
    }
    
    console.log(`👑 Found admin role: ${adminRole[0].name} (${adminRole[0].id})`);
    
    // Check if user already has this role
    const existingRole = await db
      .select()
      .from(userRoles)
      .where(and(
        eq(userRoles.userId, currentUserId),
        eq(userRoles.roleId, adminRole[0].id)
      ))
      .limit(1);
    
    if (existingRole[0]) {
      console.log('✅ User already has admin role');
      
      // Check if it's active
      if (!existingRole[0].isActive) {
        console.log('🔧 Activating existing role...');
        await db
          .update(userRoles)
          .set({ 
            isActive: true
          })
          .where(and(
            eq(userRoles.userId, currentUserId),
            eq(userRoles.roleId, adminRole[0].id)
          ));
        console.log('✅ Role activated');
      }
    } else {
      console.log('🔧 Assigning admin role...');
      await db
        .insert(userRoles)
        .values({
          userId: currentUserId,
          roleId: adminRole[0].id,
          assignedBy: user[0].organizationId!, // Use org owner
          isActive: true,
        });
      console.log('✅ Admin role assigned');
    }
    
    // Verify the assignment
    const finalRoles = await db
      .select({
        roleName: roles.name,
        roleDescription: roles.description,
        isActive: userRoles.isActive,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(
        eq(userRoles.userId, currentUserId),
        eq(userRoles.isActive, true)
      ));
    
    console.log('\n📋 Final User Roles:');
    finalRoles.forEach(role => {
      console.log(`  • ${role.roleName}: ${role.roleDescription}`);
    });
    
    console.log('\n✅ User role fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixCurrentUserRole();