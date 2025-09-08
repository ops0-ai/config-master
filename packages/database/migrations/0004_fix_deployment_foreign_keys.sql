-- Fix Deployment Foreign Key Constraints
-- This migration fixes the deployment table foreign key constraint that was incorrectly pointing to legacy_configurations

DO $$
BEGIN
    -- Drop the incorrect foreign key constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'deployments_configuration_id_configurations_id_fk' 
               AND table_name = 'deployments') THEN
        
        -- Check if it points to legacy_configurations (incorrect)
        IF EXISTS (SELECT 1 FROM information_schema.referential_constraints rc
                   JOIN information_schema.key_column_usage kcu ON rc.constraint_name = kcu.constraint_name
                   WHERE rc.constraint_name = 'deployments_configuration_id_configurations_id_fk'
                   AND kcu.referenced_table_name = 'legacy_configurations') THEN
            
            -- Drop the incorrect constraint
            ALTER TABLE deployments DROP CONSTRAINT deployments_configuration_id_configurations_id_fk;
            
            -- Add the correct constraint pointing to configurations table
            ALTER TABLE deployments ADD CONSTRAINT deployments_configuration_id_configurations_id_fk 
            FOREIGN KEY (configuration_id) REFERENCES configurations(id);
            
            RAISE NOTICE 'Fixed deployment foreign key constraint to point to configurations table';
        END IF;
    ELSE
        -- Add the constraint if it doesn't exist at all
        ALTER TABLE deployments ADD CONSTRAINT deployments_configuration_id_configurations_id_fk 
        FOREIGN KEY (configuration_id) REFERENCES configurations(id);
        
        RAISE NOTICE 'Added deployment foreign key constraint to configurations table';
    END IF;
END $$;