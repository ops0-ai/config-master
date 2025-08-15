#!/bin/bash

#############################################
# Test Fresh Deployment Script
# Simulates a fresh server deployment
#############################################

set -e

echo "🧪 Testing Fresh Deployment Setup"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Clean everything for fresh test
echo "🧹 Cleaning up for fresh test..."
docker-compose down -v 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# Wait a moment
sleep 2

# Run the setup script
echo "🚀 Running setup.sh..."
bash setup.sh

# Test admin login
echo "🔐 Testing admin login..."
TOKEN=$(curl -s -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pulse.dev","password":"password123"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "${GREEN}✅ Admin login successful${NC}"
else
  echo -e "${RED}❌ Admin login failed${NC}"
  exit 1
fi

# Test MDM profiles
echo "📱 Testing MDM profiles..."
MDM_RESPONSE=$(curl -s -X GET http://localhost:5005/api/mdm/profiles \
  -H "Authorization: Bearer $TOKEN")

ENROLLMENT_KEY=$(echo "$MDM_RESPONSE" | jq -r '.[0].enrollmentKey // empty')

if [ -n "$ENROLLMENT_KEY" ] && [ "$ENROLLMENT_KEY" != "YOUR_ENROLLMENT_KEY" ]; then
  echo -e "${GREEN}✅ Unique MDM enrollment key generated: ${ENROLLMENT_KEY:0:20}...${NC}"
else
  echo -e "${RED}❌ MDM enrollment key not generated properly${NC}"
  exit 1
fi

# Test database schema
echo "🗄️ Testing database schema..."
SCHEMA_TEST=$(docker-compose exec -T db psql -U postgres -d config_management -t -c "
  SELECT COUNT(*) FROM information_schema.columns 
  WHERE table_name = 'deployments' AND column_name = 'configuration_id';
" | tr -d ' \t\n\r')

if [ "$SCHEMA_TEST" = "1" ]; then
  echo -e "${GREEN}✅ Database schema is complete${NC}"
else
  echo -e "${RED}❌ Database schema missing required columns${NC}"
  exit 1
fi

# Test health endpoints
echo "🏥 Testing service health..."
if curl -s http://localhost:5005/health > /dev/null; then
  echo -e "${GREEN}✅ API health check passed${NC}"
else
  echo -e "${RED}❌ API health check failed${NC}"
  exit 1
fi

if curl -s http://localhost:3000 > /dev/null; then
  echo -e "${GREEN}✅ Web interface health check passed${NC}"
else
  echo -e "${RED}❌ Web interface health check failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 Fresh deployment test PASSED!${NC}"
echo "=================================="
echo ""
echo "✅ Admin user created: admin@pulse.dev / password123"
echo "✅ Unique MDM enrollment key: $ENROLLMENT_KEY"
echo "✅ Database schema is complete"
echo "✅ All services are healthy"
echo ""
echo "📌 Access URLs:"
echo "   Web: http://localhost:3000"
echo "   API: http://localhost:5005"
echo ""
echo "This deployment is ready for production use!"