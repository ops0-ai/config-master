#\!/bin/bash

echo "🔧 Fixing Missing Asset Tables"
echo "=============================="
echo ""

# Check if migration file exists locally
if [ -f "apps/api/drizzle/0010_asset_management.sql" ]; then
    echo "✅ Migration file found locally"
    
    echo ""
    echo "📋 Running asset migration..."
    
    # Run the migration
    docker exec -i configmaster-db psql -U postgres -d config_management < apps/api/drizzle/0010_asset_management.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Asset tables created successfully\!"
    else
        echo "❌ Migration failed. There might be partial tables."
        echo "   Attempting cleanup and retry..."
        
        # Drop any partial tables
        docker exec configmaster-db psql -U postgres -d config_management -c "
        DROP TABLE IF EXISTS asset_maintenance CASCADE;
        DROP TABLE IF EXISTS asset_custom_field_values CASCADE;
        DROP TABLE IF EXISTS asset_custom_fields CASCADE;
        DROP TABLE IF EXISTS asset_history CASCADE;
        DROP TABLE IF EXISTS asset_assignments CASCADE;
        DROP TABLE IF EXISTS asset_locations CASCADE;
        DROP TABLE IF EXISTS asset_categories CASCADE;
        DROP TABLE IF EXISTS assets CASCADE;"
        
        echo "   Retrying migration..."
        docker exec -i configmaster-db psql -U postgres -d config_management < apps/api/drizzle/0010_asset_management.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Asset tables created successfully on retry\!"
        else
            echo "❌ Migration still failing. Manual intervention needed."
            exit 1
        fi
    fi
    
    echo ""
    echo "🔍 Verifying tables..."
    docker exec configmaster-db psql -U postgres -d config_management -c "\dt asset*"
    
    echo ""
    echo "📦 Restarting API to pick up changes..."
    docker compose restart api
    
    echo ""
    echo "⏳ Waiting for API to restart..."
    sleep 10
    
    echo ""
    echo "✅ Fix complete\! Asset management should now work."
    echo ""
    echo "Test it at: http://localhost:3000/assets"
    
else
    echo "❌ Migration file not found\!"
    echo "   Please ensure you're in the config-management directory"
    echo "   and the file exists at: apps/api/drizzle/0010_asset_management.sql"
    exit 1
fi
