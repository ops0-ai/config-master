import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';
const IV_LENGTH = 16; // For AES, this is always 16

if (ENCRYPTION_KEY.length !== 32) {
  console.warn('ENCRYPTION_KEY should be 32 characters long. Using padded/truncated version.');
}

// Ensure key is exactly 32 bytes
const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));

export function encryptPassword(password: string): string {
  if (!password) return '';
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data with a separator
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error encrypting password:', error);
    throw new Error('Failed to encrypt password');
  }
}

export function decryptPassword(encryptedPassword: string): string {
  if (!encryptedPassword) return '';
  
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted password format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    throw new Error('Failed to decrypt password');
  }
}

// Test encryption/decryption on startup
try {
  const testPassword = 'test123';
  const encrypted = encryptPassword(testPassword);
  const decrypted = decryptPassword(encrypted);
  
  if (testPassword !== decrypted) {
    console.error('Encryption service test failed - passwords do not match');
  } else {
    console.log('Encryption service initialized successfully');
  }
} catch (error) {
  console.error('Encryption service test failed:', error);
}