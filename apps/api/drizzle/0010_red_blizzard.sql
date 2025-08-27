CREATE TABLE IF NOT EXISTS "sso_domain_mappings" (
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
