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
    
    // Always ensure critical columns exist after migrations
    await ensureCriticalColumns(client);
    
    // Always ensure SSO tables exist
    await ensureSSOTables(client);
    
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

async function checkSchemaIntegrity(client: postgres.Sql): Promise<boolean> {
  // Check for critical columns that were added in later migrations
  const criticalColumns = [
    { table: 'users', column: 'has_completed_onboarding' },
    { table: 'users', column: 'is_super_admin' },
    { table: 'organizations', column: 'is_active' },
    { table: 'roles', column: 'is_system' }
  ];
  
  for (const { table, column } of criticalColumns) {
    try {
      const result = await client`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = ${table} 
          AND column_name = ${column}
        ) as exists
      `;
      
      if (!result[0].exists) {
        console.log(`⚠️ Missing column '${column}' in table '${table}' - migration needed`);
        return true; // Needs migration
      }
    } catch (error) {
      console.log(`⚠️ Error checking column '${column}' in table '${table}' - migration needed`);
      return true; // Assume migration needed if we can't check
    }
  }
  
  console.log('✅ All critical columns exist');
  return false; // No migration needed
}

async function applyAllMigrations(client: postgres.Sql): Promise<void> {
  // In the container, migration files are at /app/apps/api/drizzle
  const migrationsDir = '/app/apps/api/drizzle';
  
  // Get all actual migration files in order
  const migrationFiles = [
    '0000_rich_warlock.sql',
    '0001_rainy_aaron_stack.sql', 
    '0002_cooing_impossible_man.sql',
    '0003_lean_titanium_man.sql',
    '0004_open_gorgon.sql',
    '0005_motionless_stingray.sql',
    '0006_clammy_celestials.sql',
    '0007_multi_tenancy_support.sql',
    '0008_onboarding_support.sql',
    '0009_happy_preak.sql',
    '0009_rbac_fixes.sql',
    '0010_asset_management.sql',
    '0011_assets_with_mdm.sql',
    '0012_missing_columns.sql',
    '0013_system_settings.sql'
  ];
  
  for (const filename of migrationFiles) {
    const fullPath = path.join(migrationsDir, filename);
    
    // Check if file exists
    if (fs.existsSync(fullPath)) {
      console.log(`📝 Applying migration: ${filename}`);
      
      try {
        const sql = fs.readFileSync(fullPath, 'utf8');
        
        // For migrations 0007, 0008, 0009 - execute them in transaction for safety
        if (filename.includes('0007') || filename.includes('0008') || filename.includes('0009')) {
          console.log(`🔧 Executing critical migration ${filename} in transaction...`);
          
          await client.begin(async (txn) => {
            // Execute the entire migration file without splitting to preserve DO blocks
            try {
              await txn.unsafe(sql);
            } catch (error: any) {
              // Only ignore specific errors that are expected
              if (!error.message?.includes('already exists') && 
                  !error.message?.includes('duplicate_object') &&
                  !error.message?.includes('duplicate_constraint') &&
                  !error.message?.includes('already defined')) {
                console.error(`Error in migration ${filename}:`, error.message);
                throw error;
              }
            }
          });
        } else {
          // For other migrations, use the old method
          try {
            await client.unsafe(sql);
          } catch (error: any) {
            // Ignore errors for already existing objects
            if (!error.message?.includes('already exists') && 
                !error.message?.includes('duplicate_object') &&
                !error.message?.includes('already defined')) {
              console.error(`Error in migration ${filename}:`, error.message);
              throw error;
            }
          }
        }
        
        console.log(`✅ Migration ${filename} applied successfully`);
      } catch (error) {
        console.error(`❌ Failed to apply migration ${filename}:`, error);
        throw error;
      }
    } else {
      console.log(`⚠️ Migration file not found: ${filename} - skipping`);
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
    'configuration_github_mappings',
    'assets',
    'asset_assignments',
    'asset_history',
    'asset_maintenance',
    'asset_categories',
    'asset_locations',
    'sso_providers',
    'sso_domain_mappings', 
    'user_sso_mappings'
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
      
      // If SSO tables are still missing after migrations, create them manually
      if (tableName.startsWith('sso_')) {
        await ensureSSOTables(client);
      }
      break; // No need to check further, we've applied all migrations
    }
  }
  
  console.log('✅ All required tables exist');
}

async function ensureSSOTables(client: postgres.Sql): Promise<void> {
  console.log('🔧 Creating SSO tables...');
  
  try {
    // Create SSO providers table
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS sso_providers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        provider_type varchar(50) NOT NULL DEFAULT 'oidc',
        client_id varchar(500) NOT NULL,
        client_secret text NOT NULL,
        discovery_url text,
        issuer_url text,
        authorization_url text,
        token_url text,
        userinfo_url text,
        jwks_uri text,
        scopes text[] DEFAULT ARRAY['openid', 'profile', 'email'],
        claims_mapping jsonb DEFAULT '{"email": "email", "name": "name", "given_name": "given_name", "family_name": "family_name"}',
        auto_provision_users boolean NOT NULL DEFAULT true,
        default_role varchar(100) DEFAULT 'viewer',
        first_user_role varchar(100) DEFAULT 'administrator',
        role_mapping jsonb DEFAULT '{}',
        is_active boolean NOT NULL DEFAULT true,
        created_by uuid,
        created_at timestamp DEFAULT NOW() NOT NULL,
        updated_at timestamp DEFAULT NOW() NOT NULL
      );
    `);
    
    // Create SSO domain mappings table
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS sso_domain_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sso_provider_id uuid REFERENCES sso_providers(id),
        domain varchar(255) NOT NULL,
        organization_id uuid NOT NULL,
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT NOW() NOT NULL,
        updated_at timestamp DEFAULT NOW() NOT NULL
      );
    `);
    
    // Create user SSO mappings table
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS user_sso_mappings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id),
        sso_provider_id uuid REFERENCES sso_providers(id),
        external_user_id varchar(500) NOT NULL,
        external_email varchar(255) NOT NULL,
        external_metadata jsonb DEFAULT '{}',
        last_login_at timestamp,
        created_at timestamp DEFAULT NOW() NOT NULL,
        updated_at timestamp DEFAULT NOW() NOT NULL
      );
    `);
    
    console.log('✅ SSO tables created successfully');
  } catch (error) {
    console.error('❌ Error creating SSO tables:', error);
  }
}

async function ensureCriticalColumns(client: postgres.Sql): Promise<void> {
  console.log('🔧 Ensuring critical columns exist...');
  
  // IMPORTANT: Execute each ALTER TABLE in its own transaction
  // This ensures columns are actually added before RBAC seeding
  
  const columnMigrations = [
    {
      table: 'organizations',
      column: 'features_enabled',
      sql: `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS features_enabled jsonb DEFAULT '{"servers": true, "serverGroups": true, "pemKeys": true, "configurations": true, "deployments": true, "chat": true, "training": true, "awsIntegrations": true, "githubIntegrations": true, "mdm": true, "assets": true, "auditLogs": true}'::jsonb;`
    },
    {
      table: 'organizations',
      column: 'metadata',
      sql: `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;`
    },
    {
      table: 'configurations',
      column: 'metadata',
      sql: `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS metadata jsonb;`
    },
    {
      table: 'assets',
      column: 'mdm_device_id',
      sql: `ALTER TABLE assets ADD COLUMN IF NOT EXISTS mdm_device_id varchar;`
    },
    {
      table: 'users',
      column: 'is_super_admin',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;`
    },
    {
      table: 'users',
      column: 'has_completed_onboarding',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT false;`
    },
    {
      table: 'users',
      column: 'auth_method',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_method varchar DEFAULT 'password';`
    },
    {
      table: 'users',
      column: 'sso_provider_id',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider_id uuid;`
    },
    {
      table: 'users',
      column: 'external_user_id',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS external_user_id varchar;`
    },
    {
      table: 'users',
      column: 'last_sso_login_at',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sso_login_at timestamp;`
    }
  ];

  for (const migration of columnMigrations) {
    try {
      // Execute the SQL directly without any ORM interference
      const result = await client.unsafe(migration.sql);
      console.log(`✅ Column ${migration.table}.${migration.column} ensured`);
      
      // Verify the column actually exists after adding it
      const verification = await client`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${migration.table} 
        AND column_name = ${migration.column}
      `;
      
      if (verification.length === 0) {
        console.error(`❌ CRITICAL: Column ${migration.table}.${migration.column} was not created!`);
        throw new Error(`Failed to create column ${migration.table}.${migration.column}`);
      }
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`✅ Column ${migration.table}.${migration.column} already exists`);
      } else {
        console.error(`❌ Failed to add column ${migration.table}.${migration.column}:`, error.message);
        throw error; // Re-throw to stop initialization if column creation fails
      }
    }
  }
  
  // Update existing organizations that don't have features_enabled set
  try {
    await client.unsafe(`
      UPDATE organizations 
      SET features_enabled = '{"servers": true, "serverGroups": true, "pemKeys": true, "configurations": true, "deployments": true, "chat": true, "training": true, "awsIntegrations": true, "githubIntegrations": true, "mdm": true, "assets": true, "auditLogs": true}'::jsonb 
      WHERE features_enabled IS NULL
    `);
    console.log('✅ Organization feature flags updated');
  } catch (error) {
    console.log(`⚠️ Failed to update organization features: ${error}`);
  }
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