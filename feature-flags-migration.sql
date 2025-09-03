-- Feature flags migration for Pulse platform
-- This adds organization-level feature management

-- Add features_enabled column to organizations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'features_enabled'
    ) THEN
        ALTER TABLE organizations 
        ADD COLUMN features_enabled JSONB DEFAULT '{
            "servers": true,
            "serverGroups": true,
            "pemKeys": true,
            "configurations": true,
            "deployments": true,
            "chat": true,
            "training": true,
            "awsIntegrations": true,
            "githubIntegrations": true,
            "mdm": true,
            "assets": true,
            "auditLogs": true
        }'::jsonb;
        
        -- Update existing organizations to have all features enabled by default
        UPDATE organizations 
        SET features_enabled = '{
            "servers": true,
            "serverGroups": true,
            "pemKeys": true,
            "configurations": true,
            "deployments": true,
            "chat": true,
            "training": true,
            "awsIntegrations": true,
            "githubIntegrations": true,
            "mdm": true,
            "assets": true,
            "auditLogs": true
        }'::jsonb
        WHERE features_enabled IS NULL;
    END IF;
END $$;

-- Ensure is_super_admin column exists in users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_super_admin'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Grant super admin to the first user (usually the platform owner)
UPDATE users 
SET is_super_admin = TRUE 
WHERE id = (
    SELECT id FROM users 
    ORDER BY created_at ASC 
    LIMIT 1
);

COMMIT;