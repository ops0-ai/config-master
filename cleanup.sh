#!/bin/bash

# Pulse Configuration Management - Complete Cleanup Script
# This script removes all containers, volumes, and MDM agents

set -e

echo "======================================"
echo "   Pulse Configuration Management"
echo "        Complete Cleanup Script"
echo "======================================"
echo ""

# Determine docker-compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "🧹 Starting complete cleanup..."
echo ""

# 1. Stop and remove MDM agents
echo "1️⃣ Removing MDM agents..."
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.configmaster.mdm.agent.plist 2>/dev/null || true

# Kill any running agent processes
pkill -f pulse-mdm-agent 2>/dev/null || true
pkill -f pulse-agent 2>/dev/null || true
pkill -f configmaster-mdm-agent 2>/dev/null || true

# Remove agent files
rm -f ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.pulse.mdm.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.configmaster.mdm.agent.plist 2>/dev/null || true

# Remove agent directories and files
rm -rf ~/.pulse-mdm 2>/dev/null || true
rm -rf ~/Library/Application\ Support/Pulse* 2>/dev/null || true
rm -rf ~/Library/Application\ Support/PulseMDM 2>/dev/null || true

# Remove agent logs
rm -f ~/Library/Logs/pulse-*.log 2>/dev/null || true
rm -f ~/Library/Logs/configmaster-*.log 2>/dev/null || true

echo "✅ MDM agents removed"

# 2. Stop Docker containers
echo ""
echo "2️⃣ Stopping Docker containers..."
$DOCKER_COMPOSE down 2>/dev/null || true
echo "✅ Containers stopped"

# 3. Remove Docker containers, images, and volumes
echo ""
echo "3️⃣ Removing Docker containers, images, and volumes..."
docker rm -f configmaster-api configmaster-web configmaster-db 2>/dev/null || true
docker rmi -f $(docker images | grep configmaster | awk '{print $3}') 2>/dev/null || true
docker volume rm -f config-management_postgres_data config-management_redis_data config-management_pem_keys config-management_ansible_temp 2>/dev/null || true
echo "✅ Docker resources removed"

# 4. Remove any temporary files
echo ""
echo "4️⃣ Cleaning temporary files..."
docker system prune -af --volumes 2>/dev/null || true
echo "✅ Temporary files cleaned"

# 5. Verify cleanup
echo ""
echo "5️⃣ Verifying cleanup..."

# Check for running containers
if docker ps | grep -q configmaster; then
    echo "⚠️  Some containers are still running"
    docker ps | grep configmaster
else
    echo "✅ No containers running"
fi

# Check for MDM agents
if launchctl list | grep -q -E "(pulse|configmaster)"; then
    echo "⚠️  Some agents are still loaded"
    launchctl list | grep -E "(pulse|configmaster)"
else
    echo "✅ No agents running"
fi

echo ""
echo "======================================"
echo "✅ Cleanup Complete!"
echo "======================================"
echo ""
echo "📋 What was removed:"
echo "   • All Docker containers and images"
echo "   • All Docker volumes and data"
echo "   • All MDM agents and configurations"
echo "   • All agent logs and temporary files"
echo ""
echo "🚀 Ready for fresh installation!"
echo "   Run: ./setup.sh"
echo ""