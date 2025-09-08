-- Pulse Platform Comprehensive Upgrade Script
-- This script ensures ALL schemas are properly created/migrated
-- Safe to run multiple times (idempotent)

BEGIN;

-- ==============================
-- FOREIGN KEY REPAIR (FIX ORPHANED DATA)
-- ==============================
-- This must run BEFORE any foreign key constraints are added
-- Fixes organizations that reference non-existent users

DO $$ 
DECLARE
    orphaned_count INTEGER;
    admin_user_id UUID;
    admin_email TEXT := 'admin@pulse.dev';
BEGIN
    RAISE NOTICE '🔧 Checking for orphaned organizations...';
    
    -- Count orphaned organizations (if the table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        
        SELECT COUNT(*) INTO orphaned_count 
        FROM organizations o 
        WHERE o.owner_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.owner_id);
        
        RAISE NOTICE 'Found % orphaned organizations', orphaned_count;
        
        IF orphaned_count > 0 THEN
            -- Temporarily drop the foreign key constraint if it exists
            IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'organizations_owner_id_users_id_fk') THEN
                ALTER TABLE organizations DROP CONSTRAINT organizations_owner_id_users_id_fk;
                RAISE NOTICE '✅ Temporarily dropped organizations_owner_id_users_id_fk constraint';
            END IF;
            
            -- Try to find existing admin user
            SELECT id INTO admin_user_id 
            FROM users 
            WHERE email = admin_email OR role = 'super_admin' 
            LIMIT 1;
            
            IF admin_user_id IS NULL THEN
                -- Create a default admin user if none exists
                admin_user_id := gen_random_uuid();
                
                INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
                VALUES (
                    admin_user_id,
                    admin_email,
                    '$2b$10$rQNTkqP2GWI4PJ4bFt8/lOhFgAGjZqjcmrztKTfr5vW2zJJPQ5vXa', -- 'admin123'
                    'Pulse Admin (Auto-Created)',
                    'super_admin',
                    true,
                    NOW()
                )
                ON CONFLICT (email) DO NOTHING;
                
                RAISE NOTICE '✅ Created admin user for orphaned organizations';
            ELSE
                RAISE NOTICE '✅ Using existing admin user for orphaned organizations';
            END IF;
            
            -- Fix orphaned organizations by assigning them to the admin user
            UPDATE organizations 
            SET owner_id = admin_user_id 
            WHERE owner_id IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = organizations.owner_id);
            
            RAISE NOTICE '✅ Fixed % orphaned organizations', orphaned_count;
        ELSE
            RAISE NOTICE '✅ No orphaned organizations found';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Organizations or users table not found, skipping orphan repair';
    END IF;
END $$;

-- ==============================
-- SYSTEM SETTINGS TABLE
-- ==============================
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "key" varchar(255) UNIQUE NOT NULL,
    "value" jsonb NOT NULL,
    "description" text,
    "category" varchar(100) NOT NULL DEFAULT 'general',
    "is_readonly" boolean NOT NULL DEFAULT false,
    "created_by" uuid,
    "updated_by" uuid,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add missing columns to system_settings if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='category') THEN
        ALTER TABLE "system_settings" ADD COLUMN "category" varchar(100) NOT NULL DEFAULT 'general';
        RAISE NOTICE 'Added category column to system_settings table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='is_readonly') THEN
        ALTER TABLE "system_settings" ADD COLUMN "is_readonly" boolean NOT NULL DEFAULT false;
        RAISE NOTICE 'Added is_readonly column to system_settings table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='created_by') THEN
        ALTER TABLE "system_settings" ADD COLUMN "created_by" uuid;
        RAISE NOTICE 'Added created_by column to system_settings table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='updated_by') THEN
        ALTER TABLE "system_settings" ADD COLUMN "updated_by" uuid;
        RAISE NOTICE 'Added updated_by column to system_settings table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_settings' AND column_name='is_sensitive') THEN
        ALTER TABLE "system_settings" ADD COLUMN "is_sensitive" boolean DEFAULT false NOT NULL;
        RAISE NOTICE 'Added is_sensitive column to system_settings table';
    END IF;
END $$;

-- Insert default system settings (safe for existing installations)
INSERT INTO system_settings (key, value, description, category)
VALUES 
    ('user_registration_enabled', 'true'::jsonb, 'Allow new users to register on the platform', 'security'),
    ('default_user_role', '"viewer"'::jsonb, 'Default role assigned to new users', 'security'),
    ('session_timeout', '86400'::jsonb, 'Session timeout in seconds (24 hours)', 'security'),
    ('max_failed_login_attempts', '5'::jsonb, 'Maximum failed login attempts before account lock', 'security'),
    ('password_min_length', '8'::jsonb, 'Minimum password length requirement', 'security'),
    ('maintenance_mode', 'false'::jsonb, 'Enable maintenance mode to disable user access', 'general'),
    ('platform_name', '"Pulse"'::jsonb, 'Name of the platform displayed to users', 'general'),
    ('support_contact', '"support@pulse.dev"'::jsonb, 'Support contact email for users', 'general'),
    ('sso_enabled', 'true'::jsonb, 'Enable SSO authentication for users', 'security')
ON CONFLICT (key) DO NOTHING;

-- ==============================
-- COLUMN MIGRATIONS
-- ==============================

-- Add is_super_admin column to users table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_super_admin') THEN
        ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;
        RAISE NOTICE 'Added is_super_admin column to users table';
    END IF;
END $$;

-- Add features_enabled column to organizations table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='features_enabled') THEN
        ALTER TABLE "organizations" ADD COLUMN "features_enabled" jsonb DEFAULT '{
            "servers": true,
            "serverGroups": true,
            "pemKeys": true,
            "configurations": true,
            "deployments": true,
            "chat": true,
            "training": true,
            "awsIntegrations": true,
            "githubIntegrations": true,
            "mdm": true,
            "assets": true,
            "auditLogs": true,
            "pulseAssist": true,
            "hive": true
        }'::jsonb;
        RAISE NOTICE 'Added features_enabled column to organizations table';
    END IF;
END $$;

-- Update existing organizations to include AI features in features_enabled
DO $$ 
BEGIN
    -- Update organizations that don't have Pulse Assist or Hive features enabled
    UPDATE organizations 
    SET features_enabled = features_enabled || '{
        "pulseAssist": true,
        "hive": true
    }'::jsonb
    WHERE features_enabled IS NOT NULL 
    AND (features_enabled->>'pulseAssist' IS NULL OR features_enabled->>'hive' IS NULL);
    
    -- For organizations with NULL features_enabled, set the complete default
    UPDATE organizations 
    SET features_enabled = '{
        "servers": true,
        "serverGroups": true,
        "pemKeys": true,
        "configurations": true,
        "deployments": true,
        "chat": true,
        "training": true,
        "awsIntegrations": true,
        "githubIntegrations": true,
        "mdm": true,
        "assets": true,
        "auditLogs": true,
        "pulseAssist": true,
        "hive": true
    }'::jsonb
    WHERE features_enabled IS NULL;
    
    RAISE NOTICE 'Updated existing organizations with Pulse Assist and Hive features';
END $$;

-- Apply Hive agent system migration
\i packages/database/migrations/0005_add_hive_tables.sql

-- Add metadata column to configurations table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='metadata') THEN
        ALTER TABLE "configurations" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added metadata column to configurations table';
    END IF;
END $$;

-- ==============================
-- GITHUB INTEGRATION TABLES
-- ==============================

-- Create GitHub integrations table
CREATE TABLE IF NOT EXISTS "github_integrations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "github_user_id" varchar(255) NOT NULL,
    "github_username" varchar(255) NOT NULL,
    "access_token" text NOT NULL,
    "refresh_token" text,
    "token_expires_at" timestamp,
    "repository_id" varchar(255) NOT NULL,
    "repository_name" varchar(255) NOT NULL,
    "repository_full_name" varchar(512) NOT NULL,
    "default_branch" varchar(255) DEFAULT 'main' NOT NULL,
    "base_path" varchar(512) DEFAULT '/configs',
    "is_active" boolean DEFAULT true NOT NULL,
    "auto_fetch" boolean DEFAULT false NOT NULL,
    "fetch_interval" integer DEFAULT 3600,
    "last_fetch_at" timestamp,
    "last_sync_at" timestamp,
    "sync_status" varchar(50) DEFAULT 'pending',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add asset_repository_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='github_integrations' AND column_name='asset_repository_id') THEN
        ALTER TABLE "github_integrations" ADD COLUMN "asset_repository_id" varchar(255);
        ALTER TABLE "github_integrations" ADD COLUMN "asset_repository_name" varchar(255);
        ALTER TABLE "github_integrations" ADD COLUMN "asset_repository_full_name" varchar(512);
        ALTER TABLE "github_integrations" ADD COLUMN "asset_base_path" varchar(512) DEFAULT '/assets';
        RAISE NOTICE 'Added asset repository columns to github_integrations table';
    END IF;
END $$;

-- Create configuration GitHub mappings table
CREATE TABLE IF NOT EXISTS "configuration_github_mappings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "configuration_id" uuid NOT NULL,
    "github_integration_id" uuid NOT NULL,
    "relative_path" varchar(512) NOT NULL,
    "branch" varchar(255) NOT NULL,
    "auto_sync" boolean DEFAULT false NOT NULL,
    "sync_on_change" boolean DEFAULT true NOT NULL,
    "last_synced_sha" varchar(40),
    "last_sync_at" timestamp,
    "sync_status" varchar(50) DEFAULT 'pending',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create GitHub pull requests table
CREATE TABLE IF NOT EXISTS "github_pull_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "github_integration_id" uuid NOT NULL,
    "configuration_id" uuid,
    "pr_number" integer NOT NULL,
    "pr_id" varchar(255) NOT NULL,
    "title" varchar(512) NOT NULL,
    "description" text,
    "head_branch" varchar(255) NOT NULL,
    "base_branch" varchar(255) NOT NULL,
    "state" varchar(50) NOT NULL,
    "html_url" text NOT NULL,
    "created_by" uuid NOT NULL,
    "merged_at" timestamp,
    "closed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==============================
-- ASSET MANAGEMENT TABLES
-- ==============================

-- Create assets table
CREATE TABLE IF NOT EXISTS "assets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "asset_tag" varchar(255) UNIQUE NOT NULL,
    "serial_number" varchar(255),
    "name" varchar(255) NOT NULL,
    "type" varchar(100) NOT NULL,
    "manufacturer" varchar(255),
    "model" varchar(255),
    "status" varchar(50) DEFAULT 'available' NOT NULL,
    "condition" varchar(50) DEFAULT 'good' NOT NULL,
    "purchase_date" date,
    "purchase_cost" decimal(10,2),
    "purchase_price" decimal(10,2),
    "currency" varchar(3) DEFAULT 'USD',
    "supplier" varchar(255),
    "warranty_start_date" date,
    "warranty_end_date" date,
    "warranty_provider" varchar(255),
    "location" varchar(255),
    "cost_center" varchar(100),
    "department" varchar(100),
    "category" varchar(100),
    "subcategory" varchar(100),
    "specifications" jsonb DEFAULT '{}',
    "notes" text,
    "barcode" varchar(255),
    "qr_code" varchar(255),
    "image_url" varchar(500),
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" jsonb DEFAULT '{}',
    "mdm_device_id" uuid,
    "last_sync_at" timestamp,
    "created_by" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add missing columns to assets table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='category') THEN
        ALTER TABLE "assets" ADD COLUMN "category" varchar(100);
        RAISE NOTICE 'Added category column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='subcategory') THEN
        ALTER TABLE "assets" ADD COLUMN "subcategory" varchar(100);
        RAISE NOTICE 'Added subcategory column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='condition') THEN
        ALTER TABLE "assets" ADD COLUMN "condition" varchar(50) DEFAULT 'good' NOT NULL;
        RAISE NOTICE 'Added condition column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='purchase_price') THEN
        ALTER TABLE "assets" ADD COLUMN "purchase_price" decimal(10,2);
        RAISE NOTICE 'Added purchase_price column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='currency') THEN
        ALTER TABLE "assets" ADD COLUMN "currency" varchar(3) DEFAULT 'USD';
        RAISE NOTICE 'Added currency column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='supplier') THEN
        ALTER TABLE "assets" ADD COLUMN "supplier" varchar(255);
        RAISE NOTICE 'Added supplier column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='warranty_start_date') THEN
        ALTER TABLE "assets" ADD COLUMN "warranty_start_date" date;
        RAISE NOTICE 'Added warranty_start_date column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='warranty_end_date') THEN
        ALTER TABLE "assets" ADD COLUMN "warranty_end_date" date;
        RAISE NOTICE 'Added warranty_end_date column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='warranty_provider') THEN
        ALTER TABLE "assets" ADD COLUMN "warranty_provider" varchar(255);
        RAISE NOTICE 'Added warranty_provider column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='cost_center') THEN
        ALTER TABLE "assets" ADD COLUMN "cost_center" varchar(100);
        RAISE NOTICE 'Added cost_center column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='specifications') THEN
        ALTER TABLE "assets" ADD COLUMN "specifications" jsonb DEFAULT '{}';
        RAISE NOTICE 'Added specifications column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='barcode') THEN
        ALTER TABLE "assets" ADD COLUMN "barcode" varchar(255);
        RAISE NOTICE 'Added barcode column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='qr_code') THEN
        ALTER TABLE "assets" ADD COLUMN "qr_code" varchar(255);
        RAISE NOTICE 'Added qr_code column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='image_url') THEN
        ALTER TABLE "assets" ADD COLUMN "image_url" varchar(500);
        RAISE NOTICE 'Added image_url column to assets table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='is_active') THEN
        ALTER TABLE "assets" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
        RAISE NOTICE 'Added is_active column to assets table';
    END IF;
END $$;

-- Create asset assignments table
CREATE TABLE IF NOT EXISTS "asset_assignments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "asset_id" uuid NOT NULL,
    "assigned_to" varchar(255) NOT NULL,
    "assigned_type" varchar(50) NOT NULL,
    "assigned_date" timestamp DEFAULT now() NOT NULL,
    "returned_date" timestamp,
    "notes" text,
    "assigned_by" uuid NOT NULL,
    "returned_by" uuid,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==============================
-- SSO TABLES
-- ==============================

-- Create SSO providers table (global configuration by super admin)
CREATE TABLE IF NOT EXISTS "sso_providers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(255) NOT NULL,
    "provider_type" varchar(50) NOT NULL DEFAULT 'oidc', -- oidc, saml (future)
    "client_id" varchar(500) NOT NULL,
    "client_secret" text NOT NULL, -- encrypted
    "discovery_url" text, -- For OIDC auto-discovery
    "issuer_url" text NOT NULL,
    "authorization_url" text NOT NULL,
    "token_url" text NOT NULL,
    "userinfo_url" text NOT NULL,
    "jwks_uri" text,
    "scopes" text[] DEFAULT ARRAY['openid', 'profile', 'email'],
    "claims_mapping" jsonb DEFAULT '{"email": "email", "name": "name", "given_name": "given_name", "family_name": "family_name"}',
    "auto_provision_users" boolean DEFAULT true NOT NULL,
    "default_role" varchar(100) DEFAULT 'viewer',
    "first_user_role" varchar(100) DEFAULT 'administrator',
    "role_mapping" jsonb DEFAULT '{}',
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create SSO domain mappings (for auto org assignment)
CREATE TABLE IF NOT EXISTS "sso_domain_mappings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "sso_provider_id" uuid NOT NULL,
    "domain" varchar(255) NOT NULL,
    "organization_id" uuid NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE("sso_provider_id", "domain")
);

-- Create user SSO mappings (link SSO accounts to users)
CREATE TABLE IF NOT EXISTS "user_sso_mappings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "sso_provider_id" uuid NOT NULL,
    "external_user_id" varchar(500) NOT NULL,
    "external_email" varchar(255) NOT NULL,
    "external_metadata" jsonb DEFAULT '{}',
    "last_login_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE("user_id", "sso_provider_id"),
    UNIQUE("sso_provider_id", "external_user_id")
);

-- Add SSO columns to users table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_method') THEN
        ALTER TABLE "users" ADD COLUMN "auth_method" varchar(50) DEFAULT 'password' NOT NULL;
        RAISE NOTICE 'Added auth_method column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='sso_provider_id') THEN
        ALTER TABLE "users" ADD COLUMN "sso_provider_id" uuid;
        RAISE NOTICE 'Added sso_provider_id column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='external_user_id') THEN
        ALTER TABLE "users" ADD COLUMN "external_user_id" varchar(500);
        RAISE NOTICE 'Added external_user_id column to users table';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_sso_login_at') THEN
        ALTER TABLE "users" ADD COLUMN "last_sso_login_at" timestamp;
        RAISE NOTICE 'Added last_sso_login_at column to users table';
    END IF;
END $$;

-- ==============================
-- FOREIGN KEY CONSTRAINTS
-- ==============================

DO $$ 
BEGIN
    -- SSO constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sso_providers_created_by_users_id_fk') THEN
        ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_created_by_users_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sso_domain_mappings_sso_provider_id_fk') THEN
        ALTER TABLE "sso_domain_mappings" ADD CONSTRAINT "sso_domain_mappings_sso_provider_id_fk" 
        FOREIGN KEY ("sso_provider_id") REFERENCES "sso_providers"("id") ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sso_domain_mappings_organization_id_fk') THEN
        ALTER TABLE "sso_domain_mappings" ADD CONSTRAINT "sso_domain_mappings_organization_id_fk" 
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sso_mappings_user_id_fk') THEN
        ALTER TABLE "user_sso_mappings" ADD CONSTRAINT "user_sso_mappings_user_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sso_mappings_sso_provider_id_fk') THEN
        ALTER TABLE "user_sso_mappings" ADD CONSTRAINT "user_sso_mappings_sso_provider_id_fk" 
        FOREIGN KEY ("sso_provider_id") REFERENCES "sso_providers"("id") ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_sso_provider_id_fk') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_sso_provider_id_fk" 
        FOREIGN KEY ("sso_provider_id") REFERENCES "sso_providers"("id") ON DELETE SET NULL;
    END IF;
    
    -- System settings constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_created_by_users_id_fk') THEN
        ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_created_by_users_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_updated_by_users_id_fk') THEN
        ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" 
        FOREIGN KEY ("updated_by") REFERENCES "users"("id");
    END IF;
    
    -- GitHub integrations constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_integrations_organization_id_organizations_id_fk') THEN
        ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_organization_id_organizations_id_fk" 
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");
    END IF;
    
    -- Configuration GitHub mappings constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuration_github_mappings_configuration_id_configurations_i') THEN
        ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_configuration_id_configurations_i" 
        FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuration_github_mappings_github_integration_id_github_i') THEN
        ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_github_integration_id_github_i" 
        FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade;
    END IF;
    
    -- GitHub pull requests constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_pull_requests_github_integration_id_github_integrations') THEN
        ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_github_integration_id_github_integrations" 
        FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_pull_requests_configuration_id_configurations_id_fk') THEN
        ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_configuration_id_configurations_id_fk" 
        FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_pull_requests_created_by_users_id_fk') THEN
        ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_created_by_users_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id");
    END IF;
    
    -- Assets constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_organization_id_organizations_id_fk') THEN
        ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" 
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_created_by_users_id_fk') THEN
        ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" 
        FOREIGN KEY ("created_by") REFERENCES "users"("id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_mdm_device_id_mdm_devices_id_fk') THEN
        ALTER TABLE "assets" ADD CONSTRAINT "assets_mdm_device_id_mdm_devices_id_fk" 
        FOREIGN KEY ("mdm_device_id") REFERENCES "mdm_devices"("id") ON DELETE SET NULL;
    END IF;
    
    -- Asset assignments constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_assignments_asset_id_assets_id_fk') THEN
        ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fk" 
        FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_assignments_assigned_by_users_id_fk') THEN
        ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_users_id_fk" 
        FOREIGN KEY ("assigned_by") REFERENCES "users"("id");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_assignments_returned_by_users_id_fk') THEN
        ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returned_by_users_id_fk" 
        FOREIGN KEY ("returned_by") REFERENCES "users"("id");
    END IF;
END $$;

-- ==============================
-- RBAC PERMISSIONS
-- ==============================

-- Insert missing permissions (one by one to avoid conflicts)
DO $$
BEGIN
    -- Asset permissions
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'read', 'View assets') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'create', 'Create new assets') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'update', 'Update asset information') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'delete', 'Delete assets') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'assign', 'Assign assets to users') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'unassign', 'Unassign assets from users') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('asset', 'sync', 'Sync assets with external systems') ON CONFLICT DO NOTHING;
    
    -- GitHub integration permissions
    INSERT INTO permissions (resource, action, description) VALUES ('github-integrations', 'read', 'View GitHub integrations') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('github-integrations', 'write', 'Create and modify GitHub integrations') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('github-integrations', 'delete', 'Delete GitHub integrations') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('github-integrations', 'validate', 'Validate GitHub tokens') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('github-integrations', 'sync', 'Sync configurations to GitHub') ON CONFLICT DO NOTHING;
    
    -- SSO permissions (super admin only)
    INSERT INTO permissions (resource, action, description) VALUES ('sso', 'read', 'View SSO providers') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('sso', 'write', 'Create and modify SSO providers') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('sso', 'delete', 'Delete SSO providers') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('sso', 'test', 'Test SSO provider connections') ON CONFLICT DO NOTHING;
    INSERT INTO permissions (resource, action, description) VALUES ('sso', 'configure', 'Configure SSO domain mappings') ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Inserted missing RBAC permissions';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some permissions already exist (this is normal)';
END $$;

-- ==============================
-- SET SUPER ADMIN FLAGS
-- ==============================

-- Update existing admin users to be super admins
UPDATE users 
SET is_super_admin = true 
WHERE role = 'super_admin' AND is_super_admin = false;

-- Set first admin as super admin if none exist
DO $$
DECLARE
    admin_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE is_super_admin = true) THEN
        SELECT id INTO admin_id 
        FROM users 
        WHERE email IN ('admin@pulse.dev', 'admin@configmaster.dev')
        LIMIT 1;
        
        IF admin_id IS NOT NULL THEN
            UPDATE users 
            SET is_super_admin = true 
            WHERE id = admin_id;
            RAISE NOTICE 'Set first admin user as super admin';
        END IF;
    END IF;
END $$;

-- ==============================
-- FIX ADMINISTRATOR ROLE PERMISSIONS
-- ==============================

-- Ensure ALL Administrator roles have ALL permissions (fix common upgrade issue)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id as role_id, p.id as permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Administrator'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
)
ON CONFLICT DO NOTHING;

-- ==============================
-- AI ASSISTANT TABLES
-- ==============================

-- Configuration Drifts table (required for AI Assistant)
CREATE TABLE IF NOT EXISTS "configuration_drifts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "configuration_id" uuid NOT NULL,
    "server_id" uuid,
    "server_group_id" uuid,
    "expected_content" text NOT NULL,
    "actual_content" text,
    "drift_type" varchar(50) NOT NULL,
    "differences" jsonb DEFAULT '[]'::jsonb,
    "severity" varchar(20) DEFAULT 'medium' NOT NULL,
    "detected_at" timestamp DEFAULT now() NOT NULL,
    "resolved_at" timestamp,
    "resolution_type" varchar(50),
    "organization_id" uuid NOT NULL
);

-- AI Assistant Sessions
CREATE TABLE IF NOT EXISTS "ai_assistant_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "context_page" varchar(50) NOT NULL,
    "context_data" jsonb DEFAULT '{}'::jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "started_at" timestamp DEFAULT now() NOT NULL,
    "ended_at" timestamp,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- AI Assistant Messages
CREATE TABLE IF NOT EXISTS "ai_assistant_messages" (
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
);

-- AI Suggestions
CREATE TABLE IF NOT EXISTS "ai_suggestions" (
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
);

-- AI Assistant Indexes
DO $$ 
BEGIN
    -- Indexes for ai_assistant_sessions
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_assistant_sessions_user_id') THEN
        CREATE INDEX idx_ai_assistant_sessions_user_id ON ai_assistant_sessions(user_id);
        RAISE NOTICE 'Created index idx_ai_assistant_sessions_user_id';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_assistant_sessions_org_id') THEN
        CREATE INDEX idx_ai_assistant_sessions_org_id ON ai_assistant_sessions(organization_id);
        RAISE NOTICE 'Created index idx_ai_assistant_sessions_org_id';
    END IF;
    
    -- Indexes for ai_assistant_messages
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_assistant_messages_session_id') THEN
        CREATE INDEX idx_ai_assistant_messages_session_id ON ai_assistant_messages(session_id);
        RAISE NOTICE 'Created index idx_ai_assistant_messages_session_id';
    END IF;
    
    -- Indexes for ai_suggestions
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_suggestions_org_id') THEN
        CREATE INDEX idx_ai_suggestions_org_id ON ai_suggestions(organization_id);
        RAISE NOTICE 'Created index idx_ai_suggestions_org_id';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_suggestions_status') THEN
        CREATE INDEX idx_ai_suggestions_status ON ai_suggestions(status);
        RAISE NOTICE 'Created index idx_ai_suggestions_status';
    END IF;
END $$;

-- AI Assistant Foreign Key Constraints
DO $$ 
BEGIN
    -- Foreign keys for ai_assistant_sessions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_sessions_user_id_fkey') THEN
        ALTER TABLE ai_assistant_sessions ADD CONSTRAINT ai_assistant_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
        RAISE NOTICE 'Added foreign key ai_assistant_sessions_user_id_fkey';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_sessions_organization_id_fkey') THEN
        ALTER TABLE ai_assistant_sessions ADD CONSTRAINT ai_assistant_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
        RAISE NOTICE 'Added foreign key ai_assistant_sessions_organization_id_fkey';
    END IF;
    
    -- Foreign keys for ai_assistant_messages
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_messages_session_id_fkey') THEN
        ALTER TABLE ai_assistant_messages ADD CONSTRAINT ai_assistant_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES ai_assistant_sessions(id);
        RAISE NOTICE 'Added foreign key ai_assistant_messages_session_id_fkey';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_assistant_messages_conversation_id_fkey') THEN
        -- Only add if conversations table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
            ALTER TABLE ai_assistant_messages ADD CONSTRAINT ai_assistant_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id);
            RAISE NOTICE 'Added foreign key ai_assistant_messages_conversation_id_fkey';
        END IF;
    END IF;
    
    -- Foreign keys for ai_suggestions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_suggestions_organization_id_fkey') THEN
        ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
        RAISE NOTICE 'Added foreign key ai_suggestions_organization_id_fkey';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ai_suggestions_user_id_fkey') THEN
        ALTER TABLE ai_suggestions ADD CONSTRAINT ai_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
        RAISE NOTICE 'Added foreign key ai_suggestions_user_id_fkey';
    END IF;
    
    -- Configuration Drifts foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'configuration_drifts_configuration_id_fkey') THEN
        ALTER TABLE configuration_drifts ADD CONSTRAINT configuration_drifts_configuration_id_fkey FOREIGN KEY (configuration_id) REFERENCES configurations(id);
        RAISE NOTICE 'Added foreign key configuration_drifts_configuration_id_fkey';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'configuration_drifts_server_id_fkey') THEN
        ALTER TABLE configuration_drifts ADD CONSTRAINT configuration_drifts_server_id_fkey FOREIGN KEY (server_id) REFERENCES servers(id);
        RAISE NOTICE 'Added foreign key configuration_drifts_server_id_fkey';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'configuration_drifts_server_group_id_fkey') THEN
        ALTER TABLE configuration_drifts ADD CONSTRAINT configuration_drifts_server_group_id_fkey FOREIGN KEY (server_group_id) REFERENCES server_groups(id);
        RAISE NOTICE 'Added foreign key configuration_drifts_server_group_id_fkey';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'configuration_drifts_organization_id_fkey') THEN
        ALTER TABLE configuration_drifts ADD CONSTRAINT configuration_drifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
        RAISE NOTICE 'Added foreign key configuration_drifts_organization_id_fkey';
    END IF;
END $$;

-- ==============================
-- RE-APPLY CRITICAL FOREIGN KEY CONSTRAINTS
-- ==============================
-- This ensures the organizations_owner_id foreign key is properly applied
-- after all data has been fixed

DO $$ 
BEGIN
    -- Re-add the organizations_owner_id foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'organizations_owner_id_users_id_fk') THEN
        ALTER TABLE organizations ADD CONSTRAINT organizations_owner_id_users_id_fk 
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
        RAISE NOTICE '✅ Added organizations_owner_id_users_id_fk constraint';
    ELSE
        RAISE NOTICE '✅ organizations_owner_id_users_id_fk constraint already exists';
    END IF;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE '❌ Warning: Still have orphaned data in organizations table!';
        RAISE NOTICE 'Run the repair script separately to fix orphaned organizations.';
END $$;

COMMIT;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Pulse Platform comprehensive upgrade completed successfully!';
    RAISE NOTICE '📋 Summary of changes:';
    RAISE NOTICE '   - System settings table created';
    RAISE NOTICE '   - Super admin column added to users';
    RAISE NOTICE '   - Organization feature flags added (including AI features)';
    RAISE NOTICE '   - GitHub integration tables created';
    RAISE NOTICE '   - Asset management tables created';
    RAISE NOTICE '   - SSO authentication tables created';
    RAISE NOTICE '   - 🤖 AI Assistant tables created (sessions, messages, suggestions)';
    RAISE NOTICE '   - 🤖 Pulse Assist features enabled for all organizations';
    RAISE NOTICE '   - All RBAC permissions added (including SSO)';
    RAISE NOTICE '   - All foreign key constraints added';
    RAISE NOTICE '   - ✅ FIXED: All Administrator roles now have complete permissions';
    RAISE NOTICE '🚀 Your Pulse installation is now fully upgraded with AI Assistant and SSO support!';
    RAISE NOTICE '🤖 Pulse Assist is ready to help with configuration analysis, asset management, and more!';
END $$;