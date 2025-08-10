#!/bin/bash

echo "🔍 ConfigMaster Platform Verification"
echo "===================================="

# Test API Server
echo "📡 Testing API Server (Port 5005)..."
API_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/api_response http://localhost:5005/health)
if [ "$API_RESPONSE" = "200" ]; then
    echo "✅ API Server is running at http://localhost:5005"
    echo "   Response: $(cat /tmp/api_response)"
else
    echo "❌ API Server not responding (HTTP $API_RESPONSE)"
fi

echo ""

# Test Web Frontend
echo "🌐 Testing Web Frontend (Port 3001)..."
WEB_RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/web_response http://localhost:3001)
if [ "$WEB_RESPONSE" = "200" ]; then
    echo "✅ Web Frontend is running at http://localhost:3001"
    echo "   Title: $(grep -o '<title[^>]*>[^<]*</title>' /tmp/web_response | sed 's/<[^>]*>//g')"
else
    echo "❌ Web Frontend not responding (HTTP $WEB_RESPONSE)"
fi

echo ""

# Check running processes
echo "🔧 Running Services:"
lsof -i :5005 -i :3001 2>/dev/null | grep LISTEN | while read line; do
    port=$(echo $line | awk '{print $9}' | cut -d':' -f2)
    echo "   - Port $port: $(echo $line | awk '{print $1}')"
done

echo ""
echo "🚀 Access Your Platform:"
echo "   • Web Interface: http://localhost:3001"
echo "   • API Server: http://localhost:5005" 
echo "   • API Health: http://localhost:5005/health"
echo ""
echo "✨ ConfigMaster is ready for enterprise configuration management!"

# Cleanup temp files
rm -f /tmp/api_response /tmp/web_response 2>/dev/null