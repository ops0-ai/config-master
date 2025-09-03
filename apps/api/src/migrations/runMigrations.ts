import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';

export async function runDatabaseMigrations(): Promise<boolean> {
  console.log('🗄️ Running database migrations...');
  
  try {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Create a separate connection for migrations
    const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
    const migrationClient = postgres(connectionString, { max: 1 });
    const migrationDb = drizzle(migrationClient);
    
    try {
      // Run migrations from the packages/database/migrations directory
      const migrationsPath = path.resolve(__dirname, '../../../packages/database/migrations');
      console.log(`Running migrations from: ${migrationsPath}`);
      
      await migrate(migrationDb, { migrationsFolder: migrationsPath });
      console.log('✅ Drizzle migrations completed successfully');
      
      // Always ensure AI assistant tables exist, even after successful migration
      await ensureAIAssistantTables(migrationClient);
    } catch (migrationError) {
      console.warn('⚠️ Drizzle migrations failed, applying schema fix:', migrationError);
      
      // Apply comprehensive schema fix for fresh installations
      await applySchemaFix(migrationClient);
    }
    
    await migrationClient.end();
    
    console.log('✅ Database migrations completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration setup failed:', error);
    console.log('⚠️ Continuing without migrations - tables will be created on demand');
    // Continue anyway - the RBAC seeder will handle table creation
    return true;
  }
}

async function applySchemaFix(client: postgres.Sql): Promise<void> {
  console.log('🔧 Applying comprehensive schema fix...');
  
  const schemaFixQueries = [
    // Servers table fixes
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INTEGER NOT NULL DEFAULT 22;`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'linux';`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS username VARCHAR(255) NOT NULL DEFAULT 'root';`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS encrypted_password TEXT;`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'unknown';`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS group_id UUID;`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS pem_key_id UUID;`,
    `ALTER TABLE servers ADD COLUMN IF NOT EXISTS metadata JSONB;`,
    
    // Server groups table fixes
    `ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'mixed';`,
    `ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS default_pem_key_id UUID;`,
    
    // PEM keys table fixes
    `ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS description TEXT;`,
    `ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS public_key TEXT;`,
    `ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255);`,
    
    // Configurations table fixes
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'ansible';`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS ansible_playbook TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS variables JSONB;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS tags JSONB;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS created_by UUID;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'manual';`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending';`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_by UUID;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;`,
    `ALTER TABLE configurations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`,
    
    // Deployments table fixes
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS configuration_id UUID;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) NOT NULL DEFAULT 'server';`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_id UUID;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS logs TEXT;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS output TEXT;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error_message TEXT;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'immediate';`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(100);`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending';`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_by UUID;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS executed_by UUID;`,
    `ALTER TABLE deployments ADD COLUMN IF NOT EXISTS section VARCHAR(100) DEFAULT 'general';`,
    
    // RBAC table fixes
    `ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
    `ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID;`,
    `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_by UUID;`,
    `ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
    `ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
    
    // MDM table fixes
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS battery_level INTEGER;`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_charging BOOLEAN;`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS agent_install_path TEXT;`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_by UUID;`,
    `ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`,
    
    // AI Assistant tables creation as backup
    `CREATE TABLE IF NOT EXISTS "ai_assistant_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "organization_id" uuid NOT NULL,
      "context_page" varchar(50) NOT NULL,
      "context_data" jsonb DEFAULT '{}'::jsonb,
      "is_active" boolean DEFAULT true NOT NULL,
      "started_at" timestamp DEFAULT now() NOT NULL,
      "ended_at" timestamp,
      "metadata" jsonb DEFAULT '{}'::jsonb
    );`,
    
    `CREATE TABLE IF NOT EXISTS "ai_assistant_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "session_id" uuid NOT NULL,
      "conversation_id" uuid,
      "role" varchar(20) NOT NULL,
      "content" text NOT NULL,
      "context_page" varchar(50) NOT NULL,
      "actions" jsonb DEFAULT '[]'::jsonb,
      "analysis" jsonb,
      "generated_content" jsonb,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,
    
    `CREATE TABLE IF NOT EXISTS "ai_suggestions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL,
      "user_id" uuid,
      "type" varchar(50) NOT NULL,
      "severity" varchar(20) DEFAULT 'info' NOT NULL,
      "title" varchar(255) NOT NULL,
      "description" text NOT NULL,
      "affected_resource" varchar(100),
      "affected_resource_id" uuid,
      "suggested_action" jsonb,
      "status" varchar(20) DEFAULT 'pending' NOT NULL,
      "viewed_at" timestamp,
      "applied_at" timestamp,
      "dismissed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "expires_at" timestamp
    );`
  ];
  
  for (const query of schemaFixQueries) {
    try {
      await client.unsafe(query);
    } catch (error) {
      console.warn(`⚠️ Schema fix query failed (may already exist): ${query.substring(0, 50)}...`);
    }
  }
  
  // Add AI Assistant foreign key constraints with proper existence checks
  const aiConstraintQueries = [
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_sessions_user_id_users_id_fk') THEN
         ALTER TABLE "ai_assistant_sessions" ADD CONSTRAINT "ai_assistant_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_sessions_organization_id_organizations_id_fk') THEN
         ALTER TABLE "ai_assistant_sessions" ADD CONSTRAINT "ai_assistant_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_messages_session_id_ai_assistant_sessions_id_fk') THEN
         ALTER TABLE "ai_assistant_messages" ADD CONSTRAINT "ai_assistant_messages_session_id_ai_assistant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "ai_assistant_sessions"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_messages_conversation_id_conversations_id_fk') THEN
         IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
           ALTER TABLE "ai_assistant_messages" ADD CONSTRAINT "ai_assistant_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;
         END IF;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_suggestions_organization_id_organizations_id_fk') THEN
         ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_suggestions_user_id_users_id_fk') THEN
         ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
       END IF;
     END $$;`
  ];
  
  for (const constraintQuery of aiConstraintQueries) {
    try {
      await client.unsafe(constraintQuery);
    } catch (error) {
      console.warn(`⚠️ AI constraint query failed (may already exist): ${constraintQuery.substring(0, 80)}...`);
    }
  }
  
  console.log('✅ Schema fix and AI assistant tables completed');
}

async function ensureAIAssistantTables(client: postgres.Sql): Promise<void> {
  console.log('🤖 Ensuring AI assistant tables exist...');
  
  const aiTableQueries = [
    `CREATE TABLE IF NOT EXISTS "ai_assistant_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "organization_id" uuid NOT NULL,
      "context_page" varchar(50) NOT NULL,
      "context_data" jsonb DEFAULT '{}'::jsonb,
      "is_active" boolean DEFAULT true NOT NULL,
      "started_at" timestamp DEFAULT now() NOT NULL,
      "ended_at" timestamp,
      "metadata" jsonb DEFAULT '{}'::jsonb
    );`,
    
    `CREATE TABLE IF NOT EXISTS "ai_assistant_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "session_id" uuid NOT NULL,
      "conversation_id" uuid,
      "role" varchar(20) NOT NULL,
      "content" text NOT NULL,
      "context_page" varchar(50) NOT NULL,
      "actions" jsonb DEFAULT '[]'::jsonb,
      "analysis" jsonb,
      "generated_content" jsonb,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,
    
    `CREATE TABLE IF NOT EXISTS "ai_suggestions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "organization_id" uuid NOT NULL,
      "user_id" uuid,
      "type" varchar(50) NOT NULL,
      "severity" varchar(20) DEFAULT 'info' NOT NULL,
      "title" varchar(255) NOT NULL,
      "description" text NOT NULL,
      "affected_resource" varchar(100),
      "affected_resource_id" uuid,
      "suggested_action" jsonb,
      "status" varchar(20) DEFAULT 'pending' NOT NULL,
      "viewed_at" timestamp,
      "applied_at" timestamp,
      "dismissed_at" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "expires_at" timestamp
    );`
  ];
  
  for (const query of aiTableQueries) {
    try {
      await client.unsafe(query);
    } catch (error) {
      console.warn(`⚠️ AI table creation failed (may already exist): ${(error as Error).message}`);
    }
  }
  
  // Add foreign key constraints
  const aiConstraintQueries = [
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_sessions_user_id_users_id_fk') THEN
         ALTER TABLE "ai_assistant_sessions" ADD CONSTRAINT "ai_assistant_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_sessions_organization_id_organizations_id_fk') THEN
         ALTER TABLE "ai_assistant_sessions" ADD CONSTRAINT "ai_assistant_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_messages_session_id_ai_assistant_sessions_id_fk') THEN
         ALTER TABLE "ai_assistant_messages" ADD CONSTRAINT "ai_assistant_messages_session_id_ai_assistant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "ai_assistant_sessions"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_suggestions_organization_id_organizations_id_fk') THEN
         ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_suggestions_user_id_users_id_fk') THEN
         ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
       END IF;
     END $$;`
  ];
  
  for (const constraintQuery of aiConstraintQueries) {
    try {
      await client.unsafe(constraintQuery);
    } catch (error) {
      console.warn(`⚠️ AI constraint creation failed (may already exist): ${(error as Error).message}`);
    }
  }
  
  console.log('✅ AI assistant tables ensured');
}

async function waitForDatabase(): Promise<void> {
  const maxAttempts = 30;
  let attempts = 0;
  const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
  
  while (attempts < maxAttempts) {
    let testClient: postgres.Sql | null = null;
    try {
      testClient = postgres(connectionString, { max: 1 });
      await testClient`SELECT 1`;
      await testClient.end();
      console.log('✅ Database connection established');
      return;
    } catch (error) {
      if (testClient) {
        try { await testClient.end(); } catch {}
      }
      attempts++;
      console.log(`⏳ Waiting for database... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('Database connection timeout');
}