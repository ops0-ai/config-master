-- Add server types and authentication methods
-- Migration: Add server types (Linux/Windows) with different authentication methods

-- Add type column to server_groups
ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'mixed';

-- Add type and encrypted_password columns to servers
ALTER TABLE servers ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'linux' NOT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS encrypted_password TEXT;

-- Update default port for Windows servers (this will be handled in application logic)
-- Linux servers use port 22 (SSH), Windows servers use port 3389 (RDP)

-- Add comments for clarity
COMMENT ON COLUMN servers.type IS 'Server type: linux or windows';
COMMENT ON COLUMN servers.encrypted_password IS 'Encrypted password for Windows RDP authentication';
COMMENT ON COLUMN servers.pem_key_id IS 'PEM key for Linux SSH authentication';
COMMENT ON COLUMN server_groups.type IS 'Server group type: linux, windows, or mixed';

-- Create index on server type for better query performance
CREATE INDEX IF NOT EXISTS idx_servers_type ON servers(type);
CREATE INDEX IF NOT EXISTS idx_server_groups_type ON server_groups(type);