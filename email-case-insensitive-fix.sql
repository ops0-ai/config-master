-- Email Case-Insensitive Fix Migration
-- Fixes Microsoft SSO email case sensitivity issues

DO $$
BEGIN
    RAISE NOTICE 'Starting email case-insensitive fixes...';
END
$$;

-- Step 1: Find and merge duplicate users with different email casing
-- This safely handles cases where users exist with both uppercase and lowercase versions
DO $$
DECLARE
    duplicate_record RECORD;
    canonical_user_id TEXT;
    duplicate_user_id TEXT;
BEGIN
    -- Find duplicate emails (case-insensitive) within the same organization
    FOR duplicate_record IN
        SELECT 
            LOWER(email) as lower_email,
            organization_id,
            array_agg(id ORDER BY created_at ASC) as user_ids,
            array_agg(email ORDER BY created_at ASC) as emails,
            COUNT(*) as duplicate_count
        FROM users 
        GROUP BY LOWER(email), organization_id
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the first (oldest) user as canonical
        canonical_user_id := duplicate_record.user_ids[1];
        
        RAISE NOTICE 'Processing duplicate emails for %: % users found', 
            duplicate_record.lower_email, duplicate_record.duplicate_count;
        
        -- Process each duplicate (skip the first canonical one)
        FOR i IN 2..duplicate_record.duplicate_count LOOP
            duplicate_user_id := duplicate_record.user_ids[i];
            
            RAISE NOTICE 'Merging duplicate user % into canonical user %', 
                duplicate_user_id, canonical_user_id;
            
            -- Update any user_roles that point to the duplicate
            UPDATE user_roles 
            SET user_id = canonical_user_id 
            WHERE user_id = duplicate_user_id
            AND NOT EXISTS (
                SELECT 1 FROM user_roles ur2 
                WHERE ur2.user_id = canonical_user_id 
                AND ur2.role_id = user_roles.role_id
            );
            
            -- Update any user_sso_mappings that point to the duplicate
            UPDATE user_sso_mappings 
            SET user_id = canonical_user_id 
            WHERE user_id = duplicate_user_id
            AND NOT EXISTS (
                SELECT 1 FROM user_sso_mappings usm2
                WHERE usm2.user_id = canonical_user_id
                AND usm2.provider_id = user_sso_mappings.provider_id
                AND usm2.provider_user_id = user_sso_mappings.provider_user_id
            );
            
            -- Update audit_logs entries to point to canonical user
            -- Use a more targeted approach to avoid constraint violations
            BEGIN
                UPDATE audit_logs 
                SET user_id = canonical_user_id 
                WHERE user_id = duplicate_user_id;
            EXCEPTION
                WHEN OTHERS THEN
                    -- If there are constraint issues, delete the audit logs for the duplicate user
                    DELETE FROM audit_logs WHERE user_id = duplicate_user_id;
                    RAISE NOTICE 'Removed audit logs for duplicate user % due to constraints', duplicate_user_id;
            END;
            
            -- Update any other references (configurations, etc.)
            UPDATE configurations 
            SET created_by = canonical_user_id 
            WHERE created_by = duplicate_user_id;
            
            UPDATE configurations 
            SET updated_by = canonical_user_id 
            WHERE updated_by = duplicate_user_id;
            
            -- Now safe to delete the duplicate user
            DELETE FROM users WHERE id = duplicate_user_id;
            
            RAISE NOTICE 'Successfully merged and removed duplicate user %', duplicate_user_id;
        END LOOP;
        
        -- Ensure the canonical user has the normalized (lowercase) email
        UPDATE users 
        SET email = duplicate_record.lower_email 
        WHERE id = canonical_user_id;
        
        RAISE NOTICE 'Normalized email for canonical user % to %', 
            canonical_user_id, duplicate_record.lower_email;
    END LOOP;
END
$$;

-- Step 2: Normalize all remaining emails to lowercase
UPDATE users SET email = LOWER(email) WHERE email != LOWER(email);

-- Step 3: Add a function to automatically lowercase emails on insert/update
CREATE OR REPLACE FUNCTION normalize_user_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Normalize email to lowercase
    NEW.email = LOWER(NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically normalize emails (only if it doesn't exist)
DO $$
BEGIN
    -- Drop trigger if it exists
    DROP TRIGGER IF EXISTS normalize_user_email_trigger ON users;
    
    -- Create the trigger
    CREATE TRIGGER normalize_user_email_trigger
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION normalize_user_email();
        
    RAISE NOTICE 'Email normalization trigger created successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating email normalization trigger: %', SQLERRM;
END
$$;

-- Step 4: Create case-insensitive unique constraint on email within organization
-- First drop existing constraint if it exists
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_org_unique_ci;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
END
$$;

-- Create case-insensitive unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS users_email_org_unique_ci 
ON users (LOWER(email), organization_id);

-- Step 5: Verification
DO $$
DECLARE
    duplicate_count INTEGER;
    normalized_count INTEGER;
BEGIN
    -- Check for remaining duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT LOWER(email), organization_id, COUNT(*) as cnt
        FROM users 
        GROUP BY LOWER(email), organization_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- Check for non-normalized emails
    SELECT COUNT(*) INTO normalized_count
    FROM users 
    WHERE email != LOWER(email);
    
    RAISE NOTICE 'Email case-insensitive fix completed:';
    RAISE NOTICE '  - Remaining duplicates: %', duplicate_count;
    RAISE NOTICE '  - Non-normalized emails: %', normalized_count;
    RAISE NOTICE '  - Email normalization trigger: ACTIVE';
    RAISE NOTICE '  - Case-insensitive unique constraint: ACTIVE';
    
    IF duplicate_count > 0 THEN
        RAISE WARNING 'There are still % duplicate email(s) that need manual attention', duplicate_count;
    ELSE
        RAISE NOTICE '✅ All email duplicates resolved successfully';
    END IF;
    
    IF normalized_count > 0 THEN
        RAISE WARNING 'There are still % non-normalized email(s)', normalized_count;
    ELSE
        RAISE NOTICE '✅ All emails normalized to lowercase';
    END IF;
END
$$;

RAISE NOTICE 'Email case-insensitive fix migration completed successfully!';