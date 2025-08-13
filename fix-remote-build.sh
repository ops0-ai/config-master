#!/bin/bash

# Fix for remote server build issues
# Run this on the remote Ubuntu server

set -e

echo "🔧 Fixing build issues on remote server..."

# Remove the problematic old MDM component if it exists
if [ -f "apps/web/components/MDMManagement-old.tsx" ]; then
    echo "Removing MDMManagement-old.tsx..."
    rm apps/web/components/MDMManagement-old.tsx
fi

# Fix the deploy script path issue
if [ -f "apps/api/deploy.sh" ]; then
    echo "Moving deploy.sh to root..."
    mv apps/api/deploy.sh ./deploy.sh
    chmod +x deploy.sh
fi

# Ensure we're in the correct directory structure
if [ ! -d "apps/api" ]; then
    echo "❌ Error: Not in the correct directory. Please run from the project root."
    exit 1
fi

echo "✅ Build issues fixed!"
echo ""
echo "Now run: ./deploy.sh"