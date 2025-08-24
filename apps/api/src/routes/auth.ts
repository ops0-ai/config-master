import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { users, organizations, mdmProfiles, roles, permissions, rolePermissions, userRoles, systemSettings } from '@config-management/database';
import { eq, sql } from 'drizzle-orm';
import Joi from 'joi';
import * as crypto from 'crypto';

const router = Router();

// Create default MDM profile with unique enrollment key
async function createDefaultMDMProfile(organizationId: string, createdBy: string): Promise<string> {
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

// Create RBAC roles and permissions for a new registered user
async function createRBACForNewUser(organization: any, user: any) {
  try {
    console.log(`🔐 Setting up RBAC for new user ${user.email} in organization ${organization.name}`);
    
    // Get all system permissions (they should already exist from rbacSeeder)
    const allPermissions = await db.select().from(permissions);
    const permissionMap = new Map(allPermissions.map(p => [`${p.resource}:${p.action}`, p.id]));
    
    // Create Administrator role for the organization
    const [adminRole] = await db
      .insert(roles)
      .values({
        name: 'Administrator',
        description: 'Full access to all platform features and settings',
        organizationId: organization.id,
        isSystem: true,
        createdBy: user.id,
      })
      .returning();
    
    // Assign ALL permissions to Administrator role - get dynamically from database
    const allPermissionKeys = allPermissions.map(p => `${p.resource}:${p.action}`);
    console.log(`  📋 Found ${allPermissions.length} total permissions in system`);
    
    let assignedPermissions = 0;
    for (const permissionKey of allPermissionKeys) {
      const permissionId = permissionMap.get(permissionKey);
      if (permissionId) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: adminRole.id,
            permissionId: permissionId,
          })
          .onConflictDoNothing();
        assignedPermissions++;
      }
    }
    
    // Assign Administrator role to the user
    await db
      .insert(userRoles)
      .values({
        userId: user.id,
        roleId: adminRole.id,
        assignedBy: user.id,
        isActive: true,
      })
      .onConflictDoNothing();
    
    console.log(`✅ RBAC setup complete: User ${user.email} is now Administrator with ${assignedPermissions} permissions`);
  } catch (error) {
    console.error('Error creating RBAC for new user:', error);
    throw error;
  }
}

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().required(),
  organizationName: Joi.string().required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post('/register', async (req, res): Promise<any> => {
  try {
    // Check if user registration is enabled
    const registrationSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'user_registration_enabled'))
      .limit(1);

    const registrationEnabled = registrationSetting[0]?.value === true || registrationSetting[0]?.value === 'true';
    
    if (!registrationEnabled) {
      const supportContact = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'support_contact'))
        .limit(1);
      
      const supportEmail = supportContact[0]?.value || 'support@pulse.dev';
      
      return res.status(403).json({ 
        error: 'User registration is currently disabled', 
        message: `New user registration is not available at this time. Please contact ${supportEmail} for assistance.`,
        supportContact: supportEmail
      });
    }

    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, value.email))
      .limit(1);

    if (existingUser[0]) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, 10);

    // Generate a temporary user ID first
    const userId = crypto.randomUUID();

    // Create organization with the user ID
    const newOrg = await db.insert(organizations).values({
      name: value.organizationName,
      ownerId: userId,
      isActive: true,
    }).returning();

    // Create user with the pre-generated ID and organizationId
    // Handle missing columns safely during migration
    let newUser;
    try {
      newUser = await db.insert(users).values({
        id: userId,
        email: value.email,
        name: value.name,
        passwordHash,
        role: 'admin',
        organizationId: newOrg[0].id,
        isActive: true,
        isSuperAdmin: false,
        hasCompletedOnboarding: false,
      }).returning();
    } catch (error: any) {
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        // Fallback creation without new columns
        newUser = await db.insert(users).values({
          id: userId,
          email: value.email,
          name: value.name,
          passwordHash,
          role: 'admin',
          organizationId: newOrg[0].id,
          isActive: true,
        }).returning();
        
        // Add missing properties for compatibility
        if (newUser[0]) {
          (newUser[0] as any).isSuperAdmin = false;
          (newUser[0] as any).hasCompletedOnboarding = false;
        }
      } else {
        throw error;
      }
    }

    // Create RBAC roles and permissions for the new organization
    try {
      await createRBACForNewUser(newOrg[0], newUser[0]);
    } catch (error) {
      console.error('Warning: Failed to create RBAC during registration:', error);
      // Don't fail registration if RBAC creation fails
    }

    // Create default MDM profile for the new organization
    try {
      await createDefaultMDMProfile(newOrg[0].id, newUser[0].id);
    } catch (error) {
      console.error('Warning: Failed to create default MDM profile during registration:', error);
      // Don't fail registration if MDM profile creation fails
    }

    // Generate JWT
    const newUserRecord = newUser[0] as any;
    const token = jwt.sign(
      {
        userId: newUserRecord.id,
        email: newUserRecord.email,
        organizationId: newOrg[0].id,
        isSuperAdmin: newUserRecord.isSuperAdmin || false,
        hasCompletedOnboarding: newUserRecord.hasCompletedOnboarding || false,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        role: newUser[0].role,
      },
      organization: {
        id: newOrg[0].id,
        name: newOrg[0].name,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res): Promise<any> => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Find user - handle missing columns safely during migration
    let user;
    try {
      user = await db
        .select()
        .from(users)
        .where(eq(users.email, value.email))
        .limit(1);
    } catch (error: any) {
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        // Fallback query without new columns
        user = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            passwordHash: users.passwordHash,
            role: users.role,
            organizationId: users.organizationId,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.email, value.email))
          .limit(1);
        
        // Add missing properties for compatibility
        if (user[0]) {
          (user[0] as any).isSuperAdmin = false;
          (user[0] as any).hasCompletedOnboarding = false;
        }
      } else {
        throw error;
      }
    }

    if (!user[0]) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(value.password, user[0].passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user's organization (either owned by user or user is a member)
    let org;
    if (user[0].organizationId) {
      // User has organizationId set, use that
      org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user[0].organizationId))
        .limit(1);
    } else {
      // Fallback: find organization owned by user
      org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.ownerId, user[0].id))
        .limit(1);
    }

    if (!org[0]) {
      return res.status(500).json({ error: 'Organization not found' });
    }

    // Check if organization is active
    if (!org[0].isActive) {
      return res.status(403).json({ 
        error: 'Organization has been disabled. Please contact your global administrator for assistance.',
        code: 'ORGANIZATION_DISABLED'
      });
    }

    // Check if user is active
    if (!user[0].isActive) {
      return res.status(403).json({ 
        error: 'Your account has been disabled. Please contact your administrator.',
        code: 'USER_DISABLED'
      });
    }

    // Generate JWT with safe access to optional columns
    const userRecord = user[0] as any;
    const token = jwt.sign(
      {
        userId: userRecord.id,
        email: userRecord.email,
        organizationId: org[0].id,
        isSuperAdmin: userRecord.isSuperAdmin || false,
        hasCompletedOnboarding: userRecord.hasCompletedOnboarding || false,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        role: userRecord.role,
        isSuperAdmin: userRecord.isSuperAdmin || false,
      },
      organization: {
        id: org[0].id,
        name: org[0].name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password endpoint for authenticated users
router.post('/change-password', async (req: any, res): Promise<any> => {
  try {
    // Get user from auth token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.cookies?.['auth-token'];
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const changePasswordSchema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).required(),
      confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({ 'any.only': 'Passwords do not match' })
    });

    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;

    // Get current user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .update(users)
      .set({ 
        passwordHash: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, decoded.userId));

    console.log(`✅ Password changed successfully for user: ${user.email}`);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Public endpoint to check if registration is enabled
router.get('/registration-status', async (req, res): Promise<any> => {
  try {
    const registrationSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'user_registration_enabled'))
      .limit(1);

    const supportContactSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'support_contact'))
      .limit(1);

    const platformNameSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'platform_name'))
      .limit(1);

    const registrationEnabled = registrationSetting[0]?.value === true || registrationSetting[0]?.value === 'true';
    const supportContact = supportContactSetting[0]?.value || 'support@pulse.dev';
    const platformName = platformNameSetting[0]?.value || 'Pulse';

    res.json({
      registrationEnabled,
      supportContact,
      platformName,
      message: registrationEnabled 
        ? 'User registration is available' 
        : `User registration is disabled. Contact ${supportContact} for assistance.`
    });
  } catch (error) {
    console.error('Error checking registration status:', error);
    // Default to enabled if we can't check (backward compatibility)
    res.json({
      registrationEnabled: true,
      supportContact: 'support@pulse.dev',
      platformName: 'Pulse',
      message: 'User registration is available'
    });
  }
});

export { router as authRoutes };