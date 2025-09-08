-- Pulse Platform Foreign Key Repair Script
-- This script fixes orphaned organizations that reference non-existent users
-- Safe to run multiple times (idempotent)

BEGIN;

-- Step 1: Temporarily drop the foreign key constraint that's causing the issue
DO $$ 
BEGIN
    -- Drop the problematic foreign key constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'organizations_owner_id_users_id_fk') THEN
        ALTER TABLE organizations DROP CONSTRAINT organizations_owner_id_users_id_fk;
        RAISE NOTICE '✅ Dropped organizations_owner_id_users_id_fk constraint';
    ELSE
        RAISE NOTICE '⚠️ organizations_owner_id_users_id_fk constraint not found (already dropped)';
    END IF;
END $$;

-- Step 2: Find and fix orphaned organizations
DO $$ 
DECLARE
    orphaned_count INTEGER;
    admin_user_id UUID;
    admin_email TEXT := 'admin@pulse.dev';
BEGIN
    -- Count orphaned organizations
    SELECT COUNT(*) INTO orphaned_count 
    FROM organizations o 
    WHERE o.owner_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.owner_id);
    
    RAISE NOTICE 'Found % orphaned organizations', orphaned_count;
    
    IF orphaned_count > 0 THEN
        -- Try to find existing admin user
        SELECT id INTO admin_user_id 
        FROM users 
        WHERE email = admin_email OR role = 'super_admin' 
        LIMIT 1;
        
        IF admin_user_id IS NULL THEN
            -- Create a default admin user if none exists
            admin_user_id := gen_random_uuid();
            
            INSERT INTO users (id, email, password_hash, name, role, is_active, created_at)
            VALUES (
                admin_user_id,
                admin_email,
                '$2b$10$rQNTkqP2GWI4PJ4bFt8/lOhFgAGjZqjcmrztKTfr5vW2zJJPQ5vXa', -- 'admin123'
                'Pulse Admin (Auto-Created)',
                'super_admin',
                true,
                NOW()
            );
            
            RAISE NOTICE '✅ Created admin user with ID: %', admin_user_id;
        ELSE
            RAISE NOTICE '✅ Using existing admin user with ID: %', admin_user_id;
        END IF;
        
        -- Fix orphaned organizations by assigning them to the admin user
        UPDATE organizations 
        SET owner_id = admin_user_id 
        WHERE owner_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = organizations.owner_id);
        
        RAISE NOTICE '✅ Fixed % orphaned organizations', orphaned_count;
    END IF;
END $$;

-- Step 3: Re-add the foreign key constraint (now that all references are valid)
DO $$ 
BEGIN
    -- Add the foreign key constraint back
    ALTER TABLE organizations ADD CONSTRAINT organizations_owner_id_users_id_fk 
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
    
    RAISE NOTICE '✅ Re-added organizations_owner_id_users_id_fk constraint';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE '⚠️ organizations_owner_id_users_id_fk constraint already exists';
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION '❌ Still have orphaned data! Cannot re-add constraint.';
END $$;

-- Step 4: Verify the fix
DO $$
DECLARE
    remaining_orphans INTEGER;
    total_orgs INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_orphans 
    FROM organizations o 
    WHERE o.owner_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.owner_id);
    
    SELECT COUNT(*) INTO total_orgs FROM organizations;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✅ REPAIR COMPLETE';
    RAISE NOTICE 'Total organizations: %', total_orgs;
    RAISE NOTICE 'Remaining orphaned organizations: %', remaining_orphans;
    
    IF remaining_orphans = 0 THEN
        RAISE NOTICE '🎉 All organizations now have valid owners!';
    ELSE
        RAISE EXCEPTION '❌ Still have % orphaned organizations', remaining_orphans;
    END IF;
    RAISE NOTICE '===========================================';
END $$;

COMMIT;

-- Final success message
\echo '✅ Foreign key repair completed successfully!'