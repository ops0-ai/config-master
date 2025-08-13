#!/bin/bash

# Pulse MDM Agent Uninstaller
# This script removes the Pulse MDM agent and all related files

set -e

echo "==================================="
echo "  Pulse MDM Agent Uninstaller"
echo "==================================="
echo ""

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run this script with sudo privileges"
    echo "   Usage: sudo ./uninstall.sh"
    exit 1
fi

echo "This will completely remove the Pulse MDM agent from your system."
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Uninstallation cancelled"
    exit 0
fi

echo ""
echo "🔍 Detecting installed components..."

# Stop and unload the launch daemon
PLIST_PATH="/Library/LaunchDaemons/com.pulse.mdm.agent.plist"
if [ -f "$PLIST_PATH" ]; then
    echo "📋 Found launch daemon configuration"
    
    # Check if service is loaded
    if launchctl list | grep -q "com.pulse.mdm.agent"; then
        echo "⏹  Stopping Pulse MDM agent service..."
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        echo "✅ Service stopped"
    fi
    
    echo "🗑  Removing launch daemon..."
    rm -f "$PLIST_PATH"
    echo "✅ Launch daemon removed"
else
    echo "ℹ️  No launch daemon found (may be using user agent)"
fi

# Check for user agent (alternative installation)
USER_PLIST_PATH="$HOME/Library/LaunchAgents/com.pulse.mdm.agent.plist"
if [ -f "$USER_PLIST_PATH" ]; then
    echo "📋 Found user agent configuration"
    
    # Check if user agent is loaded
    if launchctl list | grep -q "com.pulse.mdm.agent"; then
        echo "⏹  Stopping Pulse MDM user agent..."
        launchctl unload "$USER_PLIST_PATH" 2>/dev/null || true
        echo "✅ User agent stopped"
    fi
    
    echo "🗑  Removing user agent..."
    rm -f "$USER_PLIST_PATH"
    echo "✅ User agent removed"
fi

# Remove agent script
AGENT_PATH="/usr/local/bin/pulse-mdm-agent"
if [ -f "$AGENT_PATH" ]; then
    echo "🗑  Removing agent executable..."
    rm -f "$AGENT_PATH"
    echo "✅ Agent executable removed"
else
    echo "ℹ️  No agent executable found at default location"
fi

# Remove alternative agent locations
ALT_AGENT_PATHS=(
    "/opt/pulse-mdm/agent.py"
    "/usr/local/pulse-mdm/agent.py"
    "$HOME/.pulse-mdm/agent.py"
)

for path in "${ALT_AGENT_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo "🗑  Removing agent at: $path"
        rm -f "$path"
        
        # Remove parent directory if empty
        parent_dir=$(dirname "$path")
        if [ -d "$parent_dir" ]; then
            rmdir "$parent_dir" 2>/dev/null || true
        fi
    fi
done

# Remove configuration files
CONFIG_PATHS=(
    "/etc/pulse-mdm/"
    "/usr/local/etc/pulse-mdm/"
    "$HOME/.config/pulse-mdm/"
    "/var/lib/pulse-mdm/"
)

for path in "${CONFIG_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "🗑  Removing configuration directory: $path"
        rm -rf "$path"
    fi
done

# Remove log files
LOG_PATHS=(
    "/tmp/pulse-mdm.log"
    "/tmp/pulse-mdm-agent.log"
    "/var/log/pulse-mdm.log"
    "/var/log/pulse-mdm-agent.log"
    "$HOME/Library/Logs/pulse-mdm.log"
)

for path in "${LOG_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo "🗑  Removing log file: $path"
        rm -f "$path"
    fi
done

# Kill any remaining agent processes
echo "🔍 Checking for running agent processes..."
if pgrep -f "pulse-mdm-agent" > /dev/null 2>&1; then
    echo "⏹  Terminating remaining agent processes..."
    pkill -f "pulse-mdm-agent" 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    if pgrep -f "pulse-mdm-agent" > /dev/null 2>&1; then
        pkill -9 -f "pulse-mdm-agent" 2>/dev/null || true
    fi
    echo "✅ Processes terminated"
else
    echo "✅ No running processes found"
fi

# Remove any MDM profiles (macOS specific)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🔍 Checking for MDM profiles..."
    
    # List profiles (requires admin privileges)
    profiles_output=$(profiles -L 2>/dev/null || true)
    
    if echo "$profiles_output" | grep -q "Pulse MDM\|ConfigMaster MDM"; then
        echo "📱 Found MDM profile(s)"
        echo "ℹ️  To remove MDM profiles, please go to:"
        echo "   System Preferences > Profiles"
        echo "   Select the Pulse/ConfigMaster MDM profile and click the '-' button"
    else
        echo "✅ No MDM profiles found"
    fi
fi

echo ""
echo "==================================="
echo "✅ Pulse MDM Agent Uninstalled"
echo "==================================="
echo ""
echo "The Pulse MDM agent has been completely removed from your system."
echo ""
echo "Note: If you had installed any MDM profiles through System Preferences,"
echo "you may need to remove them manually through:"
echo "  System Preferences > Profiles"
echo ""
echo "If you want to reinstall the agent later, you can use the installation script."