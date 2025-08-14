-- Database Schema Fix for Missing Columns
-- This migration ensures all required columns exist for fresh deployments

-- Add missing columns to servers table
ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 22;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'linux';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS operating_system VARCHAR(50);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS pem_key_id UUID;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add missing columns to server_groups table
ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'static';
ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS default_pem_key_id UUID;

-- Add missing columns to pem_keys table
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255);

-- Add missing columns to configurations table
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'ansible';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS ansible_playbook TEXT;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add missing columns to deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS configuration_id UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'server';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS logs TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS output TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50) DEFAULT 'immediate';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(255);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS executed_by UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS section VARCHAR(255);

-- Add missing columns to roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add missing columns to permissions table
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Add missing columns to user_roles table
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_by UUID;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to user_organizations table
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS claude_api_key TEXT;

-- Add missing columns to mdm_devices table
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_charging BOOLEAN;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS agent_install_path VARCHAR(500);
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_by UUID;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS configuration_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID NOT NULL,
    server_id UUID NOT NULL,
    state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure MDM tables have proper structure
DROP TABLE IF EXISTS mdm_profiles CASCADE;
CREATE TABLE mdm_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    profile_type VARCHAR(50) DEFAULT 'macos',
    allow_remote_commands BOOLEAN DEFAULT true,
    allow_lock_device BOOLEAN DEFAULT true,
    allow_shutdown BOOLEAN DEFAULT false,
    allow_restart BOOLEAN DEFAULT true,
    allow_wake_on_lan BOOLEAN DEFAULT true,
    require_authentication BOOLEAN DEFAULT true,
    max_session_duration INTEGER DEFAULT 3600,
    allowed_ip_ranges TEXT[] DEFAULT '{}',
    enrollment_key VARCHAR(255) UNIQUE NOT NULL,
    enrollment_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mdm_profiles_org_id ON mdm_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_profiles_enrollment_key ON mdm_profiles(enrollment_key);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_org_id ON mdm_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_device_id ON mdm_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_mdm_commands_device_id ON mdm_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_mdm_commands_status ON mdm_commands(status);

-- Set updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS update_mdm_profiles_updated_at ON mdm_profiles;
CREATE TRIGGER update_mdm_profiles_updated_at
    BEFORE UPDATE ON mdm_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();