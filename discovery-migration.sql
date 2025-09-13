-- Discovery Feature Migration
-- This migration adds the tables needed for the Infrastructure Discovery feature

-- Create discovery_sessions table
CREATE TABLE IF NOT EXISTS discovery_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES aws_integrations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    description TEXT,
    provider VARCHAR(50) NOT NULL DEFAULT 'aws',
    regions JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    resource_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create discovery_resources table
CREATE TABLE IF NOT EXISTS discovery_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'aws',
    tags JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_selected BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create discovery_code_generations table
CREATE TABLE IF NOT EXISTS discovery_code_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'opentofu',
    terraform_code TEXT NOT NULL,
    state_file JSONB NOT NULL,
    selected_resource_ids JSONB NOT NULL,
    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_org_id ON discovery_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_integration_id ON discovery_sessions(integration_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_status ON discovery_sessions(status);

CREATE INDEX IF NOT EXISTS idx_discovery_resources_session_id ON discovery_resources(session_id);
CREATE INDEX IF NOT EXISTS idx_discovery_resources_type ON discovery_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_discovery_resources_region ON discovery_resources(region);

CREATE INDEX IF NOT EXISTS idx_discovery_code_generations_session_id ON discovery_code_generations(session_id);

-- Update organizations table to include discovery feature flag
DO $$
BEGIN
    -- Check if the column exists and update it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'features_enabled'
    ) THEN
        -- Update existing organizations to include discovery feature
        UPDATE organizations 
        SET features_enabled = COALESCE(features_enabled, '{}'::jsonb) || '{"discovery": true}'::jsonb
        WHERE features_enabled IS NULL OR NOT (features_enabled ? 'discovery');
    END IF;
END $$;