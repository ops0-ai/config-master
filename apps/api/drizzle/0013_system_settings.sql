-- Migration 0013: Add system settings table for global platform configuration

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
ON CONFLICT ("key") DO NOTHING;