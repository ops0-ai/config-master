import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './index';
import { users, organizations } from '@config-management/database';
import { eq } from 'drizzle-orm';

export async function ensureAdminUser() {
  try {
    console.log('🔍 Checking for admin user...');
    
    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@configmaster.dev'))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    console.log('🌱 Creating default admin user...');
    
    // Get or create default organization
    let organization = await db
      .select()
      .from(organizations)
      .limit(1);
    
    if (organization.length === 0) {
      const orgId = randomUUID();
      await db.insert(organizations).values({
        id: orgId,
        name: 'Default Organization',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      organization = await db.select().from(organizations).where(eq(organizations.id, orgId));
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const userId = randomUUID();
    
    await db.insert(users).values({
      id: userId,
      email: 'admin@configmaster.dev',
      password: hashedPassword,
      name: 'Admin User',
      isActive: true,
      organizationId: organization[0].id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log('✅ Default admin user created!');
    console.log('📧 Email: admin@configmaster.dev');
    console.log('🔑 Password: admin123');
    console.log('🌐 Access: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    // Don't crash the app, just log the error
  }
}