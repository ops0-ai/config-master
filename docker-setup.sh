#!/bin/bash

# ConfigMaster Docker Setup Script
# This script sets up the ConfigMaster platform using Docker Compose

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

print_status "================================================"
print_status "🚀 ConfigMaster Docker Setup"
print_status "================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

print_success "✅ Docker and Docker Compose are installed"

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning "⚠️ No .env file found. Creating from template..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_success "✅ Created .env file from template"
        print_warning "📝 Please edit .env file to configure your settings"
    else
        print_error "❌ .env.example not found. Cannot create .env file."
        exit 1
    fi
fi

# Create necessary directories
print_status "📁 Creating necessary directories..."
mkdir -p uploads logs secure/pem-keys
print_success "✅ Directories created"

# Stop and remove existing containers
print_status "🛑 Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Pull latest images
print_status "📥 Pulling latest base images..."
docker-compose pull database redis

# Build and start services
print_status "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for database to be ready
print_status "⏳ Waiting for database to be ready..."
timeout=60
counter=0
while ! docker-compose exec -T database pg_isready -U postgres -d config_management > /dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        print_error "❌ Database failed to start within $timeout seconds"
        exit 1
    fi
    echo -n "."
    sleep 1
    counter=$((counter + 1))
done
echo ""
print_success "✅ Database is ready"

# Run database migrations
print_status "🗃️ Running database migrations..."
if docker-compose exec -T api npm run db:push > /dev/null 2>&1; then
    print_success "✅ Database migrations completed"
else
    print_warning "⚠️ Database migrations may have failed. Check logs if needed."
fi

# Seed initial data
print_status "🌱 Seeding initial data..."
if docker-compose exec -T api npm run db:seed > /dev/null 2>&1; then
    print_success "✅ Database seeded with initial data"
else
    print_warning "⚠️ Database seeding may have failed. You can create users manually."
fi

# Check service health
print_status "🔍 Checking service health..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_success "✅ Services are running"
else
    print_error "❌ Some services failed to start"
    docker-compose logs --tail=20
    exit 1
fi

print_status "================================================"
print_success "🎉 ConfigMaster Setup Complete!"
print_status "================================================"
echo ""
echo "🌐 Web Interface: http://localhost:3000"
echo "🔌 API Endpoint: http://localhost:5005/api"
echo "🗄️ Database: localhost:5432 (postgres/password123)"
echo "💾 Redis: localhost:6379"
echo ""
echo "📋 Useful Commands:"
echo "  • View logs:        docker-compose logs -f"
echo "  • Stop services:    docker-compose down"
echo "  • Restart:          docker-compose restart"
echo "  • Update images:    docker-compose pull && docker-compose up -d"
echo ""
echo "📖 Default admin user:"
echo "  • Email: admin@configmaster.dev"
echo "  • Password: admin123"
echo ""
echo "🔧 MDM Agent Installation:"
echo "  curl -L \"http://localhost:5005/api/mdm/download/agent-installer\" | bash -s YOUR_ENROLLMENT_KEY"
echo ""
print_warning "⚠️ Remember to:"
print_warning "   1. Change default passwords in production"
print_warning "   2. Configure SSL/TLS certificates"
print_warning "   3. Set proper firewall rules"
print_warning "   4. Backup your data regularly"