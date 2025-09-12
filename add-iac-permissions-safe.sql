-- SAFE: Add IAC permissions to existing roles without breaking anything
-- This script only ADDS permissions, it doesn't remove or modify existing ones

-- Step 1: Ensure IAC and AI Assistant permissions exist in the permissions table
-- First check if permissions already exist, then insert only if they don't
INSERT INTO permissions (resource, action, description) 
SELECT 'iac', 'read', 'View IAC conversations and generated code'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'iac' AND action = 'read');

INSERT INTO permissions (resource, action, description) 
SELECT 'iac', 'write', 'Use IAC assistant for Terraform generation'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'iac' AND action = 'write');

INSERT INTO permissions (resource, action, description) 
SELECT 'iac', 'execute', 'Deploy and manage Terraform infrastructure'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'iac' AND action = 'execute');

INSERT INTO permissions (resource, action, description) 
SELECT 'ai-assistant', 'read', 'View AI assistant sessions and suggestions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'ai-assistant' AND action = 'read');

INSERT INTO permissions (resource, action, description) 
SELECT 'ai-assistant', 'write', 'Use AI assistant for configuration management'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'ai-assistant' AND action = 'write');

INSERT INTO permissions (resource, action, description) 
SELECT 'ai-assistant', 'execute', 'Execute AI assistant actions and commands'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'ai-assistant' AND action = 'execute');

INSERT INTO permissions (resource, action, description) 
SELECT 'ai-assistant', 'delete', 'Delete AI assistant sessions and data'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = 'ai-assistant' AND action = 'delete');

-- Step 2: Add IAC and AI Assistant permissions to Administrator roles (only if not already present)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Administrator' 
  AND p.resource IN ('iac', 'ai-assistant')
  AND p.action IN ('read', 'write', 'execute', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp2 
    WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
  );

-- Step 3: Add IAC and AI Assistant permissions to Operator roles (only if not already present)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operator' 
  AND p.resource IN ('iac', 'ai-assistant')
  AND p.action IN ('read', 'write', 'execute', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp2 
    WHERE rp2.role_id = r.id AND rp2.permission_id = p.id
  );

-- Step 4: Verify what was added (optional - just to see the results)
SELECT 
  r.name as role_name,
  p.resource,
  p.action,
  p.description,
  'ADDED' as status
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE p.resource IN ('iac', 'ai-assistant')
ORDER BY r.name, p.resource, p.action;
