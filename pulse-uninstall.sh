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

# Step 3: Notify server of uninstall (before removing files)
echo -e "${YELLOW}📡 Step 3: Notifying server...${NC}"
DEVICE_ID=""

# Try to find device ID from various locations
for location in "$HOME/.pulse-mdm/device_id" "$HOME/Library/Application Support/Pulse/device_id"; do
    if [ -f "$location" ]; then
        DEVICE_ID=$(cat "$location" 2>/dev/null)
        if [ -n "$DEVICE_ID" ]; then
            echo "  Found device ID: $DEVICE_ID"
            break
        fi
    fi
done

# Also try to get device ID from system info (macOS)
if [ -z "$DEVICE_ID" ] && command -v ioreg &> /dev/null; then
    DEVICE_ID=$(ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/{gsub(/"/,"");print $3}' 2>/dev/null)
fi

if [ -n "$DEVICE_ID" ]; then
    echo "  Using device ID: $DEVICE_ID"
    echo "  Sending uninstall notification..."
    # Try to notify server that agent is being uninstalled
    curl -X POST "http://localhost:5005/api/mdm/devices/$DEVICE_ID/uninstall" \
         -H "Content-Type: application/json" \
         -d '{"status":"uninstalled","reason":"agent_removed"}' \
         --max-time 10 --silent > /dev/null 2>&1 || true
    echo "  ✅ Server notified (if reachable)"
else
    echo "  No device ID found - server will detect offline status after 2 minutes"
fi

# Step 4: Remove directories
echo -e "${YELLOW}📁 Step 4: Removing directories...${NC}"
sudo rm -rf "$HOME/Library/Application Support/Pulse" 2>/dev/null || true
rm -rf ~/.pulse-mdm 2>/dev/null || true
rm -f /tmp/pulse-mdm* 2>/dev/null || true

# Final cleanup
echo -e "${YELLOW}🔄 Step 5: Final cleanup...${NC}"
pkill -f pulse 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 Pulse MDM Agent uninstalled!${NC}"
echo ""
echo -e "${BLUE}📖 The device will show as offline in the MDM console after 2 minutes.${NC}"
echo -e "${BLUE}    You can manually delete it using the trash icon if needed.${NC}"