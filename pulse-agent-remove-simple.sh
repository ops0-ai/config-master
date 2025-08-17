#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗑️  Pulse MDM Agent Simple Uninstaller${NC}"
echo "========================================="

# Ask for confirmation
read -p "Are you sure you want to uninstall the Pulse MDM agent? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Uninstall cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🛠️  Starting uninstall process...${NC}"

# Stop processes
echo -e "${YELLOW}⏹️  Step 1: Stopping processes...${NC}"
pkill -f pulse 2>/dev/null || true
pkill -f pulse-mdm-agent 2>/dev/null || true

# Remove LaunchAgent
echo -e "${YELLOW}🔌 Step 2: Removing LaunchAgent...${NC}"
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true

# Remove directories with sudo if needed
echo -e "${YELLOW}📁 Step 3: Removing directories...${NC}"
sudo rm -rf "$HOME/Library/Application Support/Pulse" 2>/dev/null || true
rm -rf ~/.pulse-mdm 2>/dev/null || true
rm -f /tmp/pulse-mdm* 2>/dev/null || true

# Final cleanup
echo -e "${YELLOW}🔄 Step 4: Final cleanup...${NC}"
pkill -f pulse 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 Pulse MDM Agent uninstalled!${NC}"
echo ""
echo -e "${BLUE}📖 The device may still appear in the MDM console until manually removed.${NC}"