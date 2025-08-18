#!/bin/bash

# Pulse MDM Agent Removal Script
# This script removes the Pulse MDM agent from the system

echo "🧹 Pulse MDM Agent Removal"
echo "=========================="
echo ""

# Unload LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.plist 2>/dev/null || true

# Kill agent processes
pkill -f pulse-mdm-agent 2>/dev/null || true
pkill -f pulse-agent 2>/dev/null || true

# Remove LaunchAgent files
rm -f ~/Library/LaunchAgents/com.pulse.mdm.agent.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.pulse.mdm.plist 2>/dev/null || true

# Remove agent data
rm -rf ~/.pulse-mdm 2>/dev/null || true
rm -rf ~/Library/Application\ Support/Pulse* 2>/dev/null || true

# Remove logs
rm -f ~/Library/Logs/pulse-*.log 2>/dev/null || true

echo "✅ Pulse MDM Agent removed successfully"
echo ""
echo "Note: The device may still appear in the admin panel until"
echo "      it's manually removed or marked as uninstalled."
echo ""