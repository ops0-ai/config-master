CREATE TABLE IF NOT EXISTS "aws_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"instance_id" varchar(255) NOT NULL,
	"region" varchar(50) NOT NULL,
	"name" varchar(255),
	"state" varchar(50),
	"instance_type" varchar(50),
	"public_ip" varchar(45),
	"private_ip" varchar(45),
	"public_dns" text,
	"private_dns" text,
	"key_name" varchar(255),
	"vpc_id" varchar(255),
	"subnet_id" varchar(255),
	"security_groups" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '{}'::jsonb,
	"platform" varchar(50),
	"launch_time" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aws_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"role_arn" text NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"sync_status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claude_api_key" text,
	"default_region" varchar(50) DEFAULT 'us-east-1',
	"max_concurrent_deployments" integer DEFAULT 5,
	"deployment_timeout" integer DEFAULT 300,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "schedule_type" varchar(20) DEFAULT 'immediate';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "scheduled_for" timestamp;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "cron_expression" varchar(100);--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "timezone" varchar(50) DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "next_run_at" timestamp;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "last_run_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aws_instances" ADD CONSTRAINT "aws_instances_integration_id_aws_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "aws_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aws_integrations" ADD CONSTRAINT "aws_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_github_mappings" ADD CONSTRAINT "configuration_github_mappings_github_integration_id_github_integrations_id_fk" FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_github_integration_id_github_integrations_id_fk" FOREIGN KEY ("github_integration_id") REFERENCES "github_integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
