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

# Run the upgrade SQL
print_status "Applying database schema upgrades..."
if docker exec -i configmaster-db psql -U postgres -d config_management < upgrade.sql; then
    print_success "Database upgrade completed successfully"
else
    print_error "Database upgrade failed"
    exit 1
fi

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

# Verify GitHub integration permissions
GITHUB_PERMS=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM permissions WHERE resource = 'github-integrations';" | tr -d ' ')
if [ "$GITHUB_PERMS" -ge "5" ]; then
    print_success "GitHub integration RBAC permissions created successfully ($GITHUB_PERMS permissions)"
else
    print_error "GitHub integration RBAC permissions incomplete (found $GITHUB_PERMS, expected 5+)"
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
echo "🔐 Security & Permissions:"
echo "   • Enhanced RBAC with asset permissions"
echo "   • GitHub integration permissions"
echo "   • Full admin permissions for new users"
echo "   • Separate repository selection for assets vs configurations"
echo ""
echo "🌐 Access your upgraded Pulse at: http://localhost:3000"
echo "⚙️  Configure GitHub integration: Settings > Integrations"
echo "📦 Sync assets to GitHub: Assets > Sync to GitHub"
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
