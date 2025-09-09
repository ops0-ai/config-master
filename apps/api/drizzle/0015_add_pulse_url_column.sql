-- Add pulse_url column to hive_agents table
ALTER TABLE "hive_agents" ADD COLUMN "pulse_url" varchar(512);