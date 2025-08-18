#!/bin/bash

# Pulse Configuration Management - Fresh Installation Script
# This script sets up a complete fresh deployment with all required database schema

set -e

echo "======================================"
echo "   Pulse Configuration Management"
echo "      FRESH INSTALLATION SCRIPT"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found. Please run this script from the project root directory."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker compose down --volumes 2>/dev/null || true

# Remove any existing volumes to ensure clean start
echo "🗑️  Removing existing volumes for clean installation..."
docker volume rm config-management_postgres_data 2>/dev/null || true
docker volume rm config-management_redis_data 2>/dev/null || true
docker volume rm config-management_pem_keys 2>/dev/null || true
docker volume rm config-management_ansible_temp 2>/dev/null || true

echo "✅ Clean slate prepared"
echo ""

# Check environment variables
echo "🔧 Checking environment configuration..."

# Set default admin credentials if not provided
export DEFAULT_ADMIN_EMAIL="${DEFAULT_ADMIN_EMAIL:-admin@pulse.dev}"
export DEFAULT_ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-password123}"

echo "   Admin Email: $DEFAULT_ADMIN_EMAIL"
echo "   Admin Password: [HIDDEN]"
echo ""

# Build and start containers
echo "🏗️  Building and starting containers..."
docker compose up --build -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

# Wait for API to be healthy
echo "⏳ Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:5005/health > /dev/null 2>&1; then
        echo "✅ API is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ API failed to start within 5 minutes"
        echo "   Check logs: docker logs configmaster-api"
        exit 1
    fi
    echo "   Attempt $i/30 - waiting..."
    sleep 10
done

echo ""
echo "🔍 Checking database schema..."

# Check if all required tables exist
MISSING_TABLES=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
SELECT string_agg(required_table, ', ') 
FROM (
    VALUES 
    ('users'), ('organizations'), ('user_organizations'), ('roles'), ('permissions'), 
    ('role_permissions'), ('user_roles'), ('servers'), ('server_groups'), ('pem_keys'),
    ('configurations'), ('deployments'), ('mdm_profiles'), ('mdm_devices'), ('mdm_commands')
) AS required(required_table)
WHERE required_table NOT IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
);
" | tr -d ' ')

if [ ! -z "$MISSING_TABLES" ]; then
    echo "❌ Missing required tables: $MISSING_TABLES"
    echo "   Database schema incomplete. Check API logs:"
    docker logs configmaster-api --tail 50
    exit 1
fi

# Check if required columns exist
echo "🔍 Checking required columns..."

MISSING_COLUMNS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
SELECT string_agg(missing_col, ', ')
FROM (
    SELECT 'users.is_super_admin' as missing_col
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_super_admin'
    )
    UNION ALL
    SELECT 'users.organization_id' as missing_col
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'organization_id'
    )
    UNION ALL
    SELECT 'organizations.is_active' as missing_col
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'is_active'
    )
    UNION ALL
    SELECT 'organizations.is_primary' as missing_col
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'is_primary'
    )
) missing
WHERE missing_col IS NOT NULL;
" | tr -d ' ')

if [ ! -z "$MISSING_COLUMNS" ]; then
    echo "❌ Missing required columns: $MISSING_COLUMNS"
    echo ""
    echo "🔧 Applying missing schema fixes..."
    
    # Apply the missing schema directly
    docker exec configmaster-db psql -U postgres -d config_management -c "
    -- Add missing columns to users table
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id uuid;
    
    -- Add missing columns to organizations table  
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
    
    -- Add missing columns to servers table
    ALTER TABLE servers ADD COLUMN IF NOT EXISTS type varchar(50) NOT NULL DEFAULT 'linux';
    ALTER TABLE servers ADD COLUMN IF NOT EXISTS encrypted_password text;
    
    -- Add missing columns to server_groups table
    ALTER TABLE server_groups ADD COLUMN IF NOT EXISTS type varchar(50) DEFAULT 'mixed';
    
    -- Add missing columns to configurations table
    ALTER TABLE configurations ADD COLUMN IF NOT EXISTS source varchar(50) NOT NULL DEFAULT 'manual';
    ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approval_status varchar(50) NOT NULL DEFAULT 'pending';
    ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_by uuid;
    ALTER TABLE configurations ADD COLUMN IF NOT EXISTS approved_at timestamp;
    ALTER TABLE configurations ADD COLUMN IF NOT EXISTS rejection_reason text;
    
    -- Add foreign key constraints
    DO \$\$ BEGIN
     ALTER TABLE users ADD CONSTRAINT users_organization_id_organizations_id_fk 
     FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE no action ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END \$\$;
    
    DO \$\$ BEGIN
     ALTER TABLE configurations ADD CONSTRAINT configurations_approved_by_users_id_fk 
     FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE no action ON UPDATE no action;
    EXCEPTION
     WHEN duplicate_object THEN null;
    END \$\$;
    "
    
    echo "✅ Schema fixes applied"
fi

echo ""
echo "🔍 Verifying admin user setup..."

# Check if admin user exists and has correct permissions
ADMIN_CHECK=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
SELECT COUNT(*) FROM users WHERE email = '$DEFAULT_ADMIN_EMAIL' AND is_super_admin = true;
" | tr -d ' ')

if [ "$ADMIN_CHECK" = "0" ]; then
    echo "❌ Super admin user not properly configured"
    echo "   Checking API logs for setup issues..."
    docker logs configmaster-api --tail 20
else
    echo "✅ Super admin user configured correctly"
fi

echo ""
echo "🔍 Final system check..."

# Test API endpoints
if curl -s -X POST http://localhost:5005/api/auth/login \
   -H "Content-Type: application/json" \
   -d "{\"email\":\"$DEFAULT_ADMIN_EMAIL\",\"password\":\"$DEFAULT_ADMIN_PASSWORD\"}" \
   | grep -q "token"; then
    echo "✅ Authentication system working"
else
    echo "❌ Authentication system failed"
    echo "   Check API logs: docker logs configmaster-api"
fi

echo ""
echo "======================================"
echo "✅ FRESH INSTALLATION COMPLETE!"
echo "======================================"
echo ""
echo "🚀 Your Pulse Configuration Management system is ready!"
echo ""
echo "📋 ACCESS INFORMATION:"
echo "   Web UI: http://localhost:3000"
echo "   API: http://localhost:5005"
echo "   Admin Email: $DEFAULT_ADMIN_EMAIL"
echo "   Admin Password: $DEFAULT_ADMIN_PASSWORD"
echo ""
echo "🔧 NEXT STEPS:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Login with the admin credentials above"
echo "   3. Create your organization and users"
echo "   4. Configure your servers and deployments"
echo ""
echo "📚 DOCUMENTATION:"
echo "   - MDM Setup: Check the MDM section in the web UI"
echo "   - API Docs: http://localhost:5005/api/docs"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "   - Change the default admin password after first login"
echo "   - Configure environment variables for production"
echo "   - Use HTTPS in production environments"
echo ""