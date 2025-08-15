#!/bin/bash

echo "🔍 Checking Database Isolation"
echo "================================"

# Check local database
echo -e "\n📍 LOCAL Installation Check:"
echo "----------------------------"

# Get local container info
LOCAL_DB=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT id, name FROM organizations LIMIT 1;" 2>/dev/null)
LOCAL_MDM=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM mdm_profiles;" 2>/dev/null)
LOCAL_DEVICES=$(docker exec configmaster-db psql -U postgres -d config_management -t -c "SELECT COUNT(*) FROM mdm_devices;" 2>/dev/null)

echo "Local Organization: $LOCAL_DB"
echo "Local MDM Profiles: $LOCAL_MDM"
echo "Local MDM Devices: $LOCAL_DEVICES"

# Check if ports are exposed
echo -e "\n⚠️  Port Exposure Check:"
echo "------------------------"
echo "Checking if database/redis ports are publicly accessible..."

# Check PostgreSQL port
if netstat -an | grep -q "0.0.0.0:5432"; then
    echo "❌ CRITICAL: PostgreSQL port 5432 is exposed to 0.0.0.0 (public internet)!"
else
    echo "✅ PostgreSQL port is not publicly exposed"
fi

# Check Redis port
if netstat -an | grep -q "0.0.0.0:6379"; then
    echo "❌ CRITICAL: Redis port 6379 is exposed to 0.0.0.0 (public internet)!"
else
    echo "✅ Redis port is not publicly exposed"
fi

# Check if remote can connect to local
echo -e "\n🌐 Remote Connection Test:"
echo "--------------------------"
PUBLIC_IP=$(curl -s ifconfig.me)
echo "Your public IP: $PUBLIC_IP"

# Try to connect to local PostgreSQL from "outside"
timeout 2 nc -zv localhost 5432 2>&1 | grep -q succeeded
if [ $? -eq 0 ]; then
    echo "⚠️  PostgreSQL is accessible on localhost:5432"
else
    echo "✅ PostgreSQL is not accessible from outside"
fi

echo -e "\n📋 Recommendations:"
echo "-------------------"
echo "1. NEVER expose database ports (5432, 6379) to the public internet"
echo "2. Each installation should have its own isolated database"
echo "3. Use environment variables to configure connections"
echo "4. On remote servers, ensure DB_HOST=database (not an external IP)"

echo -e "\n🔧 To fix the issue:"
echo "-------------------"
echo "1. On your LOCAL machine:"
echo "   - Run: docker-compose down"
echo "   - Run: docker-compose up -d"
echo ""
echo "2. On your REMOTE server:"
echo "   - Ensure .env has DB_HOST=database"
echo "   - Run: docker-compose down -v"
echo "   - Run: ./setup.sh --fresh"
echo ""
echo "3. Verify isolation by creating different data on each"