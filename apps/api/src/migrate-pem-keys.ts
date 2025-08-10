import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pemKeys } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
import { SecureKeyManager } from './utils/keyManagement';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function migratePemKeys() {
  console.log('🔄 Starting PEM key migration to new encryption format...');
  
  try {
    // Get all PEM keys
    const allKeys = await db.select().from(pemKeys);
    
    console.log(`📋 Found ${allKeys.length} PEM keys to check`);
    
    const keyManager = SecureKeyManager.getInstance();
    let migrated = 0;
    let failed = 0;
    
    for (const key of allKeys) {
      try {
        // Check if already in new format
        if (key.encryptedPrivateKey.includes(':')) {
          console.log(`✅ Key "${key.name}" already in new format, skipping`);
          continue;
        }
        
        console.log(`🔐 Migrating key "${key.name}"...`);
        
        // Try to decrypt with old method
        const decryptedKey = keyManager.decryptPemKey(key.encryptedPrivateKey, key.organizationId);
        
        // Validate the decrypted key
        if (!decryptedKey || !decryptedKey.includes('BEGIN') || !decryptedKey.includes('PRIVATE KEY')) {
          console.error(`❌ Key "${key.name}" does not appear to be valid after decryption, skipping`);
          failed++;
          continue;
        }
        
        // Re-encrypt with new method
        const reEncrypted = keyManager.encryptPemKey(decryptedKey, key.organizationId);
        
        // Update in database
        await db
          .update(pemKeys)
          .set({
            encryptedPrivateKey: reEncrypted.encryptedKey,
            fingerprint: reEncrypted.fingerprint,
            updatedAt: new Date(),
          })
          .where(eq(pemKeys.id, key.id));
        
        console.log(`✅ Successfully migrated key "${key.name}"`);
        migrated++;
      } catch (error) {
        console.error(`❌ Failed to migrate key "${key.name}":`, error instanceof Error ? error.message : 'Unknown error');
        failed++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migrated} keys`);
    console.log(`❌ Failed to migrate: ${failed} keys`);
    console.log(`⏭️  Already in new format: ${allKeys.length - migrated - failed} keys`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePemKeys();