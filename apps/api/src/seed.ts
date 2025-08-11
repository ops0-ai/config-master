import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, organizations } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Create demo organization first (without owner reference)
    const org = await db.insert(organizations).values({
      name: 'Demo Organization',
      description: 'Demo organization for testing',
      ownerId: 'temp-placeholder', // Temporary placeholder
    }).returning();

    console.log('✓ Created demo organization:', org[0].name);

    // Create demo user with organization reference
    const passwordHash = await bcrypt.hash('demo123', 10);
    
    const user = await db.insert(users).values({
      email: 'admin@pulse.dev',
      name: 'Demo Admin',
      passwordHash,
      role: 'admin',
      organizationId: org[0].id, // Link user to organization
    }).returning();

    console.log('✓ Created demo user:', user[0].email);

    // Update organization to set the correct owner
    await db.update(organizations)
      .set({ ownerId: user[0].id })
      .where(eq(organizations.id, org[0].id));

    console.log('✓ Linked user as organization owner');

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('   Email: admin@pulse.dev');
    console.log('   Password: demo123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();