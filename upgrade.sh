#\!/bin/bash

# ConfigMaster GitHub Integration Upgrade Script
# This script safely upgrades existing ConfigMaster installations to support GitHub integration

set -e

echo "🚀 ConfigMaster GitHub Integration Upgrade"
echo "=========================================="
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
print_status "Checking ConfigMaster containers..."
if \! docker compose ps | grep -q "configmaster-db"; then
    print_error "ConfigMaster database container is not running."
    print_status "Please start ConfigMaster with: docker compose up -d"
    exit 1
fi

print_success "ConfigMaster containers are running"

# Backup database
print_status "Creating database backup..."
BACKUP_FILE="configmaster_backup_$(date +%Y%m%d_%H%M%S).sql"

if docker exec configmaster-db pg_dump -U postgres -d config_management > "$BACKUP_FILE" 2>/dev/null; then
    print_success "Database backup created: $BACKUP_FILE"
else
    print_warning "Database backup failed, but continuing with upgrade..."
fi

# Run the upgrade SQL
print_status "Applying GitHub integration upgrade..."
if docker exec -i configmaster-db psql -U postgres -d config_management < upgrade.sql; then
    print_success "Database upgrade completed successfully"
else
    print_error "Database upgrade failed"
    exit 1
fi

# Restart containers to load new schema
print_status "Restarting ConfigMaster containers..."
if docker compose restart api web; then
    print_success "Containers restarted successfully"
else
    print_warning "Container restart failed, you may need to restart manually"
fi

# Wait for containers to be healthy
print_status "Waiting for containers to be healthy..."
sleep 10

# Verify upgrade
print_status "Verifying upgrade..."
if docker exec configmaster-db psql -U postgres -d config_management -c "\d github_integrations" &>/dev/null; then
    print_success "GitHub integration tables created successfully"
else
    print_error "GitHub integration tables not found"
    exit 1
fi

if docker exec configmaster-db psql -U postgres -d config_management -c "\d configurations" | grep -q "metadata"; then
    print_success "Metadata column added to configurations table"
else
    print_error "Metadata column not found in configurations table"
    exit 1
fi

echo ""
echo "✅ ConfigMaster GitHub Integration upgrade completed successfully\!"
echo ""
echo "📋 What's new:"
echo "   • GitHub repository integration"
echo "   • Import configurations from GitHub"
echo "   • Sync configurations back to GitHub"
echo "   • Directory structure preservation"
echo "   • Configuration metadata tracking"
echo ""
echo "🌐 Access your upgraded ConfigMaster at: http://localhost:3000"
echo "⚙️  Configure GitHub integration in: Settings > Integrations"
echo ""
echo "📁 Database backup saved as: $BACKUP_FILE"
echo "   (Keep this backup in case you need to rollback)"
echo ""
print_success "Upgrade complete\! 🎉"
EOF < /dev/null
