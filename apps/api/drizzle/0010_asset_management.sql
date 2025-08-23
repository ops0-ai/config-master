-- Migration 0010: Asset Management System
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
CREATE UNIQUE INDEX IF NOT EXISTS "idx_active_asset_assignment" ON "asset_assignments"("asset_id") WHERE "is_active" = true;