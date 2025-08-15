#!/bin/bash

# Fix Remote Server API Configuration
# Run this script ON YOUR REMOTE SERVER (3.108.197.149)

set -e

echo "🔧 Fixing Remote Server API Configuration"
echo "========================================="

# Get the server IP
SERVER_IP="3.108.197.149"

echo "📍 Server IP: $SERVER_IP"

# Stop containers
echo "🛑 Stopping containers..."
docker-compose down

# Update the web .env file
echo "⚙️ Updating frontend API URL..."
cat > apps/web/.env << EOF
# Web Application Environment Variables
# Fixed for remote server deployment

# API URL - Uses server IP for browser access
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5005/api

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1
EOF

echo "✅ Updated apps/web/.env to use $SERVER_IP"

# Rebuild and restart
echo "🔨 Rebuilding containers..."
docker-compose build web

echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "✅ Remote server fixed!"
echo "🌐 Your platform should now be accessible at: http://$SERVER_IP:3000"
echo "🔗 API calls will now go to: http://$SERVER_IP:5005/api"
echo ""
echo "🧪 Test by:"
echo "1. Visit http://$SERVER_IP:3000"
echo "2. Login and create some data"
echo "3. Verify it doesn't appear on your local installation"