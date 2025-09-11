CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" uuid,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "configuration_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"configuration_id" uuid NOT NULL,
	"expected_state" jsonb NOT NULL,
	"actual_state" jsonb,
	"status" varchar(50) DEFAULT 'unknown' NOT NULL,
	"last_checked" timestamp,
	"drift_detected" boolean DEFAULT false NOT NULL,
	"drift_details" jsonb,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(100) NOT NULL,
	"ansible_playbook" text NOT NULL,
	"variables" jsonb,
	"tags" jsonb,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255),
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"configuration_id" uuid NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"logs" text,
	"output" text,
	"error_message" text,
	"executed_by" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"generated_configuration" text,
	"configuration_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pem_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"encrypted_private_key" text NOT NULL,
	"public_key" text,
	"fingerprint" varchar(255),
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"default_pem_key_id" uuid,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"hostname" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"port" integer DEFAULT 22 NOT NULL,
	"username" varchar(255) DEFAULT 'root' NOT NULL,
	"operating_system" varchar(100),
	"os_version" varchar(100),
	"status" varchar(50) DEFAULT 'unknown' NOT NULL,
	"last_seen" timestamp,
	"group_id" uuid,
	"pem_key_id" uuid,
	"organization_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_states" ADD CONSTRAINT "configuration_states_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_states" ADD CONSTRAINT "configuration_states_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_states" ADD CONSTRAINT "configuration_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configurations" ADD CONSTRAINT "configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configurations" ADD CONSTRAINT "configurations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_executed_by_users_id_fk" FOREIGN KEY ("executed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pem_keys" ADD CONSTRAINT "pem_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_groups" ADD CONSTRAINT "server_groups_default_pem_key_id_pem_keys_id_fk" FOREIGN KEY ("default_pem_key_id") REFERENCES "pem_keys"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "server_groups" ADD CONSTRAINT "server_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_group_id_server_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "server_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_pem_key_id_pem_keys_id_fk" FOREIGN KEY ("pem_key_id") REFERENCES "pem_keys"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "servers" ADD CONSTRAINT "servers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"organization_id" uuid NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "section" varchar(100) DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "parent_deployment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
ALTER TABLE "configurations" ADD COLUMN "source" varchar(50) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "approval_status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "server_groups" ADD COLUMN "type" varchar(50) DEFAULT 'mixed';--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "type" varchar(50) DEFAULT 'linux' NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "encrypted_password" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configurations" ADD CONSTRAINT "configurations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "user_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "mdm_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"command_type" varchar(50) NOT NULL,
	"command" text,
	"parameters" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"output" text,
	"error_message" text,
	"exit_code" integer,
	"sent_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"timeout" integer DEFAULT 300,
	"initiated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mdm_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"device_name" varchar(255) NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"serial_number" varchar(255),
	"model" varchar(255),
	"os_version" varchar(100),
	"architecture" varchar(50),
	"ip_address" varchar(45),
	"mac_address" varchar(17),
	"hostname" varchar(255),
	"status" varchar(50) DEFAULT 'offline' NOT NULL,
	"last_seen" timestamp,
	"last_heartbeat" timestamp,
	"battery_level" integer,
	"is_charging" boolean,
	"agent_version" varchar(50),
	"agent_install_path" text,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"enrolled_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mdm_devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mdm_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" uuid NOT NULL,
	"profile_type" varchar(50) DEFAULT 'macos' NOT NULL,
	"allow_remote_commands" boolean DEFAULT true NOT NULL,
	"allow_lock_device" boolean DEFAULT true NOT NULL,
	"allow_shutdown" boolean DEFAULT false NOT NULL,
	"allow_restart" boolean DEFAULT true NOT NULL,
	"allow_wake_on_lan" boolean DEFAULT true NOT NULL,
	"require_authentication" boolean DEFAULT true NOT NULL,
	"max_session_duration" integer DEFAULT 3600,
	"allowed_ip_ranges" jsonb DEFAULT '[]'::jsonb,
	"enrollment_key" varchar(255) NOT NULL,
	"enrollment_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mdm_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "approval_status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "deployments" ADD CONSTRAINT "deployments_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_commands" ADD CONSTRAINT "mdm_commands_device_id_mdm_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "mdm_devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_commands" ADD CONSTRAINT "mdm_commands_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_commands" ADD CONSTRAINT "mdm_commands_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_devices" ADD CONSTRAINT "mdm_devices_profile_id_mdm_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "mdm_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_devices" ADD CONSTRAINT "mdm_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_devices" ADD CONSTRAINT "mdm_devices_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_profiles" ADD CONSTRAINT "mdm_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_profiles" ADD CONSTRAINT "mdm_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_sessions" ADD CONSTRAINT "mdm_sessions_device_id_mdm_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "mdm_devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_sessions" ADD CONSTRAINT "mdm_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mdm_sessions" ADD CONSTRAINT "mdm_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-- Migration 0007: Add multi-tenancy support columns
-- This migration adds the missing columns required for multi-tenancy functionality

-- Add multi-tenancy columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" uuid;

-- Add multi-tenancy columns to organizations table  
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "is_primary" boolean NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

-- Add missing columns to servers table
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "type" varchar(50) NOT NULL DEFAULT 'linux';
ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "encrypted_password" text;

-- Add missing columns to server_groups table
ALTER TABLE "server_groups" ADD COLUMN IF NOT EXISTS "type" varchar(50) DEFAULT 'mixed';

-- Add missing columns to configurations table for approval workflow
ALTER TABLE "configurations" ADD COLUMN IF NOT EXISTS "source" varchar(50) NOT NULL DEFAULT 'manual';
ALTER TABLE "configurations" ADD COLUMN IF NOT EXISTS "approval_status" varchar(50) NOT NULL DEFAULT 'pending';
ALTER TABLE "configurations" ADD COLUMN IF NOT EXISTS "approved_by" uuid;
ALTER TABLE "configurations" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
ALTER TABLE "configurations" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

-- Create user_organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "user_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL DEFAULT 'member',
	"is_active" boolean NOT NULL DEFAULT true,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"organization_id" uuid NOT NULL,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"resource" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create role_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"is_active" boolean NOT NULL DEFAULT true,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "configurations" ADD CONSTRAINT "configurations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;-- Migration 0008: Add onboarding support
-- Add hasCompletedOnboarding column to users table

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_completed_onboarding" boolean NOT NULL DEFAULT false;CREATE TABLE IF NOT EXISTS "asset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"returned_by" uuid,
	"assignment_type" varchar(50) DEFAULT 'permanent',
	"expected_return_date" date,
	"assignment_notes" text,
	"return_notes" text,
	"assignment_location" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"parent_category_id" uuid,
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"performed_by" uuid NOT NULL,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"address" text,
	"parent_location_id" uuid,
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"maintenance_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"scheduled_date" date,
	"completed_date" date,
	"cost" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"vendor" varchar(255),
	"description" text NOT NULL,
	"notes" text,
	"performed_by" uuid,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_tag" varchar(100) NOT NULL,
	"serial_number" varchar(255),
	"asset_type" varchar(50) NOT NULL,
	"brand" varchar(100) NOT NULL,
	"model" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'available' NOT NULL,
	"condition" varchar(50) DEFAULT 'good',
	"purchase_date" date,
	"purchase_price" numeric(10, 2),
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
	"specifications" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"barcode" varchar(255),
	"qr_code" varchar(255),
	"image_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"mdm_device_id" uuid,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_asset_tag_unique" UNIQUE("asset_tag")
);
--> statement-breakpoint
ALTER TABLE "mdm_devices" ALTER COLUMN "profile_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_completed_onboarding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returned_by_users_id_fk" FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_mdm_device_id_mdm_devices_id_fk" FOREIGN KEY ("mdm_device_id") REFERENCES "mdm_devices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
END $$;-- Migration 0010: Asset Management System
-- Add comprehensive asset management tables

-- Assets table - core asset information
CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_tag" varchar(100) UNIQUE NOT NULL,
  "serial_number" varchar(255),
  "asset_type" varchar(50) NOT NULL, -- laptop, desktop, tablet, phone, monitor, printer, etc.
  "brand" varchar(100) NOT NULL,
  "model" varchar(255) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'available', -- available, assigned, in_repair, retired, missing
  "condition" varchar(50) DEFAULT 'good', -- excellent, good, fair, poor
  "purchase_date" date,
  "purchase_price" decimal(10,2),
  "currency" varchar(3) DEFAULT 'USD',
  "supplier" varchar(255),
  "warranty_start_date" date,
  "warranty_end_date" date,
  "warranty_provider" varchar(255),
  "location" varchar(255),
  "cost_center" varchar(100),
  "department" varchar(100),
  "category" varchar(100), -- IT Equipment, Office Equipment, Furniture, etc.
  "subcategory" varchar(100), -- Laptop, Desktop, Mobile Device, etc.
  "specifications" jsonb DEFAULT '{}'::jsonb, -- CPU, RAM, Storage, OS, etc.
  "notes" text,
  "barcode" varchar(255),
  "qr_code" varchar(255),
  "image_url" varchar(500),
  "is_active" boolean NOT NULL DEFAULT true,
  "organization_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Asset assignments table - track asset assignments to users
CREATE TABLE IF NOT EXISTS "asset_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "assigned_by" uuid NOT NULL,
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  "returned_at" timestamp,
  "returned_by" uuid,
  "assignment_type" varchar(50) DEFAULT 'permanent', -- permanent, temporary, loan
  "expected_return_date" date,
  "assignment_notes" text,
  "return_notes" text,
  "assignment_location" varchar(255),
  "is_active" boolean NOT NULL DEFAULT true,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Asset history table - track all changes to assets
CREATE TABLE IF NOT EXISTS "asset_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "action" varchar(100) NOT NULL, -- created, updated, assigned, returned, repaired, retired, etc.
  "old_values" jsonb,
  "new_values" jsonb,
  "performed_by" uuid NOT NULL,
  "notes" text,
  "organization_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Asset maintenance table - track maintenance and repairs
CREATE TABLE IF NOT EXISTS "asset_maintenance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "maintenance_type" varchar(50) NOT NULL, -- repair, upgrade, inspection, cleaning
  "status" varchar(50) NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  "scheduled_date" date,
  "completed_date" date,
  "cost" decimal(10,2),
  "currency" varchar(3) DEFAULT 'USD',
  "vendor" varchar(255),
  "description" text NOT NULL,
  "notes" text,
  "performed_by" uuid,
  "organization_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Asset categories table - customizable asset categories per organization
CREATE TABLE IF NOT EXISTS "asset_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "parent_category_id" uuid,
  "organization_id" uuid NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Asset custom fields table - allow organizations to define custom fields
CREATE TABLE IF NOT EXISTS "asset_custom_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "field_name" varchar(255) NOT NULL,
  "field_type" varchar(50) NOT NULL, -- text, number, date, boolean, select, multiselect
  "field_options" jsonb, -- for select/multiselect types
  "is_required" boolean NOT NULL DEFAULT false,
  "organization_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Asset custom field values table
CREATE TABLE IF NOT EXISTS "asset_custom_field_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "custom_field_id" uuid NOT NULL,
  "field_value" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Asset locations table - predefined locations per organization
CREATE TABLE IF NOT EXISTS "asset_locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "address" text,
  "parent_location_id" uuid,
  "organization_id" uuid NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returned_by_users_id_fk" FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_parent_category_id_asset_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "asset_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_custom_fields" ADD CONSTRAINT "asset_custom_fields_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_custom_fields" ADD CONSTRAINT "asset_custom_fields_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_custom_field_values" ADD CONSTRAINT "asset_custom_field_values_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_custom_field_values" ADD CONSTRAINT "asset_custom_field_values_custom_field_id_asset_custom_fields_id_fk" FOREIGN KEY ("custom_field_id") REFERENCES "asset_custom_fields"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_parent_location_id_asset_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "asset_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_assets_organization_id" ON "assets"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_assets_status" ON "assets"("status");
CREATE INDEX IF NOT EXISTS "idx_assets_asset_type" ON "assets"("asset_type");
CREATE INDEX IF NOT EXISTS "idx_assets_asset_tag" ON "assets"("asset_tag");
CREATE INDEX IF NOT EXISTS "idx_assets_serial_number" ON "assets"("serial_number");

CREATE INDEX IF NOT EXISTS "idx_asset_assignments_asset_id" ON "asset_assignments"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_asset_assignments_user_id" ON "asset_assignments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_asset_assignments_organization_id" ON "asset_assignments"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_asset_assignments_is_active" ON "asset_assignments"("is_active");

CREATE INDEX IF NOT EXISTS "idx_asset_history_asset_id" ON "asset_history"("asset_id");
CREATE INDEX IF NOT EXISTS "idx_asset_history_organization_id" ON "asset_history"("organization_id");

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "idx_assets_asset_tag_organization" ON "assets"("asset_tag", "organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_active_asset_assignment" ON "asset_assignments"("asset_id") WHERE "is_active" = true;CREATE TABLE IF NOT EXISTS "sso_domain_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sso_provider_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sso_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider_type" varchar(50) DEFAULT 'oidc' NOT NULL,
	"client_id" varchar(500) NOT NULL,
	"client_secret" text NOT NULL,
	"discovery_url" text,
	"issuer_url" text NOT NULL,
	"authorization_url" text NOT NULL,
	"token_url" text NOT NULL,
	"userinfo_url" text NOT NULL,
	"jwks_uri" text,
	"scopes" text[] DEFAULT openid,profile,email,
	"claims_mapping" jsonb DEFAULT '{"email":"email","name":"name","given_name":"given_name","family_name":"family_name"}'::jsonb,
	"auto_provision_users" boolean DEFAULT true NOT NULL,
	"default_role" varchar(100) DEFAULT 'viewer',
	"first_user_role" varchar(100) DEFAULT 'administrator',
	"role_mapping" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sso_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sso_provider_id" uuid NOT NULL,
	"external_user_id" varchar(500) NOT NULL,
	"external_email" varchar(255) NOT NULL,
	"external_metadata" jsonb DEFAULT '{}'::jsonb,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "configurations" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "features_enabled" jsonb DEFAULT '{"servers":true,"serverGroups":true,"pemKeys":true,"configurations":true,"deployments":true,"chat":true,"training":true,"awsIntegrations":true,"githubIntegrations":true,"mdm":true,"assets":true,"auditLogs":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_sso" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_method" varchar(50) DEFAULT 'password' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sso_provider_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "external_user_id" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_sso_login_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-- Migration 0011: Asset Management with MDM Integration
-- Clean asset tables without organization conflicts

CREATE TABLE IF NOT EXISTS "asset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"returned_by" uuid,
	"assignment_type" varchar(50) DEFAULT 'permanent',
	"expected_return_date" date,
	"assignment_notes" text,
	"return_notes" text,
	"assignment_location" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"parent_category_id" uuid,
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"performed_by" uuid NOT NULL,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"address" text,
	"parent_location_id" uuid,
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"maintenance_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"scheduled_date" date,
	"completed_date" date,
	"cost" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"vendor" varchar(255),
	"description" text NOT NULL,
	"notes" text,
	"performed_by" uuid,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_tag" varchar(100) NOT NULL,
	"serial_number" varchar(255),
	"asset_type" varchar(50) NOT NULL,
	"brand" varchar(100) NOT NULL,
	"model" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'available' NOT NULL,
	"condition" varchar(50) DEFAULT 'good',
	"purchase_date" date,
	"purchase_price" numeric(10, 2),
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
	"specifications" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"barcode" varchar(255),
	"qr_code" varchar(255),
	"image_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"mdm_device_id" uuid,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_asset_tag_unique" UNIQUE("asset_tag")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returned_by_users_id_fk" FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_parent_category_id_asset_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "asset_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_parent_location_id_asset_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "asset_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_mdm_device_id_mdm_devices_id_fk" FOREIGN KEY ("mdm_device_id") REFERENCES "mdm_devices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;CREATE TABLE IF NOT EXISTS "ai_assistant_messages" (
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_assistant_messages" ADD CONSTRAINT "ai_assistant_messages_session_id_ai_assistant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "ai_assistant_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_assistant_messages" ADD CONSTRAINT "ai_assistant_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_assistant_sessions" ADD CONSTRAINT "ai_assistant_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_assistant_sessions" ADD CONSTRAINT "ai_assistant_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_drifts" ADD CONSTRAINT "configuration_drifts_configuration_id_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "configurations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_drifts" ADD CONSTRAINT "configuration_drifts_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_drifts" ADD CONSTRAINT "configuration_drifts_server_group_id_server_groups_id_fk" FOREIGN KEY ("server_group_id") REFERENCES "server_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuration_drifts" ADD CONSTRAINT "configuration_drifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
WHERE "features_enabled" IS NULL;-- Migration 0013: Add system settings table for global platform configuration

CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"category" varchar(100) DEFAULT 'general' NOT NULL,
	"is_readonly" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Insert default system settings
INSERT INTO "system_settings" ("key", "value", "description", "category", "is_readonly") VALUES
('user_registration_enabled', 'true', 'Allow new users to register and create organizations', 'security', false),
('platform_name', '"Pulse"', 'Name of the platform', 'general', true),
('support_contact', '"support@pulse.dev"', 'Support contact email for users', 'general', false),
('max_organizations_per_user', '5', 'Maximum number of organizations a user can create', 'limits', false),
('maintenance_mode', 'false', 'Enable maintenance mode to prevent new registrations and logins', 'system', false)
ON CONFLICT ("key") DO NOTHING;-- ==============================
-- HIVE AGENT SYSTEM TABLES
-- ==============================

-- Hive Agents Registry
CREATE TABLE IF NOT EXISTS "hive_agents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "api_key" varchar(255) UNIQUE NOT NULL, -- Format: hive_<nanoid>
    "name" varchar(255) NOT NULL, -- User-friendly name
    "hostname" varchar(255) NOT NULL,
    "ip_address" inet,
    "os_type" varchar(50), -- linux, windows, darwin
    "os_version" varchar(100),
    "arch" varchar(20), -- amd64, arm64
    "status" varchar(50) DEFAULT 'offline', -- online, offline, degraded, error
    "last_heartbeat" timestamp,
    "installed_at" timestamp DEFAULT now(),
    "version" varchar(50),
    "capabilities" jsonb DEFAULT '[]'::jsonb, -- Features the agent supports
    "system_info" jsonb DEFAULT '{}'::jsonb, -- CPU, RAM, Disk info
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Hive Agent Configurations (like Vector/Fluent-bit config)
CREATE TABLE IF NOT EXISTS "hive_agent_configs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "config_type" varchar(50) NOT NULL, -- logs, metrics, traces, outputs
    "config_name" varchar(255) NOT NULL,
    "enabled" boolean DEFAULT true,
    "config" jsonb NOT NULL, -- Actual configuration
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE(agent_id, config_type, config_name)
);

-- Hive Telemetry Data (for buffering/querying)
CREATE TABLE IF NOT EXISTS "hive_telemetry" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "type" varchar(50) NOT NULL, -- log, metric, trace, event
    "source" varchar(255), -- Source identifier (file path, service name)
    "data" jsonb NOT NULL,
    "timestamp" timestamp NOT NULL,
    "processed" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Hive Issues/Alerts detected by agents
CREATE TABLE IF NOT EXISTS "hive_issues" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "severity" varchar(20) NOT NULL, -- critical, error, warning, info
    "category" varchar(100), -- system, application, security, performance
    "title" varchar(500) NOT NULL,
    "description" text,
    "error_pattern" text, -- Regex or pattern that triggered this
    "context" jsonb DEFAULT '{}'::jsonb, -- Additional context
    "suggested_fix" text,
    "auto_fixable" boolean DEFAULT false,
    "detected_at" timestamp DEFAULT now() NOT NULL,
    "acknowledged_at" timestamp,
    "resolved_at" timestamp,
    "resolution_type" varchar(50), -- manual, auto, ignored
    "resolution_details" text
);

-- Hive Command Execution History
CREATE TABLE IF NOT EXISTS "hive_commands" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES users(id),
    "session_id" uuid, -- For grouping related commands
    "command_type" varchar(50) NOT NULL, -- shell, script, diagnostic, fix
    "command" text NOT NULL,
    "parameters" jsonb DEFAULT '{}'::jsonb,
    "response" text,
    "exit_code" integer,
    "executed_at" timestamp DEFAULT now() NOT NULL,
    "completed_at" timestamp,
    "status" varchar(50) DEFAULT 'pending', -- pending, running, success, failed, timeout
    "execution_time_ms" integer,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- Hive Output Endpoints Configuration
CREATE TABLE IF NOT EXISTS "hive_output_endpoints" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "name" varchar(255) NOT NULL,
    "type" varchar(50) NOT NULL, -- http, elasticsearch, prometheus, loki, datadog, etc
    "endpoint_url" text NOT NULL,
    "auth_type" varchar(50), -- none, basic, bearer, api_key
    "auth_config" jsonb DEFAULT '{}'::jsonb, -- Encrypted auth details
    "headers" jsonb DEFAULT '{}'::jsonb, -- Additional headers
    "batch_size" integer DEFAULT 1000,
    "flush_interval_seconds" integer DEFAULT 10,
    "retry_config" jsonb DEFAULT '{"max_retries": 3, "backoff_seconds": 5}'::jsonb,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Agent to Output Endpoint mappings
CREATE TABLE IF NOT EXISTS "hive_agent_outputs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "agent_id" uuid NOT NULL REFERENCES hive_agents(id) ON DELETE CASCADE,
    "endpoint_id" uuid NOT NULL REFERENCES hive_output_endpoints(id) ON DELETE CASCADE,
    "data_types" jsonb DEFAULT '["logs", "metrics"]'::jsonb, -- Which data types to send
    "filters" jsonb DEFAULT '{}'::jsonb, -- Optional filters
    "enabled" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now() NOT NULL,
    UNIQUE(agent_id, endpoint_id)
);

-- Create indexes for performance
CREATE INDEX idx_hive_agents_organization_id ON hive_agents(organization_id);
CREATE INDEX idx_hive_agents_status ON hive_agents(status);
CREATE INDEX idx_hive_agents_api_key ON hive_agents(api_key);
CREATE INDEX idx_hive_telemetry_agent_id ON hive_telemetry(agent_id);
CREATE INDEX idx_hive_telemetry_timestamp ON hive_telemetry(timestamp);
CREATE INDEX idx_hive_issues_agent_id ON hive_issues(agent_id);
CREATE INDEX idx_hive_issues_severity ON hive_issues(severity);
CREATE INDEX idx_hive_commands_agent_id ON hive_commands(agent_id);
CREATE INDEX idx_hive_commands_user_id ON hive_commands(user_id);

-- Note: RBAC permissions for Hive are handled by the RBAC seeder-- Add pulse_url column to hive_agents table
ALTER TABLE "hive_agents" ADD COLUMN "pulse_url" varchar(512);-- Add hive deployment key to organizations table for auto-registration
ALTER TABLE "organizations" ADD COLUMN "hive_deployment_key" varchar(64);