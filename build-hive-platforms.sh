#!/bin/bash

# Simple cross-platform build script for hive agent
set -e

echo "🚀 Building Hive Agent for multiple platforms..."

cd hive-agent

# Build for essential platforms
echo "Building Linux x86_64..."
GOOS=linux GOARCH=amd64 go build -o hive-agent-linux-amd64 .

echo "Building Linux ARM64..."
GOOS=linux GOARCH=arm64 go build -o hive-agent-linux-arm64 .

echo "Building Linux x86 (32-bit)..."
GOOS=linux GOARCH=386 go build -o hive-agent-linux-386 .

echo "Building Linux ARM (32-bit)..."
GOOS=linux GOARCH=arm GOARM=7 go build -o hive-agent-linux-arm .

echo "Building Windows x86_64..."
GOOS=windows GOARCH=amd64 go build -o hive-agent-windows-amd64.exe .

echo "Building macOS Intel..."
GOOS=darwin GOARCH=amd64 go build -o hive-agent-darwin-amd64 .

echo "Building macOS Apple Silicon..."
GOOS=darwin GOARCH=arm64 go build -o hive-agent-darwin-arm64 .

echo "Building FreeBSD x86_64..."
GOOS=freebsd GOARCH=amd64 go build -o hive-agent-freebsd-amd64 .

echo "Copying binaries to API public directory..."
cp hive-agent-* ../apps/api/public/

# Create a symlink to the default Linux binary
cd ../apps/api/public/
ln -sf hive-agent-linux-amd64 hive-agent-binary

echo "✅ All platforms built successfully!"
echo ""
echo "Available binaries:"
ls -la hive-agent-* | awk '{print "  " $9 " (" $5 ")"}'

echo ""
echo "Binaries are available in apps/api/public/ for distribution"