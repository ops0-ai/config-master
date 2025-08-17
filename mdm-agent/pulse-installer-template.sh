#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Pulse MDM Agent Installer${NC}"
echo "========================================"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${YELLOW}⚠️  This installer is designed for macOS. For other systems, please install manually.${NC}"
    exit 1
fi

# Get enrollment key from command line argument
ENROLLMENT_KEY="${1}"
SERVER_URL="{{SERVER_URL}}"

# Validate enrollment key
if [ -z "$ENROLLMENT_KEY" ]; then
    echo -e "${RED}❌ Error: Enrollment key required${NC}"
    echo "Usage: $0 <enrollment-key>"
    echo "Example: $0 715d6045fb653e6a85a83a06a3a3c36d5f881c6a1ed3fe46bdd0c82b32c8d633"
    exit 1
fi

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Server URL: $SERVER_URL"
echo "  Enrollment Key: ${ENROLLMENT_KEY:0:10}..."
echo ""

# Create agent directory
AGENT_DIR="$HOME/.pulse-mdm"
echo -e "${GREEN}📁 Creating agent directory...${NC}"
mkdir -p "$AGENT_DIR"

# Install Python dependencies
echo -e "${GREEN}📦 Checking Python dependencies...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3 first.${NC}"
    exit 1
fi

# Check for pip
if ! python3 -m pip --version &> /dev/null; then
    echo -e "${YELLOW}Installing pip...${NC}"
    curl https://bootstrap.pypa.io/get-pip.py | python3
fi

# Install required Python packages
echo -e "${GREEN}📚 Installing Python packages...${NC}"
python3 -m pip install --user requests psutil netifaces 2>/dev/null || true

# Create agent script
echo -e "${GREEN}📄 Installing agent script...${NC}"
cat > "$AGENT_DIR/agent.py" << 'AGENT_SCRIPT_EOF'
{{AGENT_SCRIPT}}
AGENT_SCRIPT_EOF

chmod +x "$AGENT_DIR/agent.py"

# Create configuration
echo -e "${GREEN}⚙️  Creating configuration...${NC}"
cat > "$AGENT_DIR/config.json" << EOF
{
  "server_url": "$SERVER_URL",
  "enrollment_key": "$ENROLLMENT_KEY"
}
EOF

# Create LaunchAgent plist for automatic startup
echo -e "${GREEN}🔧 Setting up automatic startup...${NC}"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENT_DIR"

PLIST_FILE="$LAUNCH_AGENT_DIR/com.pulse.mdm.agent.plist"
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm.agent</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_DIR/agent.py</string>
    </array>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_SERVER_URL</key>
        <string>$SERVER_URL</string>
        <key>PULSE_ENROLLMENT_KEY</key>
        <string>$ENROLLMENT_KEY</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>$AGENT_DIR/agent.log</string>
    
    <key>StandardErrorPath</key>
    <string>$AGENT_DIR/agent.error.log</string>
    
    <key>WorkingDirectory</key>
    <string>$AGENT_DIR</string>
</dict>
</plist>
EOF

# Load the LaunchAgent
echo -e "${GREEN}🚀 Starting agent...${NC}"
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

# Verify agent is running
sleep 3
if launchctl list | grep -q "com.pulse.mdm.agent"; then
    echo -e "${GREEN}✅ Pulse MDM Agent installed and running successfully!${NC}"
    echo ""
    echo "Agent Details:"
    echo "  • Installation directory: $AGENT_DIR"
    echo "  • Log file: $AGENT_DIR/agent.log"
    echo "  • Configuration: $AGENT_DIR/config.json"
    echo "  • LaunchAgent: $PLIST_FILE"
    echo ""
    echo "Useful commands:"
    echo "  • View logs: tail -f $AGENT_DIR/agent.log"
    echo "  • Stop agent: launchctl unload $PLIST_FILE"
    echo "  • Start agent: launchctl load $PLIST_FILE"
    echo "  • Restart agent: launchctl unload $PLIST_FILE && launchctl load $PLIST_FILE"
else
    echo -e "${RED}❌ Failed to start agent. Check logs at $AGENT_DIR/agent.log${NC}"
    echo "Trying manual start..."
    cd "$AGENT_DIR" && python3 agent.py > agent.log 2>&1 &
    echo "Agent started manually. Check $AGENT_DIR/agent.log for status."
fi