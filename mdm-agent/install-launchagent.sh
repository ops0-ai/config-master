#!/bin/bash

# Pulse MDM Agent Installer with Enrollment Key (LaunchAgent Version)
# Usage: ./install-launchagent.sh <enrollment_key> [server_url]

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

# Check parameters
if [ "$#" -lt 1 ]; then
    print_error "Missing enrollment key!"
    echo ""
    echo "Usage: $0 <enrollment_key> [server_url]"
    echo ""
    echo "Example:"
    echo "  $0 2fbfe533c75180623a5f68a175c6b28aa014f26041c6f22239c0c3cad62bcf5b"
    echo "  $0 2fbfe533c75180623a5f68a175c6b28aa014f26041c6f22239c0c3cad62bcf5b http://localhost:5005/api"
    echo ""
    echo "To get your enrollment key:"
    echo "  1. Log in to the ConfigMaster web interface"
    echo "  2. Go to MDM section"
    echo "  3. Create or select an MDM profile"
    echo "  4. Copy the enrollment key"
    exit 1
fi

ENROLLMENT_KEY="$1"
SERVER_URL="${2:-http://localhost:5005/api}"

print_status "================================================"
print_status "🚀 Pulse MDM Agent Installation (LaunchAgent)"
print_status "Server URL: $SERVER_URL"
print_status "Enrollment Key: ${ENROLLMENT_KEY:0:8}..."
print_status "User: $USER"
print_status "================================================"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This installer is only for macOS systems"
    exit 1
fi

print_status "📱 Step 1: Installing Python dependencies..."

# Install Python packages for current user
/usr/bin/python3 -m pip install --user requests psutil netifaces 2>/dev/null || \
/usr/bin/python3 -m pip install --user requests psutil netifaces --break-system-packages || {
    print_error "Failed to install Python dependencies"
    print_warning "You may need to install them manually with:"
    echo "  /usr/bin/python3 -m pip install --user requests psutil netifaces --break-system-packages"
    exit 1
}

print_success "Python dependencies installed for user $USER"

print_status "🤖 Step 2: Creating Pulse MDM agent..."

# Create agent directory in user's Library
AGENT_DIR="$HOME/Library/Application Support/Pulse"
mkdir -p "$AGENT_DIR"

# Create the agent script
AGENT_PATH="$AGENT_DIR/pulse-mdm-agent.py"

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

# Add user's Python paths
home_dir = os.path.expanduser('~')
sys.path.extend([
    f'{home_dir}/Library/Python/3.9/lib/python/site-packages',
    f'{home_dir}/.local/lib/python3.9/site-packages',
    '/Library/Python/3.9/site-packages',
])

try:
    import requests
    import psutil
    import netifaces
except ImportError as e:
    print(f"Missing Python module: {e}")
    print("Please run: /usr/bin/python3 -m pip install --user requests psutil netifaces --break-system-packages")
    sys.exit(1)

# Configuration from environment
SERVER_URL = os.environ.get('PULSE_SERVER_URL', 'http://localhost:5005/api')
ENROLLMENT_KEY = os.environ.get('PULSE_ENROLLMENT_KEY', '')
AGENT_VERSION = '1.2.0'

# Setup logging
log_file = os.path.expanduser('~/Library/Logs/pulse-mdm.log')
os.makedirs(os.path.dirname(log_file), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
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
        """Generate a unique device ID based on hardware UUID"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=10)
            for line in result.stdout.split('\n'):
                if 'Hardware UUID' in line:
                    return line.split(':')[1].strip()
        except:
            pass
        
        # Fallback to persistent UUID
        uuid_file = os.path.expanduser('~/.pulse-mdm-device-id')
        
        if os.path.exists(uuid_file):
            with open(uuid_file, 'r') as f:
                return f.read().strip()
        else:
            device_id = str(uuid.uuid4())
            with open(uuid_file, 'w') as f:
                f.write(device_id)
            return device_id
    
    def get_serial_number(self):
        """Get device serial number"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=10)
            for line in result.stdout.split('\n'):
                if 'Serial Number' in line:
                    return line.split(':')[1].strip()
        except:
            pass
        return None
    
    def get_device_info(self):
        """Collect device information"""
        return {
            'deviceName': platform.node(),
            'deviceId': self.device_id,
            'serialNumber': self.get_serial_number(),
            'model': self.get_mac_model(),
            'osVersion': platform.mac_ver()[0],
            'architecture': platform.machine(),
            'hostname': platform.node(),
            'macAddress': self.get_mac_address(),
            'agentVersion': AGENT_VERSION,
            'agentInstallPath': __file__,
            'enrollmentKey': ENROLLMENT_KEY,  # Include enrollment key
            'metadata': {
                'python_version': platform.python_version(),
                'install_time': datetime.now().isoformat(),
                'user': os.environ.get('USER', 'unknown')
            }
        }
    
    def get_mac_model(self):
        """Get Mac model information"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=10)
            model_name = ""
            model_id = ""
            for line in result.stdout.split('\n'):
                if 'Model Name' in line:
                    model_name = line.split(':')[1].strip()
                if 'Model Identifier' in line:
                    model_id = line.split(':')[1].strip()
            if model_name and model_id:
                return f"{model_name} ({model_id})"
        except:
            pass
        return 'Unknown Mac'
    
    def get_mac_address(self):
        """Get primary MAC address"""
        try:
            for interface in netifaces.interfaces():
                if interface.startswith('en'):
                    addrs = netifaces.ifaddresses(interface)
                    if netifaces.AF_LINK in addrs:
                        mac = addrs[netifaces.AF_LINK][0]['addr']
                        if mac and mac != '00:00:00:00:00:00':
                            return mac
        except:
            pass
        return None
    
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
    
    def get_ip_address(self):
        """Get current IP address"""
        try:
            for interface in netifaces.interfaces():
                if interface.startswith('en'):
                    addrs = netifaces.ifaddresses(interface)
                    if netifaces.AF_INET in addrs:
                        for addr in addrs[netifaces.AF_INET]:
                            ip = addr['addr']
                            if ip and not ip.startswith('127.'):
                                return ip
        except:
            pass
        return None
    
    def enroll_device(self):
        """Enroll this device with the MDM server using enrollment key"""
        try:
            logger.info(f"Enrolling device: {self.device_info['deviceName']}")
            
            if not ENROLLMENT_KEY:
                logger.error("❌ No enrollment key provided!")
                return False
            
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
                'ipAddress': self.get_ip_address(),
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
                # Try to re-enroll if device not found
                if response.status_code == 404:
                    logger.info("Device not found, attempting re-enrollment...")
                    self.enroll_device()
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
        
        logger.info(f"📝 Executing command: {command_type}")
        
        # Update status to executing
        self.update_command_status(command_id, 'executing')
        
        try:
            if command_type == 'lock':
                # Lock the screen using pmset (doesn't require sudo)
                subprocess.run(['pmset', 'displaysleepnow'], check=True)
                self.update_command_status(command_id, 'completed', 'Screen locked')
                
            elif command_type == 'shutdown':
                self.update_command_status(command_id, 'completed', 'Shutdown command requires admin privileges')
                # Note: shutdown requires admin privileges
                logger.warning("Shutdown command requires admin privileges - not executed")
                
            elif command_type == 'restart':
                self.update_command_status(command_id, 'completed', 'Restart command requires admin privileges')
                # Note: restart requires admin privileges
                logger.warning("Restart command requires admin privileges - not executed")
                
            elif command_type == 'wake':
                # Wake displays
                subprocess.run(['caffeinate', '-u', '-t', '1'], check=True)
                self.update_command_status(command_id, 'completed', 'Display awakened')
                
            elif command_type == 'custom':
                # Execute custom command (limited to non-privileged commands)
                custom_cmd = command.get('command', '')
                if custom_cmd:
                    # Security check - don't run sudo commands
                    if 'sudo' in custom_cmd.lower():
                        self.update_command_status(command_id, 'failed', 
                                                error='Cannot execute commands requiring sudo')
                    else:
                        result = subprocess.run(custom_cmd, shell=True, capture_output=True, 
                                             text=True, timeout=command.get('timeout', 300))
                        self.update_command_status(command_id, 'completed', 
                                                result.stdout or 'Command executed',
                                                exit_code=result.returncode)
                else:
                    self.update_command_status(command_id, 'failed', 
                                            error='No command specified')
            else:
                self.update_command_status(command_id, 'failed', 
                                        error=f'Unknown command type: {command_type}')
                
        except subprocess.TimeoutExpired:
            self.update_command_status(command_id, 'timeout', 
                                    error='Command timed out')
        except Exception as e:
            self.update_command_status(command_id, 'failed', 
                                    error=str(e))
    
    def update_command_status(self, command_id, status, output=None, error=None, exit_code=None):
        """Update command execution status"""
        try:
            data = {'status': status}
            if output:
                data['output'] = output
            if error:
                data['errorMessage'] = error
            if exit_code is not None:
                data['exitCode'] = exit_code
                
            response = self.session.put(
                f'{SERVER_URL}/mdm/commands/{command_id}/status',
                json=data
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Command status updated: {status}")
            else:
                logger.warning(f"Failed to update command status: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error updating command status: {e}")
    
    def run(self):
        """Main agent loop"""
        self.running = True
        logger.info(f"🚀 Pulse MDM Agent v{AGENT_VERSION} starting...")
        logger.info(f"📡 Server: {SERVER_URL}")
        logger.info(f"🔑 Enrollment Key: {ENROLLMENT_KEY[:8]}..." if ENROLLMENT_KEY else "No enrollment key")
        logger.info(f"👤 Running as user: {os.environ.get('USER', 'unknown')}")
        
        # Initial enrollment
        if not self.enroll_device():
            logger.error("Failed to enroll device. Will retry in heartbeat loop...")
        
        # Main loop
        heartbeat_interval = 30  # seconds
        command_check_interval = 10  # seconds
        last_heartbeat = 0
        last_command_check = 0
        
        while self.running:
            try:
                current_time = time.time()
                
                # Send heartbeat
                if current_time - last_heartbeat >= heartbeat_interval:
                    self.send_heartbeat()
                    last_heartbeat = current_time
                
                # Check for commands
                if current_time - last_command_check >= command_check_interval:
                    self.check_commands()
                    last_command_check = current_time
                
                time.sleep(1)
                
            except KeyboardInterrupt:
                logger.info("🛑 Shutting down agent...")
                self.running = False
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                time.sleep(5)
    
    def stop(self):
        """Stop the agent"""
        self.running = False

if __name__ == '__main__':
    agent = PulseMDMAgent()
    try:
        agent.run()
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
AGENT_EOF

# Make the agent executable
chmod +x "$AGENT_PATH"

print_success "Agent created at $AGENT_PATH"

print_status "⚙️ Step 3: Creating LaunchAgent configuration..."

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Create LaunchAgent plist
PLIST_PATH="$HOME/Library/LaunchAgents/com.pulse.mdm.agent.plist"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm.agent</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_PATH</string>
    </array>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_SERVER_URL</key>
        <string>$SERVER_URL</string>
        <key>PULSE_ENROLLMENT_KEY</key>
        <string>$ENROLLMENT_KEY</string>
        <key>USER</key>
        <string>$USER</string>
        <key>HOME</key>
        <string>$HOME</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/pulse-mdm-stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pulse-mdm-stderr.log</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

print_success "LaunchAgent configuration created"

print_status "🚀 Step 4: Starting Pulse MDM agent..."

# Unload any existing agent first
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# Load the LaunchAgent
launchctl load "$PLIST_PATH"

# Wait a moment for the service to start
sleep 2

# Check if the service is running
if launchctl list | grep -q "com.pulse.mdm.agent"; then
    print_success "✅ Pulse MDM agent is running!"
else
    print_warning "⚠️ Agent may not have started correctly. Check logs at ~/Library/Logs/pulse-mdm.log"
fi

print_status "================================================"
print_success "🎉 Installation Complete!"
print_status "================================================"
echo ""
echo "The Pulse MDM agent is now installed and running as a LaunchAgent."
echo "This means it runs with your user privileges, not as root."
echo ""
echo "📋 Quick Commands:"
echo "  • Check status:  launchctl list | grep pulse"
echo "  • View logs:     tail -f ~/Library/Logs/pulse-mdm.log"
echo "  • Stop agent:    launchctl unload $PLIST_PATH"
echo "  • Start agent:   launchctl load $PLIST_PATH"
echo "  • Uninstall:     $0/../uninstall.sh"
echo ""
echo "📱 Your device should appear in the MDM dashboard shortly."
echo "   Device ID: Check ~/Library/Logs/pulse-mdm.log for the device ID"
echo ""
echo "⚠️  Note: Some commands (shutdown/restart) require admin privileges"
echo "   and won't work with LaunchAgent. Use LaunchDaemon for full control."
echo ""