-- Migration 0008: Add onboarding support
-- Add hasCompletedOnboarding column to users table

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_completed_onboarding" boolean NOT NULL DEFAULT false;