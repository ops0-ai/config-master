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
