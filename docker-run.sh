#!/bin/bash

set -e

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

print_status "🐳 Starting ConfigMaster with Docker Compose..."

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    if ! docker-compose --version &> /dev/null; then
        print_error "Docker Compose is not installed."
        exit 1
    fi
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# Stop any existing containers
print_status "🛑 Stopping existing containers..."
$COMPOSE_CMD -f docker-compose.simple.yml down

# Remove old volumes for fresh start (optional)
read -p "Do you want to remove existing data volumes for a fresh start? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "🗑️ Removing old volumes..."
    $COMPOSE_CMD -f docker-compose.simple.yml down -v
fi

# Build images
print_status "🔨 Building Docker images..."
$COMPOSE_CMD -f docker-compose.simple.yml build --no-cache

# Start services
print_status "🚀 Starting services..."
$COMPOSE_CMD -f docker-compose.simple.yml up -d

# Wait for database to be ready
print_status "⏳ Waiting for database to be ready..."
sleep 10

# Check if services are running
print_status "🔍 Checking service status..."
$COMPOSE_CMD -f docker-compose.simple.yml ps

# Show logs for debugging
print_status "📋 Recent API logs:"
$COMPOSE_CMD -f docker-compose.simple.yml logs --tail=20 api

print_success "================================================"
print_success "🎉 ConfigMaster is starting up!"
print_success "================================================"
echo ""
echo "🌐 Web Interface: http://localhost:3000"
echo "🔌 API Endpoint: http://localhost:5005/api"
echo "🏥 Health Check: http://localhost:5005/health"
echo ""
echo "📋 Default Admin Credentials:"
echo "  📧 Email: admin@configmaster.dev"
echo "  🔑 Password: admin123"
echo ""
echo "📊 View logs:"
echo "  $COMPOSE_CMD -f docker-compose.simple.yml logs -f"
echo ""
echo "🛑 Stop services:"
echo "  $COMPOSE_CMD -f docker-compose.simple.yml down"
echo ""
print_warning "⚠️  Services may take a minute to fully start. Check logs if you can't connect."