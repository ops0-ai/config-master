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

print_status "🚀 ConfigMaster Simple Deployment Starting..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Install dependencies for each package individually
print_status "📦 Installing dependencies..."

# Install root dependencies
print_status "Installing root dependencies..."
npm install --ignore-scripts

# Install and build database package
print_status "Setting up database package..."
cd packages/database
npm install
npm run build
cd ../..

# Install and build ansible-engine package  
print_status "Setting up ansible-engine package..."
cd packages/ansible-engine
npm install
npm run build
cd ../..

# Install and build API
print_status "Setting up API..."
cd apps/api
npm install
npm run build
cd ../..

# Install and build web
print_status "Setting up web app..."
cd apps/web
npm install
npm run build
cd ../..

# Setup database
print_status "🗄️ Setting up database..."
cd apps/api

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    print_status "📝 Creating .env file..."
    cat > .env << 'ENVEOF'
DATABASE_URL=postgresql://postgres:password123@localhost:5432/config_management
JWT_SECRET=super-secret-jwt-key-for-production-change-this-immediately
ENCRYPTION_KEY=32-char-encryption-key-change-this
MASTER_ENCRYPTION_KEY=master-encryption-key-change-this-too
PORT=5005
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
PEM_KEYS_DIR=./secure/pem-keys
ENVEOF
    print_success "Created .env file with defaults"
else
    print_success ".env file already exists"
fi

# Start database if not running
if ! docker ps | grep -q postgres-dev; then
    print_status "🐘 Starting PostgreSQL..."
    docker run -d \
        --name postgres-dev \
        --restart unless-stopped \
        -e POSTGRES_DB=config_management \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=password123 \
        -p 5432:5432 \
        postgres:15-alpine
    
    # Wait for database to be ready
    print_status "⏳ Waiting for database to be ready..."
    sleep 10
    
    max_attempts=30
    attempt=0
    while ! PGPASSWORD=password123 psql -h localhost -U postgres -d config_management -c "SELECT 1;" > /dev/null 2>&1; do
        if [ $attempt -ge $max_attempts ]; then
            print_error "Database failed to start after $max_attempts attempts"
            exit 1
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    echo ""
    print_success "Database is ready"
else
    print_success "PostgreSQL is already running"
fi

# Run migrations
print_status "🏗️ Running database migrations..."
npm run db:push

# Create secure directory
mkdir -p secure/pem-keys

print_status "================================================"
print_success "🎉 Deployment Complete!"
print_status "================================================"
echo ""
echo "🌐 Web Interface: http://localhost:3000"
echo "🔌 API Endpoint: http://localhost:5005/api"
echo ""
echo "📋 Default Admin Credentials (auto-created on startup):"
echo "  📧 Email: admin@configmaster.dev"
echo "  🔑 Password: admin123"
echo ""
echo "🚀 To start the services:"
echo "  ./start.sh"
echo ""
echo "Or manually:"
echo "  Terminal 1: cd apps/api && npm run dev"
echo "  Terminal 2: cd apps/web && npm run dev"
echo ""
print_warning "⚠️  IMPORTANT: Change default passwords in production!"
print_warning "⚠️  Update JWT_SECRET and encryption keys in .env for production!"