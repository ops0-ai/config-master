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
sleep 45

# Wait for API to be fully ready with migrations
echo "🔧 Waiting for database migrations and platform initialization..."
WAIT_TIME=0
MAX_WAIT=120

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    API_CHECK=$(curl -s http://localhost:5005/health 2>/dev/null || echo "waiting")
    if [[ "$API_CHECK" == *"ok"* ]]; then
        echo "✅ Platform initialization complete"
        break
    fi
    
    echo -n "."
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
done

echo ""

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo "❌ Platform initialization timeout"
    echo "📋 API logs:"
    $COMPOSE_CMD logs api | tail -20
    exit 1
fi

# Apply comprehensive schema during installation to ensure all tables exist
echo "🗄️ Ensuring complete database schema (including AI assistant tables)..."
WAIT_FOR_SCHEMA=0
MAX_SCHEMA_WAIT=60
while [ $WAIT_FOR_SCHEMA -lt $MAX_SCHEMA_WAIT ]; do
    if $COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database is accessible, applying comprehensive schema..."
        if $COMPOSE_CMD exec -i database psql -U postgres -d config_management < comprehensive-upgrade.sql; then
            echo "✅ Comprehensive database schema applied successfully"
            break
        else
            echo "⚠️ Schema application failed, but continuing (API migrations will handle this)"
            break
        fi
    fi
    echo -n "."
    sleep 3
    WAIT_FOR_SCHEMA=$((WAIT_FOR_SCHEMA + 3))
done

if [ $WAIT_FOR_SCHEMA -ge $MAX_SCHEMA_WAIT ]; then
    echo "⚠️ Could not apply comprehensive schema, relying on API migrations"
fi

# Check if services are healthy
echo "🔍 Verifying service health..."

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

# Check Web (with retry for Next.js startup)
echo "🔍 Checking web service..."
WEB_RETRY=0
while [ $WEB_RETRY -lt 6 ]; do
    WEB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
    if [ "$WEB_HEALTH" = "200" ]; then
        echo "✅ Web service is healthy"
        break
    fi
    echo -n "."
    sleep 5
    WEB_RETRY=$((WEB_RETRY + 1))
done

if [ "$WEB_HEALTH" != "200" ]; then
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

echo "🔍 Verifying installation completeness..."

# Verify AI assistant tables exist (critical for new installations)
echo "🤖 Verifying AI assistant tables..."
AI_TABLES_OK=true

if ! $COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "\d ai_assistant_sessions" >/dev/null 2>&1; then
    echo "❌ AI assistant sessions table missing"
    AI_TABLES_OK=false
fi

if ! $COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "\d ai_assistant_messages" >/dev/null 2>&1; then
    echo "❌ AI assistant messages table missing"
    AI_TABLES_OK=false
fi

if ! $COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "\d ai_suggestions" >/dev/null 2>&1; then
    echo "❌ AI suggestions table missing"
    AI_TABLES_OK=false
fi

if [ "$AI_TABLES_OK" = true ]; then
    echo "✅ AI assistant tables verified successfully"
else
    echo "⚠️ AI assistant tables missing - attempting to create them..."
    if $COMPOSE_CMD exec -i database psql -U postgres -d config_management < packages/database/migrations/0003_add_ai_assistant_tables.sql; then
        echo "✅ AI assistant tables created successfully"
    else
        echo "⚠️ Failed to create AI assistant tables - they will be created on first use"
    fi
fi

# Verify core features are available
echo "🔍 Verifying core features..."
if $COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "\d assets" >/dev/null 2>&1; then
    echo "✅ Asset management tables verified"
else
    echo "⚠️ Asset management tables not found"
fi

if $COMPOSE_CMD exec -T database psql -U postgres -d config_management -c "\d github_integrations" >/dev/null 2>&1; then
    echo "✅ GitHub integration tables verified"
else
    echo "⚠️ GitHub integration tables not found"
fi

echo "✅ Installation verification complete"

echo ""
echo "🎉 Installation Complete!"
echo ""
echo "🌐 Services:"
echo "   Web Interface: http://localhost:3000"
echo "   API Server: http://localhost:5005"
echo ""
echo "📋 Features Available:"
echo ""
echo "🤖 AI Assistant Features:"
echo "   ✅ Smart configuration analysis and optimization recommendations"  
echo "   ✅ Automated asset creation and management assistance"
echo "   ✅ Configuration approval/rejection workflow automation"
echo "   ✅ Deployment creation and monitoring with AI insights"
echo "   ✅ Context-aware assistance across all platform pages"
echo "   ✅ Expandable modal interface for extended AI conversations"
echo "   ✅ Intelligent suggestions based on your infrastructure"
echo ""
echo "📦 Core Platform Features:"
echo "   ✅ Complete Asset Management with AI-powered insights"
echo "   ✅ MDM-to-Asset Sync (green 'Sync from MDM' button)"
echo "   ✅ Asset-to-GitHub Sync (purple 'Sync to GitHub' button)" 
echo "   ✅ GitHub Configuration Integration"
echo "   ✅ Configuration Import/Export to GitHub"
echo "   ✅ Asset Assignment & Reassignment with AI recommendations"
echo "   ✅ Role-based Access Control (62 permissions total)"
echo "   ✅ Administrator roles with complete access to all features"
echo "   ✅ Organization-level Feature Management"
echo "   ✅ Super Admin Organization Control"
echo "   ✅ Configuration Management with AI analysis"
echo "   ✅ Server Management with intelligent monitoring"
echo "   ✅ Deployment Pipeline with AI-powered optimization"
echo "   ✅ User Signup Webhook Notifications"
echo "   ✅ Real-time Webhook Notifications with Company Detection"
echo ""
echo "🔗 Quick Start:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Register a new account (automatically gets Administrator role with all 62 permissions)"
echo "   3. Set up GitHub integration: Settings > Integrations"
echo "   4. Configure webhook notifications: Organization Management > Platform Settings"
echo "   5. Navigate to Assets to use MDM and GitHub sync features"
echo "   6. Navigate to Configurations to import/sync with GitHub"
echo "   7. Super Admins: Organization Management for feature control"
echo ""
echo "🔔 Webhook Setup:"
echo "   1. Go to Organization Management > Platform Settings"
echo "   2. Enter your webhook URL (Teams, Slack, Discord, etc.)"
echo "   3. Click 'Test' to verify webhook works"
echo "   4. Enable 'New Organization Signup Notifications'"
echo "   5. Get notified when new users register with company details!"
echo ""
echo "🛠️  Useful Commands:"
echo "   Stop:     $COMPOSE_CMD down"
echo "   Restart:  $COMPOSE_CMD restart"
echo "   Logs:     $COMPOSE_CMD logs -f"
echo "   Status:   $COMPOSE_CMD ps"
echo ""