import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { users, organizations, mdmProfiles } from '@config-management/database';
import { eq } from 'drizzle-orm';
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

    // Create user and organization in transaction
    const newUser = await db.insert(users).values({
      email: value.email,
      name: value.name,
      passwordHash,
      role: 'admin',
    }).returning();

    const newOrg = await db.insert(organizations).values({
      name: value.organizationName,
      ownerId: newUser[0].id,
    }).returning();

    // Create default MDM profile for the new organization
    try {
      await createDefaultMDMProfile(newOrg[0].id, newUser[0].id);
    } catch (error) {
      console.error('Warning: Failed to create default MDM profile during registration:', error);
      // Don't fail registration if MDM profile creation fails
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: newUser[0].id,
        email: newUser[0].email,
        organizationId: newOrg[0].id,
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

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, value.email))
      .limit(1);

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

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user[0].id,
        email: user[0].email,
        organizationId: org[0].id,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        role: user[0].role,
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

export { router as authRoutes };