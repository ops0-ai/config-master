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
END $$;