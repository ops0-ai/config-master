#!/bin/bash

# Fix script for remote server login issues
# Run this on the remote Ubuntu server

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

print_status "🔧 Fixing login issues on remote server..."

# Check if we're in the correct directory
if [ ! -d "apps/api" ]; then
    print_error "Not in the correct directory. Please run from the project root."
    exit 1
fi

# Install pip3 if missing (for Ansible)
if ! command -v pip3 &> /dev/null; then
    print_status "📦 Installing pip3..."
    sudo apt update
    sudo apt install -y python3-pip
fi

# Install Ansible (optional but recommended)
if ! command -v ansible &> /dev/null; then
    print_status "📦 Installing Ansible..."
    pip3 install --user ansible || sudo apt install -y ansible
fi

# Reset the admin user
print_status "🔄 Resetting admin user..."
cd apps/api

# Check if reset-admin.ts exists
if [ ! -f "src/reset-admin.ts" ]; then
    print_error "reset-admin.ts not found. Please ensure you have the latest code."
    exit 1
fi

# Run the reset script
npx ts-node src/reset-admin.ts

print_success "✅ Admin user reset complete!"
print_status "================================================"
echo ""
echo "📋 Login Credentials:"
echo "  📧 Email: admin@configmaster.dev"
echo "  🔑 Password: admin123"
echo ""
echo "🌐 Access the app at: http://localhost:3000"
echo ""
print_status "If the app is not running, start it with:"
echo "  Terminal 1: cd apps/api && npm run dev"
echo "  Terminal 2: cd apps/web && npm run dev"