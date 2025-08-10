import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, organizations } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function fixAdmin() {
  try {
    console.log('🔧 Fixing admin user organization link...');

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

    // Find the organization owned by this user
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, adminUser[0].id))
      .limit(1);

    if (org.length === 0) {
      console.log('❌ Organization not found');
      process.exit(1);
    }

    // Update the user to link them to their organization
    await db
      .update(users)
      .set({ organizationId: org[0].id })
      .where(eq(users.id, adminUser[0].id));

    console.log('✅ Fixed admin user organization link');
    console.log(`   User: ${adminUser[0].email}`);
    console.log(`   Organization: ${org[0].name}`);
    console.log(`   Organization ID: ${org[0].id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixAdmin();