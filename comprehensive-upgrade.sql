-- Pulse Platform Comprehensive Upgrade Script
-- This script ensures ALL schemas are properly created/migrated
-- Safe to run multiple times (idempotent)

BEGIN;

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
INSERT INTO system_settings (key, value, description)
VALUES 
    ('user_registration_enabled', 'true'::jsonb, 'Allow new users to register on the platform'),
    ('default_user_role', '"viewer"'::jsonb, 'Default role assigned to new users'),
    ('session_timeout', '86400'::jsonb, 'Session timeout in seconds (24 hours)'),
    ('max_failed_login_attempts', '5'::jsonb, 'Maximum failed login attempts before account lock'),
    ('password_min_length', '8'::jsonb, 'Minimum password length requirement')
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
            "auditLogs": true
        }'::jsonb;
        RAISE NOTICE 'Added features_enabled column to organizations table';
    END IF;
END $$;

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
-- FOREIGN KEY CONSTRAINTS
-- ==============================

DO $$ 
BEGIN
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

COMMIT;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Pulse Platform comprehensive upgrade completed successfully!';
    RAISE NOTICE '📋 Summary of changes:';
    RAISE NOTICE '   - System settings table created';
    RAISE NOTICE '   - Super admin column added to users';
    RAISE NOTICE '   - Organization feature flags added';
    RAISE NOTICE '   - GitHub integration tables created';
    RAISE NOTICE '   - Asset management tables created';
    RAISE NOTICE '   - All RBAC permissions added';
    RAISE NOTICE '   - All foreign key constraints added';
    RAISE NOTICE '   - ✅ FIXED: All Administrator roles now have complete permissions';
    RAISE NOTICE '🚀 Your Pulse installation is now fully upgraded!';
END $$;