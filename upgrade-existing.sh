#\!/bin/bash

echo "🔄 ConfigMaster Asset Management Upgrade Script"
echo "=============================================="
echo ""

# Check if running
if \! docker-compose ps | grep -q "Up"; then
    echo "❌ System is not running. Please start with 'docker-compose up -d' first."
    exit 1
fi

echo "⚠️  CRITICAL: This will upgrade your existing system with asset management features."
echo "   Make sure you have backups before proceeding\!"
echo ""
read -p "Have you backed up your database? (y/N): " -n 1 -r
echo
if [[ \! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please backup your database first. Exiting."
    exit 1
fi

echo ""
echo "📋 Upgrade Steps:"
echo "1. Create database backup"
echo "2. Stop containers gracefully"
echo "3. Pull latest code changes"
echo "4. Rebuild containers with new features"
echo "5. Start system and run migrations"
echo "6. Verify asset management is working"
echo ""
read -p "Proceed with upgrade? (y/N): " -n 1 -r
echo
if [[ \! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Upgrade cancelled."
    exit 1
fi

echo ""
echo "🗃️  Step 1: Creating database backup..."
BACKUP_FILE="configmaster_backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec configmaster-db pg_dump -U postgres -d config_management > "$BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo "✅ Database backup created: $BACKUP_FILE"
else
    echo "❌ Database backup failed. Exiting."
    exit 1
fi

echo ""
echo "🛑 Step 2: Stopping containers gracefully..."
docker-compose down
echo "✅ Containers stopped"

echo ""
echo "📦 Step 3: Rebuilding containers with asset management..."
docker-compose build --no-cache
if [ $? -eq 0 ]; then
    echo "✅ Containers rebuilt successfully"
else
    echo "❌ Container build failed. Exiting."
    exit 1
fi

echo ""
echo "🚀 Step 4: Starting upgraded system..."
docker-compose up -d
echo "✅ System started"

echo ""
echo "⏳ Step 5: Waiting for system initialization..."
sleep 20

echo ""
echo "🔍 Step 6: Verifying upgrade..."
# Check if asset tables exist
ASSET_TABLES=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'asset%';")
if [ "$ASSET_TABLES" -gt 0 ]; then
    echo "✅ Asset tables created successfully"
else
    echo "❌ Asset tables not found"
fi

# Check logs for successful RBAC seeding
if docker-compose logs api | grep -q "RBAC seeding completed successfully"; then
    echo "✅ RBAC permissions updated successfully"
else
    echo "❌ RBAC seeding may have failed"
fi

echo ""
echo "🎉 Upgrade Complete\!"
echo ""
echo "🌐 Services:"
echo "   Web Interface: http://localhost:3000"
echo "   API Server: http://localhost:5005"
echo ""
echo "📋 What's New:"
echo "   ✅ Asset Management (create, update, assign assets)"
echo "   ✅ Asset Assignment with reassignment support"
echo "   ✅ User icons for available (green +) and assigned (blue user) assets"
echo "   ✅ Role permissions for asset operations"
echo "   ✅ Asset import/export capabilities"
echo ""
echo "💾 Backup Location: $BACKUP_FILE"
echo ""
echo "🧪 Test the upgrade:"
echo "   1. Login to http://localhost:3000"
echo "   2. Navigate to Assets section"
echo "   3. Create a test asset"
echo "   4. Assign it to a user"
echo "   5. Verify reassignment icon appears"
echo ""
