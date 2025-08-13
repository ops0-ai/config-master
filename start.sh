#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_status "🚀 Starting ConfigMaster..."

# Check if database is running
if ! docker ps | grep -q postgres-dev; then
    print_error "PostgreSQL is not running. Please run './deploy.sh' first."
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    print_status "🛑 Stopping services..."
    if [ ! -z "$API_PID" ]; then
        kill $API_PID 2>/dev/null || true
    fi
    if [ ! -z "$WEB_PID" ]; then
        kill $WEB_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# Change to project directory
cd "$(dirname "$0")"

# Start API in background
print_status "🔌 Starting API server..."
cd apps/api
npm run dev > ../../api.log 2>&1 &
API_PID=$!
cd ../..

# Wait a moment for API to start
sleep 3

# Start Web in background
print_status "🌐 Starting web server..."
cd apps/web
npm run dev > ../../web.log 2>&1 &
WEB_PID=$!
cd ..

# Wait a moment for web to start
sleep 5

print_status "================================================"
print_success "✅ ConfigMaster is now running!"
print_status "================================================"
echo ""
echo "🌐 Web Interface: http://localhost:3000"
echo "🔌 API Endpoint: http://localhost:5005/api"
echo "📊 Health Check: http://localhost:5005/health"
echo ""
echo "📋 Default Admin Credentials:"
echo "  📧 Email: admin@configmaster.dev"
echo "  🔑 Password: admin123"
echo ""
echo "📱 MDM Agent Installation:"
echo "  curl -L \"http://localhost:5005/api/mdm/download/agent-installer\" | bash -s YOUR_ENROLLMENT_KEY"
echo ""
echo "📝 Logs:"
echo "  API: tail -f api.log"
echo "  Web: tail -f web.log"
echo ""
print_warning "🛑 Press Ctrl+C to stop all services"
echo ""

# Check if services are responding
print_status "🔍 Checking service health..."
sleep 5

# Check API health
if curl -s http://localhost:5005/health > /dev/null 2>&1; then
    print_success "✅ API is responding"
else
    print_warning "⚠️  API may still be starting up..."
fi

# Check Web
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    print_success "✅ Web is responding"
else
    print_warning "⚠️  Web may still be starting up..."
fi

echo ""
print_status "🚀 Ready! Visit http://localhost:3000 to get started"

# Wait for processes
wait $API_PID $WEB_PID