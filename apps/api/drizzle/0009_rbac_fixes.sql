-- Migration 0009: Fix RBAC tables with missing columns
-- Add missing columns to roles table and fix user_roles table

-- Add missing columns to roles table
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "created_by" uuid;

-- Add missing columns to user_roles table  
ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "assigned_by" uuid;

-- Add foreign key constraints for new columns
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;