#!/bin/bash

# Quick fix script for frontend using wrong IP
# Run this on your server to fix the frontend API URL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Frontend IP Fix Script ===${NC}"
echo ""

# Detect server IP
echo "Detecting server IP..."
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "")
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

if [ ! -z "$EXTERNAL_IP" ]; then
    SERVER_IP="$EXTERNAL_IP"
    echo -e "${GREEN}✓ Detected external IP: $SERVER_IP${NC}"
elif [ ! -z "$LOCAL_IP" ]; then
    SERVER_IP="$LOCAL_IP"
    echo -e "${YELLOW}⚠ Using local IP (no external IP detected): $SERVER_IP${NC}"
else
    echo -e "${RED}Could not detect IP. Please enter your server's IP address:${NC}"
    read SERVER_IP
fi

# Update web .env file
echo ""
echo "Updating frontend configuration..."
mkdir -p apps/web

cat > apps/web/.env << EOF
# Web Application Environment Variables
# Fixed by fix-frontend-ip.sh

# API URL - Uses your server IP
NEXT_PUBLIC_API_URL=http://$SERVER_IP:5005/api

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1
EOF

echo -e "${GREEN}✓ Updated apps/web/.env with API URL: http://$SERVER_IP:5005/api${NC}"

# Rebuild web container
echo ""
echo -e "${YELLOW}Rebuilding web container (this will take a few minutes)...${NC}"
docker-compose down
docker-compose build --no-cache web
docker-compose up -d

echo ""
echo -e "${GREEN}=== Fix Complete! ===${NC}"
echo ""
echo "Your application should now be accessible at:"
echo -e "${BLUE}  Frontend: http://$SERVER_IP:3000${NC}"
echo -e "${BLUE}  API: http://$SERVER_IP:5005/api${NC}"
echo ""
echo "Default login credentials:"
echo "  Email: admin@pulse.dev"
echo "  Password: password123"
echo ""
echo -e "${YELLOW}Note: If you still see CORS errors, clear your browser cache and try again.${NC}"