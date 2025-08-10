import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, organizations, userRoles, roles } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function checkAdminRoles() {
  try {
    console.log('🔍 Checking admin user roles...');

    // Find the admin user
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@configmaster.dev'))
      .limit(1);

    if (adminUser.length === 0) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log(`✓ Found admin user: ${adminUser[0].email}`);
    console.log(`  Organization ID: ${adminUser[0].organizationId}`);

    // Get user's roles
    const userRolesList = await db
      .select({
        roleName: roles.name,
        roleDescription: roles.description,
        isActive: userRoles.isActive,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, adminUser[0].id));

    console.log(`\n📋 User Roles (${userRolesList.length}):`);
    for (const role of userRolesList) {
      console.log(`  • ${role.roleName}: ${role.roleDescription}`);
      console.log(`    Active: ${role.isActive}, Assigned: ${role.assignedAt}`);
    }

    // Check if Administrator role exists in the organization
    const adminRole = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.name, 'Administrator'),
          eq(roles.organizationId, adminUser[0].organizationId!)
        )
      )
      .limit(1);

    if (adminRole.length === 0) {
      console.log('\n❌ Administrator role not found in organization');
    } else {
      console.log('\n✓ Administrator role exists in organization');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

checkAdminRoles();