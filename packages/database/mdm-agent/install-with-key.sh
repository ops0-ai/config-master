#\!/bin/bash

# Pulse MDM Agent Installer Script
# Usage: ./install-with-key.sh <ENROLLMENT_KEY>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" \!= "darwin"* ]]; then
    echo -e "${RED}❌ This installer is only for macOS${NC}"
    exit 1
fi

# Check for enrollment key
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Enrollment key is required${NC}"
    echo "Usage: $0 <ENROLLMENT_KEY>"
    echo "Example: $0 your-enrollment-key-here"
    exit 1
fi

ENROLLMENT_KEY="$1"
PULSE_SERVER_URL="${PULSE_SERVER_URL:-http://localhost:5005/api}"

echo -e "${GREEN}🚀 Pulse MDM Agent Installation${NC}"
echo "================================="
echo "Server URL: $PULSE_SERVER_URL"
echo "Enrollment Key: ${ENROLLMENT_KEY:0:20}..."
echo ""

# Check Python 3
echo -e "${YELLOW}📋 Checking Python 3...${NC}"
if \! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    echo "Please install Python 3 first"
    exit 1
fi
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✅ Python $PYTHON_VERSION found${NC}"

# Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
pip3 install requests psutil netifaces --quiet --break-system-packages 2>/dev/null || \
pip3 install requests psutil netifaces --quiet 2>/dev/null || \
pip3 install requests psutil netifaces --user --quiet 2>/dev/null || {
    echo -e "${RED}❌ Failed to install Python dependencies${NC}"
    echo "Try running: pip3 install requests psutil netifaces"
    exit 1
}
echo -e "${GREEN}✅ Python dependencies installed${NC}"

# Create agent directory
AGENT_DIR="$HOME/.pulse-mdm"
echo -e "${YELLOW}📁 Creating agent directory at $AGENT_DIR${NC}"
mkdir -p "$AGENT_DIR"

# Create the Python agent script
echo -e "${YELLOW}📝 Creating Pulse MDM agent...${NC}"
cat > "$AGENT_DIR/pulse-mdm-agent.py" << 'EOF'
#\!/usr/bin/env python3
import os
import sys
import time
import json
import socket
import platform
import subprocess
import signal
import requests
import psutil
import netifaces
from datetime import datetime

# Configuration from environment
ENROLLMENT_KEY = os.environ.get('PULSE_ENROLLMENT_KEY', '')
SERVER_URL = os.environ.get('PULSE_SERVER_URL', 'http://localhost:5005/api')
DEVICE_ID = None
HEARTBEAT_INTERVAL = 30  # seconds

def log(message):
    """Write log message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    with open(os.path.expanduser('~/Library/Logs/pulse-mdm.log'), 'a') as f:
        f.write(log_message + '\n')

def get_device_info():
    """Gather device information"""
    try:
        # Get network interfaces
        ip_address = None
        mac_address = None
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs and interface \!= 'lo0':
                ip_info = addrs[netifaces.AF_INET][0]
                if 'addr' in ip_info:
                    ip_address = ip_info['addr']
                if netifaces.AF_LINK in addrs:
                    mac_address = addrs[netifaces.AF_LINK][0].get('addr', '')
                if ip_address and not ip_address.startswith('127.'):
                    break
        
        # Get battery info if available
        battery = psutil.sensors_battery()
        battery_level = int(battery.percent) if battery else None
        is_charging = battery.power_plugged if battery else None
        
        return {
            'deviceName': socket.gethostname(),
            'deviceId': get_device_id(),
            'serialNumber': get_serial_number(),
            'model': platform.machine(),
            'osVersion': platform.mac_ver()[0] if platform.system() == 'Darwin' else platform.version(),
            'architecture': platform.machine(),
            'ipAddress': ip_address,
            'macAddress': mac_address,
            'hostname': socket.getfqdn(),
            'batteryLevel': battery_level,
            'isCharging': is_charging,
            'agentVersion': '1.0.0'
        }
    except Exception as e:
        log(f"Error getting device info: {e}")
        return {}

def get_device_id():
    """Get or generate unique device ID"""
    global DEVICE_ID
    if DEVICE_ID:
        return DEVICE_ID
    
    id_file = os.path.expanduser('~/.pulse-mdm/device_id')
    if os.path.exists(id_file):
        with open(id_file, 'r') as f:
            DEVICE_ID = f.read().strip()
    else:
        import uuid
        DEVICE_ID = str(uuid.uuid4())
        with open(id_file, 'w') as f:
            f.write(DEVICE_ID)
    
    return DEVICE_ID

def get_serial_number():
    """Get device serial number on macOS"""
    try:
        result = subprocess.run(
            ['system_profiler', 'SPHardwareDataType'],
            capture_output=True,
            text=True
        )
        for line in result.stdout.split('\n'):
            if 'Serial Number' in line:
                return line.split(':')[1].strip()
    except:
        pass
    return 'UNKNOWN'

def enroll_device():
    """Enroll device with MDM server"""
    log("Enrolling device with MDM server...")
    
    device_info = get_device_info()
    device_info['enrollmentKey'] = ENROLLMENT_KEY
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/enroll",
            json=device_info,
            timeout=10
        )
        
        if response.status_code == 200:
            log("✅ Device enrolled successfully")
            return True
        elif response.status_code == 409:
            log("Device already enrolled")
            return True
        else:
            log(f"❌ Enrollment failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        log(f"❌ Enrollment error: {e}")
        return False

def send_heartbeat():
    """Send heartbeat to MDM server"""
    device_info = get_device_info()
    device_info['status'] = 'online'
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/devices/{get_device_id()}/heartbeat",
            json=device_info,
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
        
        if response.status_code == 200:
            return True
        else:
            log(f"Heartbeat failed: {response.status_code}")
            return False
    except Exception as e:
        log(f"Heartbeat error: {e}")
        return False

def check_pending_commands():
    """Check for pending commands from MDM server"""
    try:
        response = requests.get(
            f"{SERVER_URL}/mdm/devices/{get_device_id()}/commands/pending",
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
        
        if response.status_code == 200:
            commands = response.json()
            for command in commands:
                execute_command(command)
    except Exception as e:
        log(f"Error checking commands: {e}")

def execute_command(command):
    """Execute MDM command"""
    log(f"Executing command: {command['commandType']}")
    
    command_id = command['id']
    command_type = command['commandType']
    
    try:
        result = None
        exit_code = 0
        
        if command_type == 'lock':
            # Lock the screen
            subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', '-suspend'])
            result = "Screen locked"
        
        elif command_type == 'wake':
            # Wake the display
            subprocess.run(['caffeinate', '-u', '-t', '2'])
            result = "Display awakened"
        
        elif command_type == 'restart':
            # Schedule restart (requires admin privileges)
            result = "Restart requires admin privileges - please restart manually"
            exit_code = 1
        
        elif command_type == 'shutdown':
            # Schedule shutdown (requires admin privileges)
            result = "Shutdown requires admin privileges - please shutdown manually"
            exit_code = 1
        
        elif command_type == 'custom':
            # Execute custom command (be careful with this\!)
            if 'command' in command:
                proc = subprocess.run(
                    command['command'],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                result = proc.stdout or proc.stderr
                exit_code = proc.returncode
        
        # Report command result
        report_command_result(command_id, 'completed' if exit_code == 0 else 'failed', result, exit_code)
        
    except Exception as e:
        log(f"Command execution error: {e}")
        report_command_result(command_id, 'failed', str(e), 1)

def report_command_result(command_id, status, output, exit_code):
    """Report command execution result to MDM server"""
    try:
        requests.put(
            f"{SERVER_URL}/mdm/commands/{command_id}/status",
            json={
                'status': status,
                'output': output,
                'exitCode': exit_code,
                'completedAt': datetime.now().isoformat()
            },
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
    except Exception as e:
        log(f"Error reporting command result: {e}")

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    log("Pulse MDM agent shutting down...")
    sys.exit(0)

def main():
    """Main agent loop"""
    log("🚀 Pulse MDM Agent starting...")
    log(f"Server: {SERVER_URL}")
    log(f"Device ID: {get_device_id()}")
    
    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Enroll device
    if not enroll_device():
        log("Failed to enroll device, will retry...")
    
    # Main loop
    last_heartbeat = 0
    while True:
        try:
            current_time = time.time()
            
            # Send heartbeat
            if current_time - last_heartbeat >= HEARTBEAT_INTERVAL:
                if send_heartbeat():
                    check_pending_commands()
                last_heartbeat = current_time
            
            time.sleep(5)
            
        except KeyboardInterrupt:
            log("Interrupted by user")
            break
        except Exception as e:
            log(f"Main loop error: {e}")
            time.sleep(30)
    
    log("Pulse MDM agent stopped")

if __name__ == '__main__':
    main()
EOF

# Create LaunchAgent plist
echo -e "${YELLOW}🔧 Creating LaunchAgent configuration...${NC}"
PLIST_FILE="$HOME/Library/LaunchAgents/com.pulse.mdm.agent.plist"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_FILE" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<\!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_DIR/pulse-mdm-agent.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_ENROLLMENT_KEY</key>
        <string>$ENROLLMENT_KEY</string>
        <key>PULSE_SERVER_URL</key>
        <string>$PULSE_SERVER_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/pulse-mdm.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pulse-mdm-error.log</string>
</dict>
</plist>
PLIST_EOF

# Load the LaunchAgent
echo -e "${YELLOW}🚀 Starting Pulse MDM agent...${NC}"
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

# Verify it's running
sleep 2
if launchctl list | grep -q "com.pulse.mdm.agent"; then
    echo -e "${GREEN}✅ Pulse MDM agent installed and running\!${NC}"
    echo ""
    echo "Agent Details:"
    echo "  • Service: com.pulse.mdm.agent"
    echo "  • Config: $PLIST_FILE"
    echo "  • Script: $AGENT_DIR/pulse-mdm-agent.py"
    echo "  • Logs: ~/Library/Logs/pulse-mdm.log"
    echo ""
    echo "To check status: launchctl list | grep pulse"
    echo "To view logs: tail -f ~/Library/Logs/pulse-mdm.log"
    echo "To stop: launchctl unload $PLIST_FILE"
    echo "To start: launchctl load $PLIST_FILE"
else
    echo -e "${RED}❌ Failed to start Pulse MDM agent${NC}"
    echo "Check logs at: ~/Library/Logs/pulse-mdm-error.log"
    exit 1
fi
SCRIPT_END < /dev/null