-- Migration 0012: Add missing columns for complete feature support

-- Add features_enabled to organizations table
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "features_enabled" jsonb DEFAULT '{"servers": true, "serverGroups": true, "pemKeys": true, "configurations": true, "deployments": true, "chat": true, "training": true, "awsIntegrations": true, "githubIntegrations": true, "mdm": true, "assets": true, "auditLogs": true}'::jsonb;

-- Add metadata to organizations table  
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

-- Add metadata to configurations table
ALTER TABLE "configurations" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- Add MDM device ID to assets table (if not already added in 0011)
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "mdm_device_id" varchar;

-- Add super admin flag to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false;

-- Add onboarding completion flag to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_completed_onboarding" boolean DEFAULT false;

-- Update existing organizations that don't have features_enabled set
UPDATE "organizations" 
SET "features_enabled" = '{"servers": true, "serverGroups": true, "pemKeys": true, "configurations": true, "deployments": true, "chat": true, "training": true, "awsIntegrations": true, "githubIntegrations": true, "mdm": true, "assets": true, "auditLogs": true}'::jsonb 
WHERE "features_enabled" IS NULL;