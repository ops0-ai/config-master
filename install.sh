#!/bin/bash

echo "🚀 Pulse Platform Installation Script"
echo "====================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose is not available. Please install Docker Compose and try again."
    exit 1
fi

# Use docker compose or docker-compose based on availability
COMPOSE_CMD="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
fi

echo "🔧 Using: $COMPOSE_CMD"
echo ""

# Clean up any existing installation
echo "🧹 Cleaning up any existing installation..."
$COMPOSE_CMD down -v 2>/dev/null || true
docker system prune -f >/dev/null 2>&1 || true

echo "📦 Building containers..."
$COMPOSE_CMD build --no-cache

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the logs above."
    exit 1
fi

echo "🚀 Starting services..."
$COMPOSE_CMD up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services. Please check the logs above."
    exit 1
fi

echo "⏳ Waiting for services to initialize..."
sleep 30

# Check if services are healthy
echo "🔍 Checking service health..."

# Check API
API_HEALTH=$(curl -s http://localhost:5005/health 2>/dev/null || echo "failed")
if [[ $API_HEALTH == *"ok"* ]]; then
    echo "✅ API service is healthy"
else
    echo "❌ API service is not responding"
    echo "📋 API logs:"
    $COMPOSE_CMD logs api | tail -10
    exit 1
fi

# Check Web
WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$WEB_HEALTH" = "200" ]; then
    echo "✅ Web service is healthy"
else
    echo "❌ Web service is not responding"
    echo "📋 Web logs:"
    $COMPOSE_CMD logs web | tail -10
    exit 1
fi

# Check database
DB_HEALTH=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT 1;" 2>/dev/null | grep -c "1 row" || echo "0")
if [ "$DB_HEALTH" = "1" ]; then
    echo "✅ Database is healthy"
else
    echo "❌ Database is not responding"
    echo "📋 Database logs:"
    $COMPOSE_CMD logs database | tail -10
    exit 1
fi

# Verify asset tables exist
ASSET_TABLES=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('assets', 'asset_assignments');" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$ASSET_TABLES" = "2" ]; then
    echo "✅ Asset management tables created"
else
    echo "❌ Asset management tables missing"
    exit 1
fi

# Verify GitHub integration tables exist
GITHUB_TABLES=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('github_integrations', 'configuration_github_mappings');" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$GITHUB_TABLES" = "2" ]; then
    echo "✅ GitHub integration tables created"
else
    echo "❌ GitHub integration tables missing"
    exit 1
fi

# Verify configuration metadata column exists
METADATA_COLUMN=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'configurations' AND column_name = 'metadata';" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$METADATA_COLUMN" = "1" ]; then
    echo "✅ Configuration metadata tracking ready"
else
    echo "❌ Configuration metadata tracking missing"
    exit 1
fi

# Verify MDM integration
MDM_COLUMN=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'mdm_device_id';" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$MDM_COLUMN" = "1" ]; then
    echo "✅ MDM-Asset integration ready"
else
    echo "❌ MDM-Asset integration missing"
    exit 1
fi

# Verify RBAC permissions
ASSET_PERMISSIONS=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT COUNT(*) FROM permissions WHERE resource = 'asset';" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$ASSET_PERMISSIONS" -ge "6" ]; then
    echo "✅ Asset RBAC permissions configured"
else
    echo "❌ Asset RBAC permissions missing"
    exit 1
fi

# Verify GitHub integration permissions
GITHUB_PERMISSIONS=$($COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT COUNT(*) FROM permissions WHERE resource = 'github-integrations';" 2>/dev/null | grep -o '[0-9]\+' | head -1 || echo "0")
if [ "$GITHUB_PERMISSIONS" -ge "4" ]; then
    echo "✅ GitHub integration RBAC permissions configured"
else
    echo "❌ GitHub integration RBAC permissions missing"
    exit 1
fi

# Test asset sync endpoint
echo "🔍 Testing asset sync endpoint..."
ASSET_SYNC_TEST=$(curl -s -X POST http://localhost:5005/api/github/integrations/test/sync-asset-inventory -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "failed")
if echo "$ASSET_SYNC_TEST" | grep -q "Access denied\|Invalid token"; then
    echo "✅ Asset sync endpoint is available"
else
    echo "❌ Asset sync endpoint not found"
    exit 1
fi

echo ""
echo "🎉 Installation Complete!"
echo ""
echo "🌐 Services:"
echo "   Web Interface: http://localhost:3000"
echo "   API Server: http://localhost:5005"
echo ""
echo "📋 Features Available:"
echo "   ✅ Complete Asset Management"
echo "   ✅ MDM-to-Asset Sync (green 'Sync from MDM' button)"
echo "   ✅ Asset-to-GitHub Sync (purple 'Sync to GitHub' button)" 
echo "   ✅ GitHub Configuration Integration"
echo "   ✅ Configuration Import/Export to GitHub"
echo "   ✅ Asset Assignment & Reassignment"
echo "   ✅ Role-based Access Control"
echo "   ✅ Configuration Management"
echo "   ✅ Server Management"
echo "   ✅ Deployment Pipeline"
echo ""
echo "🔗 Quick Start:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Register a new account (gets admin privileges)"
echo "   3. Set up GitHub integration: Settings > Integrations"
echo "   4. Navigate to Assets to use MDM and GitHub sync features"
echo "   5. Navigate to Configurations to import/sync with GitHub"
echo ""
echo "🛠️  Useful Commands:"
echo "   Stop:     $COMPOSE_CMD down"
echo "   Restart:  $COMPOSE_CMD restart"
echo "   Logs:     $COMPOSE_CMD logs -f"
echo "   Status:   $COMPOSE_CMD ps"
echo ""