-- Add hive deployment key to organizations table for auto-registration
ALTER TABLE "organizations" ADD COLUMN "hive_deployment_key" varchar(64);