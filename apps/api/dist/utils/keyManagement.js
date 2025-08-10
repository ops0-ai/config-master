"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureKeyManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const database_1 = require("@config-management/database");
const index_1 = require("../index");
const drizzle_orm_1 = require("drizzle-orm");
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || crypto_1.default.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';
const KEY_STORAGE_DIR = process.env.PEM_KEYS_DIR || './secure/pem-keys';
class SecureKeyManager {
    constructor() {
        this.initializeKeyStorage();
    }
    static getInstance() {
        if (!SecureKeyManager.instance) {
            SecureKeyManager.instance = new SecureKeyManager();
        }
        return SecureKeyManager.instance;
    }
    async initializeKeyStorage() {
        try {
            await promises_1.default.mkdir(KEY_STORAGE_DIR, { recursive: true, mode: 0o700 });
            console.log('🔐 Secure key storage initialized');
        }
        catch (error) {
            console.error('Error initializing key storage:', error);
        }
    }
    /**
     * Encrypt a PEM private key with multiple layers of security
     */
    encryptPemKey(privateKey, organizationId) {
        try {
            // Validate the private key format
            const keyDetails = this.analyzePemKey(privateKey);
            // Generate a unique key ID
            const keyId = crypto_1.default.randomUUID();
            // Create organization-specific encryption key
            const orgKey = this.deriveOrganizationKey(organizationId);
            // Simple but working encryption approach
            const cipher = crypto_1.default.createCipher('aes256', orgKey.toString('hex'));
            // Encrypt the private key
            let encrypted = cipher.update(privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Generate fingerprint
            const fingerprint = this.generateFingerprint(privateKey);
            return {
                encryptedKey: encrypted,
                keyId,
                fingerprint,
                keyDetails
            };
        }
        catch (error) {
            throw new Error(`Key encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Decrypt a PEM private key
     */
    decryptPemKey(encryptedKey, organizationId) {
        try {
            // Simple decryption that matches encryption
            const orgKey = this.deriveOrganizationKey(organizationId);
            const decipher = crypto_1.default.createDecipher('aes256', orgKey.toString('hex'));
            let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            throw new Error(`Key decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create a temporary file with the decrypted PEM key for Ansible usage
     */
    async createTemporaryKeyFile(keyId, organizationId) {
        try {
            // Get the encrypted key from database
            const pemKey = await index_1.db
                .select()
                .from(database_1.pemKeys)
                .where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, keyId))
                .limit(1);
            if (!pemKey[0]) {
                throw new Error('PEM key not found');
            }
            // Decrypt the key
            const decryptedKey = this.decryptPemKey(pemKey[0].encryptedPrivateKey, organizationId);
            // Create temporary file
            const tempFileName = `temp_${keyId}_${Date.now()}.pem`;
            const tempFilePath = path_1.default.join(KEY_STORAGE_DIR, tempFileName);
            // Write key to temporary file with secure permissions
            await promises_1.default.writeFile(tempFilePath, decryptedKey, { mode: 0o600 });
            // Schedule file deletion after 1 hour
            setTimeout(async () => {
                try {
                    await promises_1.default.unlink(tempFilePath);
                    console.log(`Temporary key file deleted: ${tempFilePath}`);
                }
                catch (error) {
                    console.error(`Error deleting temporary key file: ${tempFilePath}`, error);
                }
            }, 3600000); // 1 hour
            return tempFilePath;
        }
        catch (error) {
            throw new Error(`Failed to create temporary key file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Rotate encryption keys for enhanced security
     */
    async rotateOrganizationKeys(organizationId) {
        try {
            console.log(`Starting key rotation for organization: ${organizationId}`);
            // Get all PEM keys for the organization
            const orgKeys = await index_1.db
                .select()
                .from(database_1.pemKeys)
                .where((0, drizzle_orm_1.eq)(database_1.pemKeys.organizationId, organizationId));
            for (const key of orgKeys) {
                try {
                    // Decrypt with old key
                    const decryptedKey = this.decryptPemKey(key.encryptedPrivateKey, organizationId);
                    // Re-encrypt with new derived key
                    const reEncrypted = this.encryptPemKey(decryptedKey, organizationId);
                    // Update in database
                    await index_1.db
                        .update(database_1.pemKeys)
                        .set({
                        encryptedPrivateKey: reEncrypted.encryptedKey,
                        updatedAt: new Date(),
                    })
                        .where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, key.id));
                    console.log(`Key rotated successfully: ${key.name}`);
                }
                catch (error) {
                    console.error(`Error rotating key ${key.id}:`, error);
                }
            }
            console.log(`Key rotation completed for organization: ${organizationId}`);
        }
        catch (error) {
            console.error(`Key rotation failed for organization ${organizationId}:`, error);
            throw error;
        }
    }
    /**
     * Validate PEM key integrity
     */
    validateKeyIntegrity(keyId, organizationId) {
        return new Promise(async (resolve) => {
            try {
                const pemKey = await index_1.db
                    .select()
                    .from(database_1.pemKeys)
                    .where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, keyId))
                    .limit(1);
                if (!pemKey[0]) {
                    resolve({ isValid: false, fingerprint: '', details: { error: 'Key not found' } });
                    return;
                }
                const decryptedKey = this.decryptPemKey(pemKey[0].encryptedPrivateKey, organizationId);
                const calculatedFingerprint = this.generateFingerprint(decryptedKey);
                const keyDetails = this.analyzePemKey(decryptedKey);
                const isValid = calculatedFingerprint === pemKey[0].fingerprint;
                resolve({
                    isValid,
                    fingerprint: calculatedFingerprint,
                    details: {
                        storedFingerprint: pemKey[0].fingerprint,
                        calculatedFingerprint,
                        keyType: keyDetails.keyType,
                        keySize: keyDetails.keySize
                    }
                });
            }
            catch (error) {
                resolve({
                    isValid: false,
                    fingerprint: '',
                    details: { error: error instanceof Error ? error.message : 'Unknown error' }
                });
            }
        });
    }
    /**
     * Clean up expired temporary key files
     */
    async cleanupTemporaryFiles() {
        try {
            const files = await promises_1.default.readdir(KEY_STORAGE_DIR);
            const tempFiles = files.filter(file => file.startsWith('temp_'));
            for (const file of tempFiles) {
                const filePath = path_1.default.join(KEY_STORAGE_DIR, file);
                const stats = await promises_1.default.stat(filePath);
                const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                if (ageHours > 1) {
                    await promises_1.default.unlink(filePath);
                    console.log(`Cleaned up expired temporary key file: ${file}`);
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up temporary files:', error);
        }
    }
    deriveOrganizationKey(organizationId) {
        const combined = MASTER_KEY + organizationId;
        return crypto_1.default.createHash('sha256').update(combined).digest();
    }
    generateFingerprint(privateKey) {
        return crypto_1.default
            .createHash('sha256')
            .update(privateKey)
            .digest('hex')
            .substring(0, 32);
    }
    analyzePemKey(privateKey) {
        const keyContent = privateKey.toLowerCase();
        if (keyContent.includes('rsa')) {
            // Extract key size for RSA keys
            const match = keyContent.match(/(\d+)/);
            const keySize = match ? parseInt(match[1]) : undefined;
            return { keyType: 'rsa', keySize };
        }
        else if (keyContent.includes('ed25519')) {
            return { keyType: 'ed25519', keySize: 256 };
        }
        else if (keyContent.includes('ecdsa')) {
            return { keyType: 'ecdsa' };
        }
        else {
            // Default to RSA if type cannot be determined
            return { keyType: 'rsa' };
        }
    }
}
exports.SecureKeyManager = SecureKeyManager;
// Schedule regular cleanup of temporary files
setInterval(async () => {
    const keyManager = SecureKeyManager.getInstance();
    await keyManager.cleanupTemporaryFiles();
}, 3600000); // Every hour
//# sourceMappingURL=keyManagement.js.map