#!/bin/bash

echo "=== API Debug Script ==="
echo ""

echo "1. Checking if API container is running:"
docker ps | grep api || echo "❌ API container not running"

echo ""
echo "2. API container logs (last 20 lines):"
docker logs configmaster-api --tail 20 2>&1 || echo "❌ Cannot get API logs"

echo ""
echo "3. Testing API health endpoint:"
curl -s http://localhost:5005/health 2>&1 || echo "❌ API not responding"

echo ""
echo "4. Testing direct connection to API port:"
nc -zv localhost 5005 2>&1 || echo "❌ Port 5005 not accessible"

echo ""
echo "5. Environment variables in API container:"
docker exec configmaster-api env 2>&1 | grep -E "(NODE_ENV|FRONTEND_URL|ALLOW_SELF_HOSTED)" || echo "❌ Cannot check env vars"

echo ""
echo "6. Files in API dist directory:"
docker exec configmaster-api ls -la /app/apps/api/dist/ 2>&1 | head -10 || echo "❌ Cannot check dist files"

echo ""
echo "7. API process in container:"
docker exec configmaster-api ps aux 2>&1 || echo "❌ Cannot check processes"