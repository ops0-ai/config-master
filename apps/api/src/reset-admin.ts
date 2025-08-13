import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, organizations, userOrganizations } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function resetAdminUser() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/config_management';
  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log('🔧 Resetting admin user...');
    
    // Delete existing admin user and their organization relationships
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@configmaster.dev'))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('📝 Admin user exists, updating password...');
      
      // Just update the existing user's password instead of deleting
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await db
        .update(users)
        .set({ 
          passwordHash: hashedPassword,
          isActive: true,
          role: 'admin'
        })
        .where(eq(users.email, 'admin@configmaster.dev'));
      
      // Ensure user is in an organization
      const userId = existingAdmin[0].id;
      const orgId = existingAdmin[0].organizationId;
      
      if (orgId) {
        // Check if user-organization relationship exists
        const existingRelation = await db
          .select()
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, userId))
          .limit(1);
        
        if (existingRelation.length === 0) {
          await db.insert(userOrganizations).values({
            id: randomUUID(),
            userId: userId,
            organizationId: orgId,
            role: 'owner',
            isActive: true,
          });
        }
      }
      
      console.log('✅ Admin password reset successfully!');
      console.log('📧 Email: admin@configmaster.dev');
      console.log('🔑 Password: admin123');
      console.log('');
      console.log('You can now login with these credentials.');
      
      await client.end();
      process.exit(0);
    }
    
    // Create new admin user
    console.log('🌱 Creating new admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUserId = randomUUID();
    
    // Find or create default organization
    let orgId: string;
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, 'Default Organization'))
      .limit(1);
    
    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      console.log('📁 Using existing Default Organization');
      
      // Update the owner
      await db
        .update(organizations)
        .set({ ownerId: adminUserId })
        .where(eq(organizations.id, orgId));
    } else {
      orgId = randomUUID();
      console.log('📁 Creating Default Organization');
      
      await db.insert(organizations).values({
        id: orgId,
        name: 'Default Organization',
        description: 'Default organization for ConfigMaster',
        ownerId: adminUserId,
      });
    }
    
    // Create admin user
    await db.insert(users).values({
      id: adminUserId,
      email: 'admin@configmaster.dev',
      passwordHash: hashedPassword,
      name: 'Admin User',
      role: 'admin',
      organizationId: orgId,
      isActive: true,
    });
    
    // Add user to organization
    await db.insert(userOrganizations).values({
      id: randomUUID(),
      userId: adminUserId,
      organizationId: orgId,
      role: 'owner',
      isActive: true,
    });
    
    console.log('✅ Admin user reset successfully!');
    console.log('📧 Email: admin@configmaster.dev');
    console.log('🔑 Password: admin123');
    console.log('🌐 Organization: Default Organization');
    console.log('');
    console.log('You can now login with these credentials.');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to reset admin user:', error);
    await client.end();
    process.exit(1);
  }
}

resetAdminUser();