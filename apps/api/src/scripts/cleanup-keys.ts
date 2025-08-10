import { db } from '../index';
import { pemKeys } from '@config-management/database';

async function cleanupCorruptedKeys() {
  try {
    console.log('🧹 Cleaning up corrupted PEM keys...');
    
    const result = await db.delete(pemKeys);
    
    console.log('✅ Corrupted keys removed. You can now upload fresh PEM keys.');
    console.log('💡 This will allow deployments to work properly with new keys.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up keys:', error);
    process.exit(1);
  }
}

cleanupCorruptedKeys();