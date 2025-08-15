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

print_status "🐳 ConfigMaster Docker Setup"
print_status "================================================"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif docker-compose --version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    print_error "Docker Compose is not installed."
    exit 1
fi

# Function to wait for service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=0
    
    print_status "⏳ Waiting for $service to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_success "$service is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo ""
    print_error "$service failed to start after $max_attempts attempts"
    return 1
}

# Parse arguments
FRESH_START=false
if [[ "$1" == "--fresh" ]] || [[ "$1" == "-f" ]]; then
    FRESH_START=true
fi

# Stop existing containers
print_status "🛑 Stopping any existing containers..."
$COMPOSE_CMD -f docker-compose.working.yml down

# Remove volumes if fresh start requested
if [ "$FRESH_START" = true ]; then
    print_warning "🗑️ Removing existing volumes for fresh start..."
    $COMPOSE_CMD -f docker-compose.working.yml down -v
fi

# Build images
print_status "🔨 Building Docker images (this may take a few minutes)..."
$COMPOSE_CMD -f docker-compose.working.yml build

# Start services
print_status "🚀 Starting services..."
$COMPOSE_CMD -f docker-compose.working.yml up -d

# Wait for database
wait_for_service "PostgreSQL" "http://localhost:5432" || {
    print_error "Database failed to start. Check logs:"
    echo "  $COMPOSE_CMD -f docker-compose.working.yml logs postgres"
    exit 1
}

# Wait for API
wait_for_service "API" "http://localhost:5005/health" || {
    print_error "API failed to start. Check logs:"
    echo "  $COMPOSE_CMD -f docker-compose.working.yml logs api"
    exit 1
}

# Wait for Web
wait_for_service "Web" "http://localhost:3000" || {
    print_error "Web app failed to start. Check logs:"
    echo "  $COMPOSE_CMD -f docker-compose.working.yml logs web"
    exit 1
}

# Show running containers
print_status "📊 Running containers:"
$COMPOSE_CMD -f docker-compose.working.yml ps

print_success "================================================"
print_success "🎉 ConfigMaster is ready!"
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
echo "📊 Useful Commands:"
echo "  View logs:        $COMPOSE_CMD -f docker-compose.working.yml logs -f"
echo "  View API logs:    $COMPOSE_CMD -f docker-compose.working.yml logs -f api"
echo "  View Web logs:    $COMPOSE_CMD -f docker-compose.working.yml logs -f web"
echo "  Stop services:    $COMPOSE_CMD -f docker-compose.working.yml down"
echo "  Fresh restart:    ./docker-start.sh --fresh"
echo ""
print_warning "⚠️  For production, update JWT_SECRET and encryption keys!"