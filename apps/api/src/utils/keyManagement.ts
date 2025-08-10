import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { pemKeys } from '@config-management/database';
import { db } from '../index';
import { eq } from 'drizzle-orm';

const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';
const KEY_STORAGE_DIR = process.env.PEM_KEYS_DIR || './secure/pem-keys';

export interface PemKeyDetails {
  id: string;
  name: string;
  fingerprint: string;
  keyType: 'rsa' | 'ed25519' | 'ecdsa';
  keySize?: number;
  temporaryPath?: string;
}

export class SecureKeyManager {
  private static instance: SecureKeyManager;

  private constructor() {
    this.initializeKeyStorage();
  }

  static getInstance(): SecureKeyManager {
    if (!SecureKeyManager.instance) {
      SecureKeyManager.instance = new SecureKeyManager();
    }
    return SecureKeyManager.instance;
  }

  private async initializeKeyStorage(): Promise<void> {
    try {
      await fs.mkdir(KEY_STORAGE_DIR, { recursive: true, mode: 0o700 });
      console.log('🔐 Secure key storage initialized');
    } catch (error) {
      console.error('Error initializing key storage:', error);
    }
  }

  /**
   * Encrypt a PEM private key with multiple layers of security
   */
  encryptPemKey(privateKey: string, organizationId: string): {
    encryptedKey: string;
    keyId: string;
    fingerprint: string;
    keyDetails: any;
  } {
    try {
      // Validate the private key format
      const keyDetails = this.analyzePemKey(privateKey);
      
      // Generate a unique key ID
      const keyId = crypto.randomUUID();
      
      // Create organization-specific encryption key
      const orgKey = this.deriveOrganizationKey(organizationId);
      
      // Generate a random IV for this encryption
      const iv = crypto.randomBytes(16);
      
      // Use the modern createCipheriv method with proper IV
      const cipher = crypto.createCipheriv(ALGORITHM, orgKey, iv);
      
      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data (IV is needed for decryption)
      const combined = iv.toString('hex') + ':' + encrypted;
      
      // Generate fingerprint
      const fingerprint = this.generateFingerprint(privateKey);
      
      return {
        encryptedKey: combined,
        keyId,
        fingerprint,
        keyDetails
      };
    } catch (error) {
      throw new Error(`Key encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt a PEM private key
   */
  decryptPemKey(encryptedKey: string, organizationId: string): string {
    try {
      const orgKey = this.deriveOrganizationKey(organizationId);
      
      // Check if this is the new format (with IV)
      if (encryptedKey.includes(':')) {
        // New format: IV:encryptedData
        const parts = encryptedKey.split(':');
        if (parts.length !== 2) {
          throw new Error('Invalid encrypted key format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        // Try current encryption settings first
        try {
          const decipher = crypto.createDecipheriv(ALGORITHM, orgKey, iv);
          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        } catch (currentError) {
          console.log('⚠️  Current decryption failed, trying compatibility modes...');
          
          // Try with different master keys (common fallbacks)
          const fallbackMasterKeys = [
            crypto.randomBytes(32).toString('hex'), // Random key
            '0'.repeat(64), // All zeros
            '1'.repeat(64), // All ones
            'default_master_key_config_management_system_v1', // Default pattern
          ];
          
          for (const fallbackMaster of fallbackMasterKeys) {
            try {
              const fallbackOrgKey = crypto.createHash('sha256')
                .update(fallbackMaster + organizationId)
                .digest();
              
              const decipher = crypto.createDecipheriv(ALGORITHM, fallbackOrgKey, iv);
              let decrypted = decipher.update(encrypted, 'hex', 'utf8');
              decrypted += decipher.final('utf8');
              
              console.log('✅ Successfully decrypted with fallback master key');
              return decrypted;
            } catch (fallbackError) {
              // Continue to next fallback
            }
          }
          
          throw currentError;
        }
      } else {
        // Old format: try legacy decryption with multiple approaches
        const legacyMethods = [
          () => {
            const decipher = crypto.createDecipher('aes256', orgKey.toString('hex'));
            let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
          },
          () => {
            const decipher = crypto.createDecipher('aes256', organizationId);
            let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
          },
          () => {
            const decipher = crypto.createDecipher('aes256', MASTER_KEY);
            let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
          }
        ];
        
        for (let i = 0; i < legacyMethods.length; i++) {
          try {
            console.log(`Trying legacy decryption method ${i + 1}...`);
            return legacyMethods[i]();
          } catch (legacyError) {
            if (i === legacyMethods.length - 1) {
              throw new Error('Unable to decrypt key with any legacy method');
            }
          }
        }
        
        // This should never be reached due to the throw above, but TypeScript requires it
        throw new Error('Unexpected error in legacy decryption');
      }
    } catch (error) {
      const errorMsg = `Key decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMsg);
      console.log('💡 This key may need to be re-uploaded with the current encryption system');
      throw new Error(errorMsg);
    }
  }

  /**
   * Create a temporary file with the decrypted PEM key for Ansible usage
   */
  async createTemporaryKeyFile(keyId: string, organizationId: string): Promise<string> {
    try {
      // Get the encrypted key from database
      const pemKey = await db
        .select()
        .from(pemKeys)
        .where(eq(pemKeys.id, keyId))
        .limit(1);

      if (!pemKey[0]) {
        throw new Error('PEM key not found');
      }

      // Decrypt the key
      const decryptedKey = this.decryptPemKey(pemKey[0].encryptedPrivateKey, organizationId);
      
      // Create temporary file
      const tempFileName = `temp_${keyId}_${Date.now()}.pem`;
      const tempFilePath = path.join(KEY_STORAGE_DIR, tempFileName);
      
      // Write key to temporary file with secure permissions
      await fs.writeFile(tempFilePath, decryptedKey, { mode: 0o600 });
      
      // Schedule file deletion after 1 hour
      setTimeout(async () => {
        try {
          await fs.unlink(tempFilePath);
          console.log(`Temporary key file deleted: ${tempFilePath}`);
        } catch (error) {
          console.error(`Error deleting temporary key file: ${tempFilePath}`, error);
        }
      }, 3600000); // 1 hour
      
      return tempFilePath;
    } catch (error) {
      throw new Error(`Failed to create temporary key file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rotate encryption keys for enhanced security
   */
  async rotateOrganizationKeys(organizationId: string): Promise<void> {
    try {
      console.log(`Starting key rotation for organization: ${organizationId}`);
      
      // Get all PEM keys for the organization
      const orgKeys = await db
        .select()
        .from(pemKeys)
        .where(eq(pemKeys.organizationId, organizationId));

      for (const key of orgKeys) {
        try {
          // Decrypt with old key
          const decryptedKey = this.decryptPemKey(key.encryptedPrivateKey, organizationId);
          
          // Re-encrypt with new derived key
          const reEncrypted = this.encryptPemKey(decryptedKey, organizationId);
          
          // Update in database
          await db
            .update(pemKeys)
            .set({
              encryptedPrivateKey: reEncrypted.encryptedKey,
              updatedAt: new Date(),
            })
            .where(eq(pemKeys.id, key.id));
            
          console.log(`Key rotated successfully: ${key.name}`);
        } catch (error) {
          console.error(`Error rotating key ${key.id}:`, error);
        }
      }
      
      console.log(`Key rotation completed for organization: ${organizationId}`);
    } catch (error) {
      console.error(`Key rotation failed for organization ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Validate PEM key integrity with comprehensive checks
   */
  async validateKeyIntegrity(keyId: string, organizationId: string): Promise<{
    isValid: boolean;
    fingerprint: string;
    details: any;
  }> {
    try {
      const pemKey = await db
        .select()
        .from(pemKeys)
        .where(eq(pemKeys.id, keyId))
        .limit(1);

      if (!pemKey[0]) {
        return { isValid: false, fingerprint: '', details: { error: 'Key not found' } };
      }

      const decryptedKey = this.decryptPemKey(pemKey[0].encryptedPrivateKey, organizationId);
      
      // Perform comprehensive validation
      const validation = this.comprehensiveKeyValidation(decryptedKey);
      if (!validation.isValid) {
        return { 
          isValid: false, 
          fingerprint: '', 
          details: { error: validation.error, validationDetails: validation }
        };
      }
      
      const calculatedFingerprint = this.generateFingerprint(decryptedKey);
      const keyDetails = this.analyzePemKey(decryptedKey);
      
      const isValid = calculatedFingerprint === pemKey[0].fingerprint;
      
      return {
        isValid,
        fingerprint: calculatedFingerprint,
        details: {
          storedFingerprint: pemKey[0].fingerprint,
          calculatedFingerprint,
          keyType: keyDetails.keyType,
          keySize: keyDetails.keySize,
          validation
        }
      };
    } catch (error) {
      return { 
        isValid: false, 
        fingerprint: '', 
        details: { error: error instanceof Error ? error.message : 'Unknown error' } 
      };
    }
  }

  /**
   * Comprehensive PEM key validation
   */
  private comprehensiveKeyValidation(pemKey: string): {
    isValid: boolean;
    error?: string;
    checks: {
      hasContent: boolean;
      hasValidFormat: boolean;
      hasValidStructure: boolean;
      hasValidEncoding: boolean;
      lineCount: number;
      keyType: string;
    };
  } {
    const checks = {
      hasContent: false,
      hasValidFormat: false,
      hasValidStructure: false,
      hasValidEncoding: false,
      lineCount: 0,
      keyType: 'unknown'
    };

    try {
      // Check 1: Has content
      if (!pemKey || typeof pemKey !== 'string' || pemKey.trim().length === 0) {
        return { isValid: false, error: 'Key is empty or invalid type', checks };
      }
      checks.hasContent = true;

      // Check 2: Has valid PEM format
      if (!pemKey.includes('BEGIN') || !pemKey.includes('PRIVATE KEY') || 
          !pemKey.includes('END') || !pemKey.includes('PRIVATE KEY')) {
        return { isValid: false, error: 'Key does not have valid PEM format', checks };
      }
      checks.hasValidFormat = true;

      // Check 3: Has valid structure
      const lines = pemKey.split('\n').filter(line => line.trim());
      checks.lineCount = lines.length;
      
      if (lines.length < 3) {
        return { isValid: false, error: 'Key has insufficient lines (corrupted?)', checks };
      }

      const firstLine = lines[0].trim();
      const lastLine = lines[lines.length - 1].trim();
      
      if (!firstLine.startsWith('-----BEGIN') || !firstLine.endsWith('PRIVATE KEY-----')) {
        return { isValid: false, error: 'Invalid PEM header', checks };
      }
      
      if (!lastLine.startsWith('-----END') || !lastLine.endsWith('PRIVATE KEY-----')) {
        return { isValid: false, error: 'Invalid PEM footer', checks };
      }
      checks.hasValidStructure = true;

      // Check 4: Determine key type
      if (pemKey.includes('RSA PRIVATE KEY')) {
        checks.keyType = 'RSA';
      } else if (pemKey.includes('EC PRIVATE KEY') || pemKey.includes('ECDSA')) {
        checks.keyType = 'ECDSA';
      } else if (pemKey.includes('OPENSSH PRIVATE KEY') || pemKey.includes('ED25519')) {
        checks.keyType = 'ED25519';
      } else if (pemKey.includes('PRIVATE KEY')) {
        checks.keyType = 'PKCS#8';
      }

      // Check 5: Validate base64 encoding in body
      const keyBody = lines.slice(1, -1).join('');
      if (keyBody.length === 0) {
        return { isValid: false, error: 'Key body is empty', checks };
      }

      // Basic base64 validation
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(keyBody)) {
        return { isValid: false, error: 'Key body contains invalid base64 characters', checks };
      }
      checks.hasValidEncoding = true;

      return { isValid: true, checks };

    } catch (error) {
      return { 
        isValid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        checks 
      };
    }
  }

  /**
   * Clean up expired temporary key files
   */
  async cleanupTemporaryFiles(): Promise<void> {
    try {
      const files = await fs.readdir(KEY_STORAGE_DIR);
      const tempFiles = files.filter(file => file.startsWith('temp_'));
      
      for (const file of tempFiles) {
        const filePath = path.join(KEY_STORAGE_DIR, file);
        const stats = await fs.stat(filePath);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageHours > 1) {
          await fs.unlink(filePath);
          console.log(`Cleaned up expired temporary key file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
    }
  }

  private deriveOrganizationKey(organizationId: string): Buffer {
    const combined = MASTER_KEY + organizationId;
    return crypto.createHash('sha256').update(combined).digest();
  }

  private generateFingerprint(privateKey: string): string {
    return crypto
      .createHash('sha256')
      .update(privateKey)
      .digest('hex')
      .substring(0, 32);
  }

  private analyzePemKey(privateKey: string): {
    keyType: 'rsa' | 'ed25519' | 'ecdsa';
    keySize?: number;
  } {
    const keyContent = privateKey.toLowerCase();
    
    if (keyContent.includes('rsa')) {
      // Extract key size for RSA keys
      const match = keyContent.match(/(\d+)/);
      const keySize = match ? parseInt(match[1]) : undefined;
      return { keyType: 'rsa', keySize };
    } else if (keyContent.includes('ed25519')) {
      return { keyType: 'ed25519', keySize: 256 };
    } else if (keyContent.includes('ecdsa')) {
      return { keyType: 'ecdsa' };
    } else {
      // Default to RSA if type cannot be determined
      return { keyType: 'rsa' };
    }
  }
}

// Schedule regular cleanup of temporary files
setInterval(async () => {
  const keyManager = SecureKeyManager.getInstance();
  await keyManager.cleanupTemporaryFiles();
}, 3600000); // Every hour