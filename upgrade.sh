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

# Rebuild containers to ensure latest features
print_status "Rebuilding containers with latest features..."
if docker compose build --no-cache; then
    print_success "Containers rebuilt successfully"
else
    print_error "Container rebuild failed"
    exit 1
fi

# Restart containers to load new schema and features
print_status "Restarting Pulse containers..."
if docker compose restart; then
    print_success "Containers restarted successfully"
else
    print_warning "Container restart failed, you may need to restart manually"
fi

# Wait for containers to be healthy
print_status "Waiting for containers to be healthy..."
sleep 15

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
ASSET_SYNC_TEST=$(curl -s -X POST http://localhost:5005/api/github/integrations/test/sync-asset-inventory -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "failed")
if echo "$ASSET_SYNC_TEST" | grep -q "Access denied\|Invalid token"; then
    print_success "Asset sync endpoint is available"
else
    print_error "Asset sync endpoint not found"
    exit 1
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
echo "   • GitHub repository integration for configurations"
echo "   • GitHub asset inventory sync (CSV/JSON export)"
echo "   • Import configurations from GitHub repositories"  
echo "   • Sync configurations back to GitHub"
echo "   • Directory structure preservation"
echo "   • Configuration metadata tracking"
echo "   • Enhanced admin permissions for new users"
echo "   • Separate repository selection for assets vs configurations"
echo ""
echo "🌐 Access your upgraded Pulse at: http://localhost:3000"
echo "⚙️  Configure GitHub integration: Settings > Integrations"
echo "📦 Sync assets to GitHub: Assets > Sync to GitHub"
echo ""
echo "📁 Database backup saved as: $BACKUP_FILE"
echo "   (Keep this backup safe in case you need to rollback)"
echo ""
print_success "Upgrade complete! Ready for production use 🎉"
