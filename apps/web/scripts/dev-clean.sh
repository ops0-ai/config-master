#!/bin/bash

echo "🧹 Cleaning Next.js development environment..."

# Kill existing Next.js processes
echo "📤 Stopping existing Next.js processes..."
pkill -f "next dev" || true

# Clean Next.js cache
echo "🗑️ Removing Next.js cache..."
rm -rf .next
rm -rf node_modules/.cache

# Clean npm cache if needed
echo "🔄 Cleaning npm cache..."
npm cache clean --force

# Reinstall dependencies if needed (optional)
if [ "$1" = "--reinstall" ]; then
    echo "📦 Reinstalling dependencies..."
    rm -rf node_modules
    npm install
fi

# Rebuild
echo "🔨 Building fresh..."
npm run build

# Start dev server
echo "🚀 Starting development server..."
npm run dev