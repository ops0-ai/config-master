-- RBAC Permissions Fix Migration
-- This script fixes RBAC permissions for existing organizations to ensure
-- all Administrator roles have complete access to all features including assets

BEGIN;

-- Function to refresh all Administrator role permissions
-- This ensures all Administrator roles get ALL permissions from the system
CREATE OR REPLACE FUNCTION refresh_admin_permissions() RETURNS void AS $$
DECLARE
    admin_role_record RECORD;
    permission_record RECORD;
    permission_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting RBAC permissions refresh...';
    
    -- Loop through all Administrator roles in all organizations
    FOR admin_role_record IN 
        SELECT id, organization_id, name 
        FROM roles 
        WHERE name = 'Administrator' AND is_system = true
    LOOP
        RAISE NOTICE 'Processing Administrator role for organization: %', admin_role_record.organization_id;
        
        -- Delete existing permissions for this role (we'll re-add all of them)
        DELETE FROM role_permissions WHERE role_id = admin_role_record.id;
        
        -- Add ALL available permissions to this Administrator role
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT admin_role_record.id, p.id
        FROM permissions p
        ON CONFLICT (role_id, permission_id) DO NOTHING;
        
        -- Count permissions assigned
        SELECT COUNT(*) INTO permission_count 
        FROM role_permissions 
        WHERE role_id = admin_role_record.id;
        
        RAISE NOTICE '  ✅ Assigned % permissions to Administrator role', permission_count;
    END LOOP;
    
    RAISE NOTICE 'RBAC permissions refresh complete!';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT refresh_admin_permissions();

-- Clean up the function
DROP FUNCTION refresh_admin_permissions();

-- Verify the fix worked - show permission counts per organization
DO $$
DECLARE
    org_record RECORD;
    admin_perm_count INTEGER;
    dev_perm_count INTEGER;
    viewer_perm_count INTEGER;
BEGIN
    RAISE NOTICE 'Verification Report:';
    RAISE NOTICE '==================';
    
    FOR org_record IN 
        SELECT DISTINCT o.id, o.name 
        FROM organizations o
        JOIN roles r ON o.id = r.organization_id 
        WHERE r.name = 'Administrator'
        ORDER BY o.name
    LOOP
        -- Count permissions for each role type
        SELECT COUNT(rp.permission_id) INTO admin_perm_count
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.organization_id = org_record.id AND r.name = 'Administrator';
        
        SELECT COUNT(rp.permission_id) INTO dev_perm_count
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.organization_id = org_record.id AND r.name = 'Developer';
        
        SELECT COUNT(rp.permission_id) INTO viewer_perm_count
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.organization_id = org_record.id AND r.name = 'Viewer';
        
        RAISE NOTICE 'Organization: % | Admin: % perms | Dev: % perms | Viewer: % perms', 
            org_record.name, 
            COALESCE(admin_perm_count, 0),
            COALESCE(dev_perm_count, 0), 
            COALESCE(viewer_perm_count, 0);
    END LOOP;
END;
$$;

-- Show total system permissions count for reference
DO $$
DECLARE
    total_perms INTEGER;
    asset_perms INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_perms FROM permissions;
    SELECT COUNT(*) INTO asset_perms FROM permissions WHERE resource = 'asset';
    
    RAISE NOTICE '';
    RAISE NOTICE 'System has % total permissions available', total_perms;
    RAISE NOTICE 'Asset permissions: %', asset_perms;
    RAISE NOTICE 'All Administrator roles should now have % permissions', total_perms;
END;
$$;

COMMIT;