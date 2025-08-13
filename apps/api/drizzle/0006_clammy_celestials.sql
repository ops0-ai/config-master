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
