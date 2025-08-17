#!/bin/bash

# Pulse Configuration Management - Complete Cleanup Script
# This script removes EVERYTHING - containers, images, volumes, networks, files, and MDM agents

set -e

echo "======================================"
echo "   Pulse Configuration Management"
echo "      COMPLETE WIPE CLEANUP SCRIPT"
echo "======================================"
echo ""
echo "⚠️  WARNING: This will permanently remove:"
echo "   • All Docker containers, images, and volumes"
echo "   • All database data and configurations"
echo "   • All MDM agents and device enrollments"
echo "   • All uploaded files and logs"
echo "   • All build caches and temporary data"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo ""
echo "🧹 Starting COMPLETE cleanup..."
echo ""

# Determine docker-compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# 1. Stop and remove ALL MDM agents (comprehensive)
echo "1️⃣ Removing ALL MDM agents and configurations..."

# Unload all possible LaunchAgent configurations
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.configmaster.mdm.agent.plist 2>/dev/null || true
sudo launchctl unload /Library/LaunchDaemons/com.pulse.mdm.agent.plist 2>/dev/null || true
sudo launchctl unload /Library/LaunchDaemons/com.configmaster.mdm.agent.plist 2>/dev/null || true

# Kill ALL agent processes
pkill -f pulse-mdm-agent 2>/dev/null || true
pkill -f pulse-agent 2>/dev/null || true
pkill -f configmaster-mdm-agent 2>/dev/null || true
pkill -f mdm-agent 2>/dev/null || true

# Remove ALL agent files and directories
rm -f ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.pulse.mdm.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.configmaster.mdm.agent.plist 2>/dev/null || true
sudo rm -f /Library/LaunchDaemons/com.pulse.mdm.agent.plist 2>/dev/null || true
sudo rm -f /Library/LaunchDaemons/com.configmaster.mdm.agent.plist 2>/dev/null || true

# Remove ALL agent data directories
rm -rf ~/.pulse-mdm 2>/dev/null || true
rm -rf ~/.configmaster-mdm 2>/dev/null || true
rm -rf ~/Library/Application\ Support/Pulse* 2>/dev/null || true
rm -rf ~/Library/Application\ Support/PulseMDM 2>/dev/null || true
rm -rf ~/Library/Application\ Support/ConfigMaster* 2>/dev/null || true
rm -rf ~/Library/Preferences/com.pulse.mdm* 2>/dev/null || true
rm -rf ~/Library/Preferences/com.configmaster.mdm* 2>/dev/null || true

# Remove ALL agent logs and cache
rm -f ~/Library/Logs/pulse-*.log 2>/dev/null || true
rm -f ~/Library/Logs/configmaster-*.log 2>/dev/null || true
rm -rf ~/Library/Caches/com.pulse.mdm* 2>/dev/null || true
rm -rf ~/Library/Caches/com.configmaster.mdm* 2>/dev/null || true

echo "✅ ALL MDM agents and configurations removed"

# 2. Force stop and remove ALL Docker containers
echo ""
echo "2️⃣ Force stopping ALL Docker containers..."
$DOCKER_COMPOSE down --volumes --remove-orphans 2>/dev/null || true
docker stop $(docker ps -q) 2>/dev/null || true
docker rm -f $(docker ps -aq) 2>/dev/null || true
echo "✅ ALL containers stopped and removed"

# 3. Remove ALL Docker images, volumes, and networks
echo ""
echo "3️⃣ Removing ALL Docker resources..."

# Remove all config-management related containers
docker rm -f configmaster-api configmaster-web configmaster-db config-management-redis-1 2>/dev/null || true

# Remove all config-management related images
docker rmi -f $(docker images | grep -E "(config-management|configmaster)" | awk '{print $3}') 2>/dev/null || true

# Remove all config-management related volumes
docker volume rm -f config-management_postgres_data config-management_redis_data config-management_pem_keys config-management_ansible_temp 2>/dev/null || true

# Remove all config-management related networks
docker network rm $(docker network ls | grep config-management | awk '{print $1}') 2>/dev/null || true

echo "✅ ALL Docker resources removed"

# 4. Clean ALL Docker system data
echo ""
echo "4️⃣ Cleaning ALL Docker system data..."
docker system prune -af --volumes 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
echo "✅ ALL Docker system data cleaned"

# 5. Remove ALL local files and directories
echo ""
echo "5️⃣ Cleaning ALL local files and data..."

# Remove uploads, logs, and temp files
rm -rf ./uploads 2>/dev/null || true
rm -rf ./logs 2>/dev/null || true
rm -rf ./temp 2>/dev/null || true
rm -rf ./.env.local 2>/dev/null || true

# Remove node_modules and build files
rm -rf ./node_modules 2>/dev/null || true
rm -rf ./apps/*/node_modules 2>/dev/null || true
rm -rf ./packages/*/node_modules 2>/dev/null || true
rm -rf ./apps/*/.next 2>/dev/null || true
rm -rf ./apps/*/dist 2>/dev/null || true
rm -rf ./packages/*/dist 2>/dev/null || true

# Remove MDM agent installation files
rm -f ./pulse-agent-install.sh 2>/dev/null || true
rm -f ./pulse-agent-remove.sh 2>/dev/null || true
rm -f ./pulse-install.sh 2>/dev/null || true
rm -rf ./mdm-agent 2>/dev/null || true

# Remove any generated certificates or keys
rm -rf ./certs 2>/dev/null || true
rm -rf ./keys 2>/dev/null || true

echo "✅ ALL local files and data cleaned"

# 6. Verify complete cleanup
echo ""
echo "6️⃣ Verifying COMPLETE cleanup..."

# Check for running containers
if docker ps -a | grep -q -E "(config-management|configmaster)"; then
    echo "⚠️  Some containers still exist:"
    docker ps -a | grep -E "(config-management|configmaster)"
else
    echo "✅ No containers exist"
fi

# Check for remaining images
if docker images | grep -q -E "(config-management|configmaster)"; then
    echo "⚠️  Some images still exist:"
    docker images | grep -E "(config-management|configmaster)"
else
    echo "✅ No images exist"
fi

# Check for remaining volumes
if docker volume ls | grep -q config-management; then
    echo "⚠️  Some volumes still exist:"
    docker volume ls | grep config-management
else
    echo "✅ No volumes exist"
fi

# Check for MDM agents
if launchctl list | grep -q -E "(pulse|configmaster)"; then
    echo "⚠️  Some agents are still loaded:"
    launchctl list | grep -E "(pulse|configmaster)"
else
    echo "✅ No agents running"
fi

# Check for remaining files
remaining_files=0
if [ -d "./uploads" ] || [ -d "./logs" ] || [ -d "./node_modules" ]; then
    echo "⚠️  Some local files still exist"
    remaining_files=1
fi

if [ -f "./pulse-agent-install.sh" ] || [ -f "./pulse-install.sh" ]; then
    echo "⚠️  Some MDM files still exist"
    remaining_files=1
fi

if [ $remaining_files -eq 0 ]; then
    echo "✅ All local files cleaned"
fi

echo ""
echo "======================================"
echo "✅ COMPLETE WIPE FINISHED!"
echo "======================================"
echo ""
echo "🗑️  EVERYTHING REMOVED:"
echo "   • ALL Docker containers, images, and volumes"
echo "   • ALL database data and configurations"
echo "   • ALL MDM agents and device enrollments"
echo "   • ALL uploaded files, logs, and build cache"
echo "   • ALL node_modules and compiled files"
echo "   • ALL temporary and generated files"
echo ""
echo "🚀 System is now COMPLETELY CLEAN!"
echo "   Ready for fresh installation: ./setup.sh"
echo ""
echo "⚠️  Note: You'll need to reconfigure:"
echo "   • Environment variables (.env)"
echo "   • Any custom configurations"
echo "   • MDM device re-enrollment"
echo ""