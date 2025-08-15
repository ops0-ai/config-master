import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import fs from 'fs';
import path from 'path';

export async function initializeDatabase(): Promise<void> {
  console.log('🗄️ Initializing database schema...');
  
  const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  const client = postgres(connectionString, { max: 1 });
  
  try {
    // Wait for database to be ready
    await waitForDatabase(client);
    
    // Check if database is empty
    const tableCount = await checkTableCount(client);
    
    if (tableCount === 0) {
      console.log('📝 Empty database detected, applying all migrations...');
      await applyAllMigrations(client);
    } else {
      console.log(`📊 Database already has ${tableCount} tables, checking schema integrity...`);
      await ensureAllTablesExist(client);
    }
    
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function waitForDatabase(client: postgres.Sql): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      await client`SELECT 1`;
      console.log('✅ Database connection established');
      return;
    } catch (error) {
      attempts++;
      console.log(`⏳ Waiting for database... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('Database connection timeout');
}

async function checkTableCount(client: postgres.Sql): Promise<number> {
  const result = await client`
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  return parseInt(result[0].count);
}

async function applyAllMigrations(client: postgres.Sql): Promise<void> {
  // In the container, migration files are at /app/apps/api/drizzle
  const migrationsDir = '/app/apps/api/drizzle';
  
  // Get all migration files in order
  const migrationFiles = [
    '0000_rich_warlock.sql',
    '0001_rainy_aaron_stack.sql', 
    '0002_cooing_impossible_man.sql',
    '0003_lean_titanium_man.sql',
    '0004_open_gorgon.sql',
    '0005_motionless_stingray.sql',
    '0006_clammy_celestials.sql'
  ];
  
  for (const filename of migrationFiles) {
    // Find the actual file (it might have a different name)
    const files = fs.readdirSync(migrationsDir);
    const actualFile = files.find(f => f.startsWith(filename.split('_')[0]));
    
    if (actualFile) {
      const actualPath = path.join(migrationsDir, actualFile);
      console.log(`📝 Applying migration: ${actualFile}`);
      
      try {
        const sql = fs.readFileSync(actualPath, 'utf8');
        
        // Split by statement separator and execute each
        const statements = sql.split('--> statement-breakpoint');
        
        for (const statement of statements) {
          const trimmed = statement.trim();
          if (trimmed && !trimmed.startsWith('--')) {
            try {
              await client.unsafe(trimmed);
            } catch (error: any) {
              // Ignore errors for already existing objects
              if (!error.message?.includes('already exists')) {
                console.error(`Error in statement: ${trimmed.substring(0, 100)}...`);
                console.error(error.message);
              }
            }
          }
        }
        
        console.log(`✅ Migration ${actualFile} applied successfully`);
      } catch (error) {
        console.error(`❌ Failed to apply migration ${actualFile}:`, error);
        throw error;
      }
    }
  }
}

async function ensureAllTablesExist(client: postgres.Sql): Promise<void> {
  // Check for essential tables and create them if missing
  const requiredTables = [
    'users',
    'organizations', 
    'roles',
    'permissions',
    'user_roles',
    'role_permissions',
    'user_organizations',
    'organization_settings',
    'servers',
    'server_groups',
    'pem_keys',
    'configurations',
    'deployments',
    'configuration_states',
    'audit_logs',
    'conversations',
    'messages',
    'mdm_profiles',
    'mdm_devices',
    'mdm_commands',
    'mdm_sessions',
    'aws_integrations',
    'aws_instances',
    'github_integrations',
    'github_pull_requests',
    'configuration_github_mappings'
  ];
  
  for (const tableName of requiredTables) {
    const result = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists
    `;
    
    if (!result[0].exists) {
      console.log(`⚠️ Table '${tableName}' is missing, running full migration...`);
      await applyAllMigrations(client);
      break; // No need to check further, we've applied all migrations
    }
  }
  
  console.log('✅ All required tables exist');
}

export async function verifyDatabaseSchema(): Promise<boolean> {
  const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  const client = postgres(connectionString, { max: 1 });
  
  try {
    // Quick check for the deployments table which is often missing
    const result = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'deployments'
      ) as exists
    `;
    
    const exists = result[0].exists;
    await client.end();
    return exists;
  } catch (error) {
    await client.end();
    return false;
  }
}