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
    
    // Create admin user first
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUserId = randomUUID();
    const orgId = randomUUID();
    
    // Create organization with admin as owner
    await db.insert(organizations).values({
      id: orgId,
      name: 'Default Organization',
      description: 'Default organization for ConfigMaster',
      ownerId: adminUserId,
    });
    
    // Create admin user
    await db.insert(users).values({
      id: adminUserId,
      email: 'admin@configmaster.dev',
      passwordHash: hashedPassword,
      name: 'Admin User',
      role: 'admin',
      organizationId: orgId,
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