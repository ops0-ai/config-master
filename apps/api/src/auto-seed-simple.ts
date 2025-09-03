import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, organizations, userOrganizations, mdmProfiles } from '@config-management/database';
import { eq, sql } from 'drizzle-orm';
import * as crypto from 'crypto';

// Create database connection for admin seeding
const getDb = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/config_management';
  const queryClient = postgres(connectionString);
  return drizzle(queryClient);
};

// Create default MDM profile with unique enrollment key
async function createDefaultMDMProfile(db: any, organizationId: string, createdBy: string): Promise<string> {
  try {
    // Generate unique enrollment key
    const enrollmentKey = crypto.randomBytes(32).toString('hex');
    
    // Create default MDM profile
    await db.insert(mdmProfiles).values({
      name: 'Default MacOS Profile',
      description: 'Default MDM profile for MacOS devices - automatically created',
      organizationId: organizationId,
      profileType: 'macos',
      allowRemoteCommands: true,
      allowLockDevice: true,
      allowShutdown: false,
      allowRestart: true,
      allowWakeOnLan: true,
      requireAuthentication: true,
      maxSessionDuration: 3600,
      allowedIpRanges: [],
      enrollmentKey: enrollmentKey,
      enrollmentExpiresAt: null, // No expiration
      isActive: true,
      createdBy: createdBy,
    });
    
    console.log(`✅ Created default MDM profile for organization ${organizationId} with key: ${enrollmentKey}`);
    return enrollmentKey;
    
  } catch (error) {
    console.error('❌ Failed to create default MDM profile:', error);
    throw error;
  }
}

export async function ensureAdminUser() {
  try {
    console.log('🔍 Checking for default admin user...');
    
    const db = getDb();
    
    // Get admin credentials from environment variables
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@pulse.dev';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';
    
    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      console.log('✅ Default admin user already exists');
      return;
    }
    
    console.log('🌱 Creating default admin user...');
    
    // Create admin user first
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUserId = randomUUID();
    const orgId = randomUUID();
    
    // Create organization with admin as owner
    await db.insert(organizations).values({
      id: orgId,
      name: 'Pulse Admin Organization',
      description: 'Default admin organization for Pulse MDM',
      ownerId: adminUserId,
      isActive: true,
      isPrimary: true, // First organization is always primary
    });
    
    // Create admin user with super_admin role for full access
    // Check if is_super_admin column exists first
    let userValues: any = {
      id: adminUserId,
      email: adminEmail,
      passwordHash: hashedPassword,
      name: 'Pulse Admin',
      role: 'super_admin',
      organizationId: orgId,
    };
    
    // Only add isSuperAdmin if the column exists (for compatibility)
    try {
      // Check if column exists by running a simple query
      await db.execute(sql`SELECT is_super_admin FROM users LIMIT 1`);
      userValues.isSuperAdmin = true; // Essential for multi-tenancy features
    } catch (error) {
      console.log('⚠️ is_super_admin column not found, creating user without it (will be added by migration)');
    }
    
    await db.insert(users).values(userValues);
    
    // Create user-organization relationship
    await db.insert(userOrganizations).values({
      userId: adminUserId,
      organizationId: orgId,
      role: 'owner',
      isActive: true,
    });
    
    // Create RBAC system for the admin organization
    try {
      // Import the RBAC function from organizations route
      const { createRBACForOrganization } = await import('./routes/organizations');
      await createRBACForOrganization({ id: orgId, name: 'Pulse Admin Organization' }, adminUserId);
      console.log('✅ RBAC system created for admin organization');
    } catch (error) {
      console.error('Warning: Failed to create RBAC system for admin organization:', error);
    }
    
    // Create default MDM profile for the organization
    try {
      const enrollmentKey = await createDefaultMDMProfile(db, orgId, adminUserId);
      console.log(`📱 MDM enrollment key: ${enrollmentKey}`);
    } catch (error) {
      console.error('Warning: Failed to create default MDM profile for admin user:', error);
    }
    
    console.log('✅ Default admin user created successfully!');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log('👑 Role: Super Admin (Full Access)');
    console.log('🌐 Access: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    // Don't crash the app, just log the error
  }
}

// Function to ensure all existing organizations have default MDM profiles
export async function ensureDefaultMDMProfiles() {
  try {
    console.log('🔍 Ensuring all organizations have default MDM profiles...');
    
    const db = getDb();
    
    // Get all organizations
    const allOrgs = await db.select({
      orgId: organizations.id,
      ownerId: organizations.ownerId,
      name: organizations.name
    }).from(organizations);
    
    for (const org of allOrgs) {
      const existingProfile = await db
        .select()
        .from(mdmProfiles)
        .where(eq(mdmProfiles.organizationId, org.orgId))
        .limit(1);
      
      if (existingProfile.length === 0) {
        console.log(`🔧 Creating default MDM profile for organization: ${org.name}`);
        try {
          await createDefaultMDMProfile(db, org.orgId, org.ownerId);
        } catch (error) {
          console.error(`❌ Failed to create MDM profile for ${org.name}:`, error);
        }
      } else {
        console.log(`✅ Organization ${org.name} already has MDM profile`);
      }
    }
    
    console.log('✅ All organizations now have default MDM profiles');
    
  } catch (error) {
    console.error('❌ Failed to ensure default MDM profiles:', error);
  }
}