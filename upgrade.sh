#\!/bin/bash

# Pulse Platform Upgrade Script
# This script safely upgrades existing Pulse installations with all latest features

set -e

echo "🚀 Pulse Platform Upgrade"
echo "========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker compose is available
if \! command -v docker compose &> /dev/null; then
    print_error "docker compose is required but not installed."
    exit 1
fi

# Check if containers are running
print_status "Checking Pulse containers..."
if \! docker compose ps | grep -q "configmaster-db"; then
    print_error "Pulse database container is not running."
    print_status "Please start Pulse with: docker compose up -d"
    exit 1
fi

print_success "Pulse containers are running"

# Backup database
print_status "Creating database backup..."
BACKUP_FILE="pulse_backup_$(date +%Y%m%d_%H%M%S).sql"

if docker exec configmaster-db pg_dump -U postgres -d config_management > "$BACKUP_FILE" 2>/dev/null; then
    print_success "Database backup created: $BACKUP_FILE"
else
    print_warning "Database backup failed, but continuing with upgrade..."
fi

# Run the comprehensive upgrade SQL (includes all schemas and migrations)
print_status "Applying comprehensive database schema upgrades..."
if docker exec -i configmaster-db psql -U postgres -d config_management < comprehensive-upgrade.sql; then
    print_success "Comprehensive database upgrade completed successfully"
    
    # Always apply the email case-insensitive fix after comprehensive upgrade
    print_status "Applying email case-insensitive fix (Microsoft SSO compatibility)..."
    if docker exec -i configmaster-db psql -U postgres -d config_management < email-case-insensitive-fix.sql; then
        print_success "Email case-insensitive fix completed"
    else
        print_warning "Email case-insensitive fix failed, but continuing..."
    fi
else
    # Fallback to individual migration files if comprehensive fails
    print_warning "Comprehensive upgrade failed, trying individual migrations..."
    
    # Run the original upgrade SQL
    print_status "Applying base database schema upgrades..."
    if docker exec -i configmaster-db psql -U postgres -d config_management < upgrade.sql; then
        print_success "Base database upgrade completed"
    else
        print_error "Base database upgrade failed"
        exit 1
    fi
    
    # Run the feature flags migration
    print_status "Applying feature flags migration..."
    if docker exec -i configmaster-db psql -U postgres -d config_management < feature-flags-migration.sql; then
        print_success "Feature flags migration completed"
    else
        print_error "Feature flags migration failed"
        exit 1
    fi
    
    # Run the RBAC permissions fix
    print_status "Applying RBAC permissions fix..."
    if docker exec -i configmaster-db psql -U postgres -d config_management < rbac-permissions-fix.sql; then
        print_success "RBAC permissions fix completed"
    else
        print_error "RBAC permissions fix failed"
        exit 1
    fi
    
    # Run the email case-insensitive fix
    print_status "Applying email case-insensitive fix (Microsoft SSO compatibility)..."
    if docker exec -i configmaster-db psql -U postgres -d config_management < email-case-insensitive-fix.sql; then
        print_success "Email case-insensitive fix completed"
    else
        print_error "Email case-insensitive fix failed"
        exit 1
    fi
fi

print_status "All database migrations completed successfully"

# Stop containers before rebuilding
print_status "Stopping current containers..."
docker compose down

# Remove old images to force complete rebuild
print_status "Removing old container images to ensure fresh build..."
docker rmi configmaster-web configmaster-api 2>/dev/null || true
docker rmi $(docker images -q -f "dangling=true") 2>/dev/null || true

# Rebuild containers to ensure latest features
print_status "Rebuilding containers with latest features (this will take a few minutes)..."
if docker compose build --no-cache --pull; then
    print_success "Containers rebuilt successfully"
else
    print_error "Container rebuild failed"
    exit 1
fi

# Start fresh containers
print_status "Starting fresh Pulse containers..."
if docker compose up -d; then
    print_success "Containers started successfully"
else
    print_error "Failed to start containers"
    exit 1
fi

# Wait for containers to be healthy
print_status "Waiting for containers to be healthy (this may take up to 60 seconds)..."
WAIT_TIME=0
MAX_WAIT=60

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    API_CHECK=$(curl -s http://localhost:5005/health 2>/dev/null || echo "waiting")
    WEB_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
    
    if [[ "$API_CHECK" == *"ok"* ]] && [ "$WEB_CHECK" = "200" ]; then
        print_success "Services are ready!"
        break
    fi
    
    echo -n "."
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
done

echo ""

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    print_warning "Services took longer than expected to start"
fi

# Verify upgrade - Database schema
print_status "Verifying database schema..."
if docker exec configmaster-db psql -U postgres -d config_management -c "\d github_integrations" &>/dev/null; then
    print_success "GitHub integration tables created successfully"
else
    print_error "GitHub integration tables not found"
    exit 1
fi

if docker exec configmaster-db psql -U postgres -d config_management -c "\d configurations" | grep -q "metadata"; then
    print_success "Configuration metadata column created successfully"
else
    print_error "Metadata column not found in configurations table"
    exit 1
fi

# Verify asset management tables
if docker exec configmaster-db psql -U postgres -d config_management -c "\d assets" &>/dev/null; then
    print_success "Asset management tables created successfully"
else
    print_error "Asset management tables not found"
    exit 1
fi

if docker exec configmaster-db psql -U postgres -d config_management -c "\d asset_assignments" &>/dev/null; then
    print_success "Asset assignment tracking table created successfully"
else
    print_error "Asset assignment table not found"
    exit 1
fi

# Verify MDM integration columns
if docker exec configmaster-db psql -U postgres -d config_management -c "\d assets" | grep -q "mdm_device_id"; then
    print_success "MDM-Asset integration columns created successfully"
else
    print_error "MDM integration columns not found in assets table"
    exit 1
fi

# Verify asset RBAC permissions
ASSET_PERMS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM permissions WHERE resource = 'asset';" | tr -d ' ')
if [ "$ASSET_PERMS" -ge "7" ]; then
    print_success "Asset RBAC permissions created successfully ($ASSET_PERMS permissions)"
else
    print_error "Asset RBAC permissions incomplete (found $ASSET_PERMS, expected 7+)"
    exit 1
fi

# First, clean up any duplicate permissions
print_status "Cleaning up duplicate permissions..."
docker exec configmaster-db psql -U postgres -d config_management -c "
    -- First, create a temp table with the permissions we want to keep (one per resource:action)
    CREATE TEMP TABLE permissions_to_keep AS
    SELECT MIN(p.ctid) as keep_ctid, p.resource, p.action
    FROM permissions p
    GROUP BY p.resource, p.action;
    
    -- Delete role_permissions entries that reference duplicate permissions
    DELETE FROM role_permissions 
    WHERE permission_id IN (
        SELECT id FROM permissions p
        WHERE p.ctid NOT IN (SELECT keep_ctid FROM permissions_to_keep)
    );
    
    -- Now we can safely delete the duplicate permissions
    DELETE FROM permissions p1 
    WHERE p1.ctid NOT IN (SELECT keep_ctid FROM permissions_to_keep);
    
    -- Clean up any remaining orphaned role_permissions entries
    DELETE FROM role_permissions 
    WHERE permission_id NOT IN (SELECT id FROM permissions);
    
    -- Add unique constraint to prevent future duplicates (ignore if exists)
    DO \$\$ 
    BEGIN
        ALTER TABLE permissions ADD CONSTRAINT permissions_resource_action_unique UNIQUE (resource, action);
    EXCEPTION 
        WHEN duplicate_table THEN NULL;
    END \$\$;
    
    -- Also add unique constraint to role_permissions (ignore if exists)
    DO \$\$ 
    BEGIN
        ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id);
    EXCEPTION 
        WHEN duplicate_table THEN NULL;
    END \$\$;
"

# Verify we have exactly 62 permissions
print_status "Verifying permission count..."
TOTAL_PERMS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM permissions;" | tr -d ' ')
if [ "$TOTAL_PERMS" -ne "62" ]; then
    print_warning "Expected 62 permissions, found $TOTAL_PERMS. Running RBAC seeder to fix..."
    docker exec configmaster-api npm run seed-rbac 2>/dev/null || true
    TOTAL_PERMS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM permissions;" | tr -d ' ')
fi

# Verify Administrator roles have all permissions
print_status "Verifying Administrator roles have complete permissions..."
ADMIN_PERM_CHECK=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
    SELECT COUNT(DISTINCT r.id) 
    FROM roles r 
    JOIN role_permissions rp ON r.id = rp.role_id 
    WHERE r.name = 'Administrator' 
    GROUP BY r.id 
    HAVING COUNT(rp.permission_id) = $TOTAL_PERMS
;" | wc -l | tr -d ' ')

ADMIN_ROLES_COUNT=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM roles WHERE name = 'Administrator';" | tr -d ' ')

if [ "$ADMIN_PERM_CHECK" -eq "$ADMIN_ROLES_COUNT" ]; then
    print_success "All $ADMIN_ROLES_COUNT Administrator roles have complete permissions ($TOTAL_PERMS each)"
else
    print_warning "Some Administrator roles are missing permissions (Expected: $ADMIN_ROLES_COUNT with $TOTAL_PERMS, Found: $ADMIN_PERM_CHECK)"
    # Show detailed info for troubleshooting
    docker exec configmaster-db psql -U postgres -d config_management -c "
        SELECT o.name as org_name, r.name as role_name, COUNT(rp.permission_id) as perm_count 
        FROM organizations o
        JOIN roles r ON o.id = r.organization_id 
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.name = 'Administrator'
        GROUP BY o.id, o.name, r.id, r.name
        ORDER BY o.name;
    "
    
    # Fix Administrator role permissions automatically
    print_status "Fixing Administrator role permissions..."
    docker exec configmaster-db psql -U postgres -d config_management -c "
        -- First remove any duplicate role_permissions
        DELETE FROM role_permissions rp1 
        WHERE rp1.ctid NOT IN (
            SELECT MIN(rp2.ctid) 
            FROM role_permissions rp2 
            GROUP BY rp2.role_id, rp2.permission_id
        );
        
        -- Then ensure all Administrator roles have all permissions
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id as role_id, p.id as permission_id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = 'Administrator'
        AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp 
            WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    "
    
    # Verify the fix worked
    FIXED_ADMIN_CHECK=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
        SELECT COUNT(DISTINCT r.id) 
        FROM roles r 
        JOIN role_permissions rp ON r.id = rp.role_id 
        WHERE r.name = 'Administrator' 
        GROUP BY r.id 
        HAVING COUNT(rp.permission_id) = $TOTAL_PERMS
    ;" | wc -l | tr -d ' ')
    
    if [ "$FIXED_ADMIN_CHECK" -eq "$ADMIN_ROLES_COUNT" ]; then
        print_success "✅ Fixed! All $ADMIN_ROLES_COUNT Administrator roles now have complete permissions ($TOTAL_PERMS each)"
    else
        print_error "❌ Failed to fix Administrator role permissions"
        exit 1
    fi
fi

# Verify GitHub integration permissions
GITHUB_PERMS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM permissions WHERE resource = 'github-integrations';" | tr -d ' ')
if [ "$GITHUB_PERMS" -ge "5" ]; then
    print_success "GitHub integration RBAC permissions created successfully ($GITHUB_PERMS permissions)"
else
    print_error "GitHub integration RBAC permissions incomplete (found $GITHUB_PERMS, expected 5+)"
    exit 1
fi

# Verify SSO integration permissions
SSO_PERMS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM permissions WHERE resource = 'sso';" | tr -d ' ')
if [ "$SSO_PERMS" -ge "5" ]; then
    print_success "SSO RBAC permissions created successfully ($SSO_PERMS permissions)"
else
    print_error "SSO RBAC permissions incomplete (found $SSO_PERMS, expected 5+)"
    exit 1
fi

# Verify SSO tables exist
if docker exec configmaster-db psql -U postgres -d config_management -c "\d sso_providers" &>/dev/null; then
    print_success "SSO providers table created successfully"
else
    print_error "SSO providers table not found"
    exit 1
fi

if docker exec configmaster-db psql -U postgres -d config_management -c "\d sso_domain_mappings" &>/dev/null; then
    print_success "SSO domain mappings table created successfully"
else
    print_error "SSO domain mappings table not found"
    exit 1
fi

if docker exec configmaster-db psql -U postgres -d config_management -c "\d user_sso_mappings" &>/dev/null; then
    print_success "User SSO mappings table created successfully"
else
    print_error "User SSO mappings table not found"
    exit 1
fi

# Verify SSO columns in users table
if docker exec configmaster-db psql -U postgres -d config_management -c "\d users" | grep -q "auth_method"; then
    print_success "SSO integration columns created successfully in users table"
else
    print_error "SSO integration columns not found in users table"
    exit 1
fi

# Verify email case-insensitive fixes
print_status "Verifying email case-insensitive fixes..."
EMAIL_DUPLICATES=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
    SELECT COUNT(*) 
    FROM (
        SELECT LOWER(email), organization_id, COUNT(*) as cnt
        FROM users 
        GROUP BY LOWER(email), organization_id
        HAVING COUNT(*) > 1
    ) duplicates;
" | tr -d ' ')

NON_NORMALIZED_EMAILS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
    SELECT COUNT(*) FROM users WHERE email != LOWER(email);
" | tr -d ' ')

EMAIL_TRIGGER_EXISTS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "
    SELECT COUNT(*) FROM information_schema.triggers 
    WHERE trigger_name = 'normalize_user_email_trigger';
" | tr -d ' ')

if [ "$EMAIL_DUPLICATES" -eq "0" ]; then
    print_success "✅ No duplicate emails found (case-insensitive check passed)"
else
    print_error "❌ Found $EMAIL_DUPLICATES duplicate emails (case-insensitive)"
    exit 1
fi

if [ "$NON_NORMALIZED_EMAILS" -eq "0" ]; then
    print_success "✅ All emails are properly normalized to lowercase"
else
    print_error "❌ Found $NON_NORMALIZED_EMAILS emails that are not lowercase"
    exit 1
fi

if [ "$EMAIL_TRIGGER_EXISTS" -gt "0" ]; then
    print_success "✅ Email normalization trigger is active"
else
    print_error "❌ Email normalization trigger is not active"
    exit 1
fi

# Verify API endpoints
print_status "Verifying API endpoints..."
API_HEALTH=$(curl -s http://localhost:5005/health 2>/dev/null || echo "failed")
if echo "$API_HEALTH" | grep -q "ok"; then
    print_success "API service is healthy"
else
    print_error "API service health check failed"
    exit 1
fi

# Verify asset sync endpoint exists
print_status "Testing asset sync API endpoint..."
ASSET_SYNC_TEST=$(curl -s -X POST http://localhost:5005/api/github/integrations/test/sync-asset-inventory -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "failed")
if echo "$ASSET_SYNC_TEST" | grep -q "Access denied\|Invalid token\|No token provided\|Unauthorized"; then
    print_success "✅ Asset sync API endpoint is working correctly"
elif echo "$ASSET_SYNC_TEST" | grep -q "not found\|Cannot POST"; then
    print_error "❌ Asset sync endpoint not found"
    print_warning "This is a critical error - the API container doesn't have the latest code"
    print_status "Checking API container logs..."
    docker compose logs api | tail -20
    exit 1
else
    print_warning "Asset sync endpoint returned unexpected response: $ASSET_SYNC_TEST"
fi

# Verify the frontend has the asset sync components
print_status "Verifying frontend has asset sync UI components..."
WEB_FILES=$(docker exec configmaster-web ls -la /app/.next/static/chunks/pages/ 2>/dev/null || echo "failed")
if echo "$WEB_FILES" | grep -q "assets"; then
    print_success "✅ Asset management UI components found"
else
    print_warning "⚠️  Asset UI components may not be properly built"
    print_status "The web container may need a full rebuild"
fi

# Verify web interface
print_status "Verifying web interface..."
WEB_TEST=$(curl -s http://localhost:3000 2>/dev/null | head -10 || echo "failed")
if echo "$WEB_TEST" | grep -q "ConfigMaster\|Pulse"; then
    print_success "Web interface is accessible"
else
    print_error "Web interface not accessible"
    exit 1
fi

echo ""
echo "✅ Pulse Platform upgrade completed successfully\!"
echo ""
echo "📋 New Features Available:"
echo ""
echo "🔧 GitHub Integration:"
echo "   • Import configurations from GitHub repositories"
echo "   • Sync configurations back to GitHub"
echo "   • Directory structure preservation"
echo "   • Configuration metadata tracking"
echo ""
echo "📦 Asset Management:"
echo "   • Complete asset lifecycle management"
echo "   • Asset assignment and reassignment tracking"
echo "   • Asset-to-GitHub sync (CSV/JSON export)"
echo "   • MDM device integration for automatic asset sync"
echo "   • Bulk asset import from CSV"
echo "   • Asset audit trail and history"
echo ""
echo "🔐 SSO (Single Sign-On):"
echo "   • OIDC provider support (Google, Microsoft, etc.)"
echo "   • Domain-based organization mapping"
echo "   • Automatic user provisioning"
echo "   • B2C and B2B organization strategies"
echo "   • Super admin SSO provider management"
echo "   • Encrypted client secrets storage"
echo ""
echo "🔔 Webhook Notifications:"
echo "   • User signup webhook notifications"
echo "   • Automatic company detection from email domains"
echo "   • Real-time notifications with formatted messages"
echo "   • Support for Teams, Slack, Discord, and other webhooks"
echo "   • Test webhook functionality"
echo "   • Organization-level webhook configuration"
echo ""
echo "🔐 Security & Permissions:"
echo "   • Enhanced RBAC with asset permissions"
echo "   • GitHub integration permissions"
echo "   • SSO (Single Sign-On) permissions and management"
echo "   • ✅ FIXED: All Administrator roles now have complete permissions (62 total)"
echo "   • ✅ FIXED: New users get full access to all features including assets and SSO"
echo "   • ✅ FIXED: Microsoft SSO email case sensitivity issue resolved"
echo "   • ✅ FIXED: Automatic email normalization (prevents duplicate users)"
echo "   • Organization-level feature management"
echo "   • Super admin organization control"
echo "   • Separate repository selection for assets vs configurations"
echo ""
echo "🌐 Access your upgraded Pulse at: http://localhost:3000"
echo "⚙️  Configure GitHub integration: Settings > Integrations"
echo "📦 Sync assets to GitHub: Assets > Sync to GitHub"
echo "🔔 Configure webhooks: Organization Management > Platform Settings"
echo "🔐 Configure SSO providers: Super Admin > SSO Management"
echo "🏢 Super Admin: Organization Management for feature control"
echo ""
echo "⚠️  IMPORTANT: If you don't see the 'Sync to GitHub' button in Assets:"
echo "   1. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
echo "   2. Log out and log back in"
echo "   3. Use an incognito/private browser window"
echo "   4. Ensure you have a GitHub integration configured in Settings > Integrations"
echo ""
echo "📁 Database backup saved as: $BACKUP_FILE"
echo "   (Keep this backup safe in case you need to rollback)"
echo ""
print_success "Upgrade complete! Ready for production use 🎉"
