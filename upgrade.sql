-- ConfigMaster GitHub Integration Upgrade Script
-- This script safely upgrades existing installations to support GitHub integration
-- Run this against your existing database to add GitHub functionality

BEGIN;

-- Add metadata column to configurations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configurations' AND column_name='metadata') THEN
        ALTER TABLE "configurations" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added metadata column to configurations table';
    ELSE
        RAISE NOTICE 'Metadata column already exists in configurations table';
    END IF;
END $$;

-- Create GitHub integrations table if it doesn't exist
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

-- Create configuration GitHub mappings table if it doesn't exist
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

-- Create GitHub pull requests table if it doesn't exist
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

-- Add foreign key constraints safely
DO $$ 
BEGIN
    -- github_integrations constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_integrations_organization_id_organizations_id_fk') THEN
        ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");
        RAISE NOTICE 'Added github_integrations organization constraint';
    END IF;
    
    -- configuration_github_mappings constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuration_github_mappings_configuration_id_configurations_i') THEN
        ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_configuration_id_configurations_i" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade;
        RAISE NOTICE 'Added configuration_github_mappings configuration constraint';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuration_github_mappings_github_integration_id_github_i') THEN
        ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_github_integration_id_github_i" FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade;
        RAISE NOTICE 'Added configuration_github_mappings integration constraint';
    END IF;
    
    -- github_pull_requests constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_pull_requests_github_integration_id_github_integrations') THEN
        ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_github_integration_id_github_integrations" FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade;
        RAISE NOTICE 'Added github_pull_requests integration constraint';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_pull_requests_configuration_id_configurations_id_fk') THEN
        ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade;
        RAISE NOTICE 'Added github_pull_requests configuration constraint';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'github_pull_requests_created_by_users_id_fk') THEN
        ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
        RAISE NOTICE 'Added github_pull_requests user constraint';
    END IF;
END $$;

COMMIT;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ ConfigMaster GitHub Integration upgrade completed successfully!';
    RAISE NOTICE '📋 Summary:';
    RAISE NOTICE '   - Added metadata column to configurations table';
    RAISE NOTICE '   - Created github_integrations table';
    RAISE NOTICE '   - Created configuration_github_mappings table';
    RAISE NOTICE '   - Created github_pull_requests table';
    RAISE NOTICE '   - Added all necessary foreign key constraints';
    RAISE NOTICE '🚀 Your ConfigMaster installation now supports GitHub integration!';
END $$;