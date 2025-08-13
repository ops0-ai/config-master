#!/bin/bash

# Pulse MDM Agent - LaunchAgent Installer (Fixed)
# Usage: ./agent-only-install-fixed.sh [server_url]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SERVER_URL="${1:-http://localhost:5005/api}"

print_status "================================================"
print_status "🚀 Pulse MDM Agent Installation (LaunchAgent Mode)"
print_status "Server URL: $SERVER_URL"
print_status "Mode: User LaunchAgent (No Root Issues)"
print_status "================================================"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This installer is only for macOS systems"
    exit 1
fi

# Get the real user (even when running with sudo)
REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(eval echo "~$REAL_USER")

print_status "📱 Step 1: Installing Python dependencies for user $REAL_USER..."

# Install Python packages for the user
sudo -u "$REAL_USER" /usr/bin/python3 -m pip install requests psutil netifaces --user 2>/dev/null || \
sudo -u "$REAL_USER" /usr/bin/python3 -m pip install requests psutil netifaces --user --break-system-packages || {
    print_error "Failed to install Python dependencies"
    exit 1
}

print_success "Python dependencies installed for user $REAL_USER"

print_status "🤖 Step 2: Creating Pulse MDM agent..."

# Create the agent script in a user-accessible location
AGENT_PATH="$REAL_HOME/Library/Application Support/Pulse/pulse-mdm-agent"
mkdir -p "$REAL_HOME/Library/Application Support/Pulse"

cat > "$AGENT_PATH" << 'AGENT_EOF'
#!/usr/bin/env python3

import os
import sys
import json
import time
import uuid
import platform
import subprocess
import threading
import logging
from datetime import datetime

# Set up environment for module loading
current_user = os.environ.get('USER', 'unknown')
home_dir = os.path.expanduser('~')

# Add Python paths for current user
sys.path.extend([
    f'{home_dir}/Library/Python/3.9/lib/python/site-packages',
    '/Library/Python/3.9/site-packages',
    '/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/site-packages',
    '/usr/local/lib/python3.9/site-packages'
])

try:
    import requests
    import psutil
    import netifaces
except ImportError as e:
    print(f"Missing Python module: {e}")
    print("Please run: /usr/bin/python3 -m pip install requests psutil netifaces --user")
    sys.exit(1)

# Configuration from environment or defaults
SERVER_URL = os.environ.get('PULSE_SERVER_URL', 'PLACEHOLDER_SERVER_URL')
AGENT_VERSION = '1.0.0'

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/pulse-mdm.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PulseMDMAgent:
    def __init__(self):
        self.device_id = self.get_device_id()
        self.device_info = self.get_device_info()
        self.running = False
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': f'Pulse-MDM-Agent/{AGENT_VERSION}'
        })
        self.session.timeout = 30
        
    def get_device_id(self):
        """Generate a unique device ID"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=10)
            for line in result.stdout.split('\n'):
                if 'Hardware UUID' in line:
                    return line.split(':')[1].strip()
        except:
            pass
        
        # Fallback to persistent UUID
        uuid_file = '/tmp/pulse-device-id'
        if os.path.exists(uuid_file):
            with open(uuid_file, 'r') as f:
                return f.read().strip()
        else:
            device_id = str(uuid.uuid4())
            with open(uuid_file, 'w') as f:
                f.write(device_id)
            return device_id
    
    def get_device_info(self):
        """Collect device information"""
        return {
            'deviceName': platform.node(),
            'deviceId': self.device_id,
            'model': self.get_mac_model(),
            'osVersion': platform.mac_ver()[0],
            'architecture': platform.machine(),
            'hostname': platform.node(),
            'agentVersion': AGENT_VERSION,
            'agentInstallPath': __file__,
            'metadata': {
                'python_version': platform.python_version(),
                'install_time': datetime.now().isoformat(),
                'user': current_user
            }
        }
    
    def get_mac_model(self):
        """Get Mac model information"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=10)
            for line in result.stdout.split('\n'):
                if 'Model Name' in line:
                    return line.split(':')[1].strip()
        except:
            pass
        return 'Unknown Mac'
    
    def get_battery_info(self):
        """Get battery information if available"""
        try:
            battery = psutil.sensors_battery()
            if battery:
                return {
                    'batteryLevel': int(battery.percent),
                    'isCharging': battery.power_plugged
                }
        except:
            pass
        return {}
    
    def enroll_device(self):
        """Enroll this device with the MDM server (no enrollment key needed)"""
        try:
            logger.info(f"Enrolling device: {self.device_info['deviceName']}")
            
            response = self.session.post(f'{SERVER_URL}/mdm/enroll', 
                                       json=self.device_info)
            
            if response.status_code in [200, 201]:
                logger.info("✅ Device enrolled successfully")
                return True
            else:
                logger.error(f"❌ Enrollment failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error during enrollment: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to server"""
        try:
            heartbeat_data = {
                'status': 'online',
                **self.get_battery_info()
            }
            
            response = self.session.post(
                f'{SERVER_URL}/mdm/devices/{self.device_id}/heartbeat',
                json=heartbeat_data
            )
            
            if response.status_code == 200:
                logger.debug("💓 Heartbeat sent successfully")
                return True
            else:
                logger.warning(f"⚠️ Heartbeat failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.warning(f"⚠️ Heartbeat error: {e}")
            return False
    
    def check_commands(self):
        """Check for pending commands"""
        try:
            response = self.session.get(
                f'{SERVER_URL}/mdm/devices/{self.device_id}/commands/pending'
            )
            
            if response.status_code == 200:
                commands = response.json()
                for command in commands:
                    self.execute_command(command)
                return True
            else:
                logger.debug(f"No commands or error: {response.status_code}")
                return False
                
        except Exception as e:
            logger.debug(f"Command check error: {e}")
            return False
    
    def execute_command(self, command):
        """Execute a remote command"""
        command_id = command['id']
        command_type = command['commandType']
        
        logger.info(f"🎯 Executing command: {command_type}")
        
        try:
            # Update command status to executing
            self.session.put(f'{SERVER_URL}/mdm/commands/{command_id}/status', 
                           json={'status': 'executing'})
            
            output = ""
            exit_code = 0
            
            if command_type == 'lock':
                # Try multiple lock methods for compatibility across macOS versions
                lock_success = False
                output = ""
                exit_code = 1
                
                # Method 1: Use osascript to activate screensaver (most compatible)
                try:
                    result = subprocess.run(['osascript', '-e', 'tell application "System Events" to start current screen saver'], 
                                          capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        output = "Screen locked via screensaver activation"
                        exit_code = 0
                        lock_success = True
                except:
                    pass
                
                # Method 2: Try CGSession if screensaver failed
                if not lock_success:
                    try:
                        result = subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', '-suspend'], 
                                              capture_output=True, text=True, timeout=10)
                        if result.returncode == 0:
                            output = "Screen locked via CGSession"
                            exit_code = 0
                            lock_success = True
                    except:
                        pass
                
                # Method 3: Fallback to pmset (display sleep only)
                if not lock_success:
                    try:
                        result = subprocess.run(['pmset', 'displaysleepnow'], capture_output=True, text=True, timeout=10)
                        if result.returncode == 0:
                            output = "Display turned off via pmset (screen may not be fully locked)"
                            exit_code = 0
                        else:
                            output = "Lock command failed - all methods unsuccessful"
                            exit_code = 1
                    except:
                        output = "Lock command failed - unable to execute any lock method"
                        exit_code = 1
                
            elif command_type == 'restart':
                # Restart the system using osascript (no sudo needed)
                result = subprocess.run(['osascript', '-e', 'tell app "System Events" to restart'], 
                                      capture_output=True, text=True, timeout=30)
                output = "System restart initiated via AppleScript"
                exit_code = result.returncode
                
            elif command_type == 'shutdown':
                # Shutdown the system using osascript (no sudo needed)
                result = subprocess.run(['osascript', '-e', 'tell app "System Events" to shut down'], 
                                      capture_output=True, text=True, timeout=30)
                output = "System shutdown initiated via AppleScript"
                exit_code = result.returncode
                
            elif command_type == 'custom':
                # Execute custom command
                custom_cmd = command.get('command', '')
                result = subprocess.run(custom_cmd, shell=True, capture_output=True, text=True, timeout=300)
                output = result.stdout + result.stderr
                exit_code = result.returncode
            
            # Update command status to completed
            self.session.put(f'{SERVER_URL}/mdm/commands/{command_id}/status', 
                           json={
                               'status': 'completed',
                               'output': output,
                               'exitCode': exit_code
                           })
            
            logger.info(f"✅ Command {command_type} completed")
            
        except Exception as e:
            logger.error(f"❌ Command execution failed: {e}")
            self.session.put(f'{SERVER_URL}/mdm/commands/{command_id}/status', 
                           json={
                               'status': 'failed',
                               'errorMessage': str(e)
                           })
    
    def heartbeat_loop(self):
        """Background heartbeat loop"""
        while self.running:
            self.send_heartbeat()
            time.sleep(30)  # Send heartbeat every 30 seconds
    
    def command_loop(self):
        """Background command checking loop"""
        while self.running:
            self.check_commands()
            time.sleep(10)  # Check for commands every 10 seconds
    
    def run(self):
        """Main agent loop"""
        logger.info("🚀 Starting Pulse MDM Agent")
        logger.info(f"Device ID: {self.device_id}")
        logger.info(f"Device Name: {self.device_info['deviceName']}")
        logger.info(f"Server URL: {SERVER_URL}")
        logger.info(f"Running as user: {current_user}")
        
        # Enroll device
        if not self.enroll_device():
            logger.error("❌ Device enrollment failed. Retrying in 60 seconds...")
            time.sleep(60)
            # Try once more
            if not self.enroll_device():
                logger.error("❌ Device enrollment failed again. Exiting.")
                return False
        
        self.running = True
        
        # Start background threads
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        command_thread = threading.Thread(target=self.command_loop, daemon=True)
        
        heartbeat_thread.start()
        command_thread.start()
        
        logger.info("✅ Pulse MDM Agent is running")
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Stopping Pulse MDM Agent")
            self.running = False
        
        return True

if __name__ == '__main__':
    agent = PulseMDMAgent()
    agent.run()
AGENT_EOF

# Replace placeholders with actual values
sed -i '' "s|PLACEHOLDER_SERVER_URL|$SERVER_URL|g" "$AGENT_PATH"

# Make agent executable and set proper ownership
chmod +x "$AGENT_PATH"
chown "$REAL_USER:staff" "$AGENT_PATH"

print_success "Pulse MDM agent created at $AGENT_PATH"

print_status "⚙️ Step 3: Creating user LaunchAgent..."

# Create LaunchAgent directory
LAUNCH_AGENT_DIR="$REAL_HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENT_DIR"

# Create launch agent plist
PLIST_PATH="$LAUNCH_AGENT_DIR/com.pulse.mdm.agent.plist"
cat > "$PLIST_PATH" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$AGENT_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/pulse-mdm-out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/pulse-mdm-err.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_SERVER_URL</key>
        <string>$SERVER_URL</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
PLIST_EOF

# Set proper ownership
chown "$REAL_USER:staff" "$PLIST_PATH"

print_success "LaunchAgent created at $PLIST_PATH"

print_status "🔄 Step 4: Starting the agent as user..."

# Stop any existing agents (both user and system)
sudo -u "$REAL_USER" launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl unload /Library/LaunchDaemons/com.pulse.mdm.agent.plist 2>/dev/null || true

# Load and start the new user agent
sudo -u "$REAL_USER" launchctl load "$PLIST_PATH"

# Wait a moment for startup
sleep 3

# Check if it's running
if sudo -u "$REAL_USER" launchctl list | grep -q com.pulse.mdm.agent; then
    print_success "✅ Pulse MDM Agent is running as user LaunchAgent!"
else
    print_warning "⚠️ Agent may not have started. Check logs: tail -f /tmp/pulse-mdm-*.log"
fi

print_status ""
print_status "================================================"
print_success "🎉 Pulse MDM Agent Installation Complete!"
print_status "================================================"
print_status ""
print_status "📊 Agent Features:"
print_status "  • Runs as user LaunchAgent (no root issues)"
print_status "  • No enrollment keys required - automatic registration"
print_status "  • Real-time heartbeats every 30 seconds"
print_status "  • Remote command execution (lock, restart, shutdown)"
print_status "  • Battery and system monitoring"
print_status "  • Starts automatically when user logs in"
print_status ""
print_status "🔧 Commands:"
print_status "  • Check status: launchctl list | grep pulse"
print_status "  • View logs: tail -f /tmp/pulse-mdm.log"
print_status "  • Restart: launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist && launchctl load ~/Library/LaunchAgents/com.pulse.mdm.agent.plist"
print_status ""
print_status "🌐 Your device will appear in the Pulse MDM dashboard automatically!"
print_status ""