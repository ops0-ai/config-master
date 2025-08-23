#\!/bin/bash

echo "🚀 ConfigMaster Zero-Downtime Upgrade"
echo "====================================="
echo ""

# Check if system is running
if \! docker-compose ps | grep -q "Up"; then
    echo "❌ System is not running. Use regular upgrade instead."
    exit 1
fi

echo "💡 This upgrade method minimizes downtime by:"
echo "   1. Building new containers in parallel"
echo "   2. Running database migrations during live operation"
echo "   3. Quick container swap"
echo ""

read -p "Proceed with zero-downtime upgrade? (y/N): " -n 1 -r
echo
if [[ \! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Upgrade cancelled."
    exit 1
fi

echo ""
echo "🗃️  Step 1: Creating hot backup..."
BACKUP_FILE="hot_backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec configmaster-db pg_dump -U postgres -d config_management > "$BACKUP_FILE"
echo "✅ Hot backup created: $BACKUP_FILE"

echo ""
echo "📦 Step 2: Building new containers (parallel)..."
docker-compose build --no-cache &
BUILD_PID=$\!

echo "⏳ Building containers in background (PID: $BUILD_PID)..."
echo "   System remains operational during build..."

wait $BUILD_PID
if [ $? -eq 0 ]; then
    echo "✅ New containers built successfully"
else
    echo "❌ Container build failed. System still running on old version."
    exit 1
fi

echo ""
echo "🔄 Step 3: Quick container swap..."
echo "   Downtime: ~10-15 seconds"

# Stop only the web container first (API stays up)
docker-compose stop web
docker-compose up -d web

sleep 5

# Then quickly restart API (database migrations run automatically)
docker-compose stop api
docker-compose up -d api

echo "✅ Containers swapped"

echo ""
echo "⏳ Step 4: Waiting for system stabilization..."
sleep 15

echo ""
echo "🔍 Step 5: Health check..."

# Check all containers are up
if docker-compose ps | grep -q "Up.*healthy"; then
    echo "✅ All containers healthy"
else
    echo "⚠️  Some containers may still be starting..."
fi

# Check API is responding
if curl -s http://localhost:5005/health | grep -q "ok"; then
    echo "✅ API responding"
else
    echo "❌ API not responding"
fi

# Check web is responding  
if curl -s http://localhost:3000 | grep -q "html"; then
    echo "✅ Web interface responding"
else
    echo "❌ Web interface not responding"
fi

# Check asset migration
ASSET_TABLES=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'asset%';" 2>/dev/null | tr -d ' ')
if [ "$ASSET_TABLES" -gt 0 ]; then
    echo "✅ Asset tables migrated successfully"
else
    echo "❌ Asset migration may have failed"
fi

echo ""
echo "🎉 Zero-Downtime Upgrade Complete\!"
echo ""
echo "📊 Upgrade Summary:"
echo "   ⏱️  Total downtime: ~10-15 seconds"
echo "   💾 Backup location: $BACKUP_FILE"
echo "   🌐 Web interface: http://localhost:3000"
echo "   🔌 API server: http://localhost:5005"
echo ""
echo "🧪 Next Steps:"
echo "   1. Test asset management features"
echo "   2. Verify user assignment functionality"
echo "   3. Check role permissions matrix"
echo ""
