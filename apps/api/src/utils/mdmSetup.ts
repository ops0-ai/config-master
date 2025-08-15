import * as crypto from 'crypto';
import { db } from '../index';
import { mdmProfiles } from '@config-management/database';

/**
 * Creates a default MDM profile for a new organization
 * This ensures every organization has an enrollment key immediately
 */
export async function createDefaultMDMProfile(organizationId: string, createdBy: string): Promise<string> {
  try {
    // Generate unique enrollment key
    const enrollmentKey = crypto.randomBytes(32).toString('hex');
    
    // Create default MDM profile
    const newProfile = await db.insert(mdmProfiles).values({
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
    }).returning();
    
    console.log(`✅ Created default MDM profile for organization ${organizationId} with key: ${enrollmentKey}`);
    return enrollmentKey;
    
  } catch (error) {
    console.error('❌ Failed to create default MDM profile:', error);
    throw error;
  }
}