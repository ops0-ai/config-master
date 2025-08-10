import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { permissions, rolePermissions } from '@config-management/database';
import { eq, and, inArray } from 'drizzle-orm';
import { config } from 'dotenv';

config();

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
const db = drizzle(client);

async function cleanupDuplicatePermissions() {
  console.log('🧹 Cleaning up duplicate permissions...');
  
  try {
    // Get all permissions
    const allPermissions = await db.select().from(permissions);
    
    // Group by resource and action to find duplicates
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const unique: string[] = [];
    
    for (const perm of allPermissions) {
      const key = `${perm.resource}:${perm.action}`;
      if (seen.has(key)) {
        duplicates.push(perm.id);
        console.log(`  🔄 Found duplicate: ${key} (ID: ${perm.id})`);
      } else {
        seen.add(key);
        unique.push(perm.id);
      }
    }
    
    console.log(`📊 Found ${allPermissions.length} total permissions`);
    console.log(`📊 Found ${unique.length} unique permissions`);
    console.log(`📊 Found ${duplicates.length} duplicate permissions`);
    
    if (duplicates.length > 0) {
      // Remove role_permission associations for duplicates
      console.log('🔗 Removing role permission associations for duplicates...');
      await db
        .delete(rolePermissions)
        .where(inArray(rolePermissions.permissionId, duplicates));
      
      // Remove duplicate permissions
      console.log('🗑️ Removing duplicate permissions...');
      await db
        .delete(permissions)
        .where(inArray(permissions.id, duplicates));
      
      console.log(`✅ Removed ${duplicates.length} duplicate permissions`);
    } else {
      console.log('✅ No duplicates found!');
    }
    
    // Verify final count
    const finalCount = await db.select().from(permissions);
    console.log(`📊 Final permission count: ${finalCount.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupDuplicatePermissions();