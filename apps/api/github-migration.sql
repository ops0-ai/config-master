-- GitHub Integration Tables Migration
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
	"fetch_interval" integer DEFAULT 300,
	"last_fetch_at" timestamp,
	"last_sync_at" timestamp,
	"sync_status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

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

-- Add Foreign Keys
DO $$ BEGIN
 ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_github_integration_id_github_integrations_id_fk" FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_github_integration_id_github_integrations_id_fk" FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;