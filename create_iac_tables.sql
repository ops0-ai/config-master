-- Create IAC tables for the application
-- This script can be run directly against the PostgreSQL database

-- Add IAC Conversations and Messages tables
CREATE TABLE IF NOT EXISTS "iac_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255),
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "iac_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"generated_terraform" text,
	"pr_number" integer,
	"pr_url" varchar(500),
	"pr_status" varchar(50),
	"deployment_status" varchar(50),
	"terraform_plan" text,
	"terraform_state" text,
	"aws_region" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "iac_conversations" ADD CONSTRAINT "iac_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "iac_conversations" ADD CONSTRAINT "iac_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "iac_messages" ADD CONSTRAINT "iac_messages_conversation_id_iac_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "iac_conversations"("id") ON DELETE no action ON UPDATE no action;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_iac_conversations_user_id" ON "iac_conversations" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_iac_conversations_organization_id" ON "iac_conversations" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_iac_conversations_is_active" ON "iac_conversations" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_iac_messages_conversation_id" ON "iac_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_iac_messages_role" ON "iac_messages" ("role");
CREATE INDEX IF NOT EXISTS "idx_iac_messages_created_at" ON "iac_messages" ("created_at");

-- Verify tables were created
SELECT 'iac_conversations table created' as status;
SELECT 'iac_messages table created' as status;
