-- Discovery Feature Migration
-- This migration adds the tables needed for the Infrastructure Discovery feature

CREATE TABLE IF NOT EXISTS "discovery_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"name" varchar(255),
	"description" text,
	"provider" varchar(50) DEFAULT 'aws' NOT NULL,
	"regions" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"resource_count" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovery_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"region" varchar(50) NOT NULL,
	"provider" varchar(50) DEFAULT 'aws' NOT NULL,
	"tags" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"is_selected" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discovery_code_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"provider" varchar(50) DEFAULT 'opentofu' NOT NULL,
	"terraform_code" text NOT NULL,
	"state_file" jsonb NOT NULL,
	"selected_resource_ids" jsonb NOT NULL,
	"generated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_integration_id_aws_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "aws_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovery_resources" ADD CONSTRAINT "discovery_resources_session_id_discovery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovery_code_generations" ADD CONSTRAINT "discovery_code_generations_session_id_discovery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discovery_code_generations" ADD CONSTRAINT "discovery_code_generations_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_sessions_organization_id" ON "discovery_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_sessions_integration_id" ON "discovery_sessions" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_sessions_status" ON "discovery_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_resources_session_id" ON "discovery_resources" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_resources_resource_type" ON "discovery_resources" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_resources_region" ON "discovery_resources" USING btree ("region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_discovery_code_generations_session_id" ON "discovery_code_generations" USING btree ("session_id");--> statement-breakpoint

-- Update organizations table to include discovery feature flag if it doesn't already exist
DO $$
BEGIN
    -- Check if the features_enabled column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'features_enabled'
    ) THEN
        -- Update existing organizations to include discovery feature
        UPDATE "organizations" 
        SET "features_enabled" = COALESCE("features_enabled", '{}'::jsonb) || '{"discovery": true}'::jsonb
        WHERE "features_enabled" IS NULL OR NOT ("features_enabled" ? 'discovery');
    ELSE
        -- If features_enabled column doesn't exist, add it with discovery enabled
        ALTER TABLE "organizations" ADD COLUMN "features_enabled" jsonb DEFAULT '{"servers":true,"serverGroups":true,"pemKeys":true,"configurations":true,"deployments":true,"chat":true,"training":true,"awsIntegrations":true,"githubIntegrations":true,"mdm":true,"assets":true,"auditLogs":true,"discovery":true}'::jsonb;
    END IF;
END $$;