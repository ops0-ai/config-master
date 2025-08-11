#!/bin/bash

echo "🚀 Starting Pulse Platform..."
echo "================================="

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL is not running. Please start PostgreSQL first."
    echo "   You can start it with: brew services start postgresql (on macOS)"
    echo "   Or: sudo systemctl start postgresql (on Linux)"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Create database if it doesn't exist
createdb config_management 2>/dev/null || echo "ℹ️  Database already exists"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the backend API
echo ""
echo "🔧 Starting API server on port 5005..."
cd apps/api
npm run dev &
API_PID=$!

# Wait for API to start
sleep 5

# Start the frontend
echo ""
echo "🎨 Starting web frontend on port 3000..."
cd ../web
npm run dev &
WEB_PID=$!

echo ""
echo "================================="
echo "✅ Pulse is starting up!"
echo ""
echo "📍 API Server: http://localhost:5005"
echo "📍 Web Interface: http://localhost:3000"
echo "📍 Health Check: http://localhost:5005/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================="

# Wait for interrupt
trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT
wait