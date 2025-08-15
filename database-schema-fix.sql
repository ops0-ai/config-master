-- Comprehensive Database Schema Fix for Fresh Installations
-- This script ensures all required columns exist for the config management system

-- 1. Fix servers table
ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INTEGER NOT NULL DEFAULT 22;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'linux';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS username VARCHAR(255) NOT NULL DEFAULT 'root';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS os_version VARCHAR(100);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'unknown';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES server_groups(id);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS pem_key_id UUID REFERENCES pem_keys(id);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2. Fix server_groups table
ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'mixed';
ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS default_pem_key_id UUID REFERENCES pem_keys(id);

-- 3. Fix pem_keys table
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE pem_keys ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(255);

-- 4. Fix configurations table
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'ansible';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS ansible_playbook TEXT NOT NULL DEFAULT '';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS variables JSONB;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS tags JSONB;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 5. Fix deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS configuration_id UUID REFERENCES configurations(id);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) NOT NULL DEFAULT 'server';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS logs TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS output TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'immediate';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(100);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES users(id);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS section VARCHAR(100) DEFAULT 'general';

-- 6. Fix RBAC tables
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE roles ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE permissions ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'member';
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 7. Fix MDM tables
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_charging BOOLEAN;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS agent_install_path TEXT;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS enrolled_by UUID REFERENCES users(id);
ALTER TABLE mdm_devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 8. Create missing tables
CREATE TABLE IF NOT EXISTS configuration_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) NOT NULL,
    configuration_id UUID REFERENCES configurations(id) NOT NULL,
    expected_state JSONB NOT NULL,
    actual_state JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'unknown',
    last_checked TIMESTAMP,
    drift_detected BOOLEAN NOT NULL DEFAULT false,
    drift_details JSONB,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    user_id UUID REFERENCES users(id) NOT NULL,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    generated_configuration TEXT,
    configuration_id UUID REFERENCES configurations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. Fix organization_settings table (drop and recreate with correct schema)
DROP TABLE IF EXISTS organization_settings CASCADE;
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
    claude_api_key TEXT,
    default_region VARCHAR(50) DEFAULT 'us-east-1',
    max_concurrent_deployments INTEGER DEFAULT 5,
    deployment_timeout INTEGER DEFAULT 300,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_servers_organization_id ON servers(organization_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_organization_id ON deployments(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_organization_id ON mdm_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_mdm_devices_status ON mdm_devices(status);
CREATE INDEX IF NOT EXISTS idx_configurations_organization_id ON configurations(organization_id);

-- Success message
\echo 'Database schema fix completed successfully!'