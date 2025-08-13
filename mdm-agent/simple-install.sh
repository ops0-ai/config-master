#!/bin/bash

# Pulse MDM Agent - Simple Installer
# Usage: ./simple-install.sh <enrollment_key> [server_url]

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
if [ $# -eq 0 ]; then
    print_error "Usage: $0 <enrollment_key> [server_url]"
    print_error "Example: $0 abc123def456 http://localhost:5005/api"
    exit 1
fi

ENROLLMENT_KEY="$1"
SERVER_URL="${2:-http://localhost:5005/api}"

print_status "================================================"
print_status "🚀 Pulse MDM Agent Installation"
print_status "Enrollment Key: ${ENROLLMENT_KEY:0:8}..."
print_status "Server URL: $SERVER_URL"
print_status "================================================"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This installer is only for macOS systems"
    exit 1
fi

# Check for admin privileges
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run this script with sudo privileges"
    print_error "Usage: sudo ./simple-install.sh <enrollment_key> [server_url]"
    exit 1
fi

print_status "📱 Step 1: Installing Python dependencies..."

# Install Python packages globally to avoid path issues
/usr/bin/python3 -m pip install requests psutil netifaces --break-system-packages 2>/dev/null || \
/usr/bin/python3 -m pip install requests psutil netifaces || {
    print_error "Failed to install Python dependencies"
    exit 1
}

print_success "Python dependencies installed"

print_status "🤖 Step 2: Creating Pulse MDM agent..."

# Create the agent script
cat > /usr/local/bin/pulse-mdm-agent << 'AGENT_EOF'
#!/usr/bin/python3

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

# Add common Python paths to ensure modules are found
sys.path.extend([
    '/usr/local/lib/python3.9/site-packages',
    '/usr/local/lib/python3.10/site-packages', 
    '/usr/local/lib/python3.11/site-packages',
    '/usr/local/lib/python3.12/site-packages'
])

try:
    import requests
    import psutil
    import netifaces
except ImportError as e:
    print(f"Missing Python module: {e}")
    print("Please run: sudo /usr/bin/python3 -m pip install requests psutil netifaces")
    sys.exit(1)

# Configuration from environment or defaults
ENROLLMENT_KEY = os.environ.get('PULSE_ENROLLMENT_KEY', 'PLACEHOLDER_ENROLLMENT_KEY')
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
            for line in result.stdout.split('\\n'):
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
            'enrollmentKey': ENROLLMENT_KEY,
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
                'install_time': datetime.now().isoformat()
            }
        }
    
    def get_mac_model(self):
        """Get Mac model information"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=10)
            for line in result.stdout.split('\\n'):
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
        """Enroll this device with the MDM server"""
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
                # Lock the screen
                subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', '-suspend'])
                output = "Screen locked successfully"
                
            elif command_type == 'restart':
                # Restart the system
                subprocess.run(['sudo', 'shutdown', '-r', 'now'])
                output = "System restart initiated"
                
            elif command_type == 'shutdown':
                # Shutdown the system  
                subprocess.run(['sudo', 'shutdown', '-h', 'now'])
                output = "System shutdown initiated"
                
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
    if ENROLLMENT_KEY == 'PLACEHOLDER_ENROLLMENT_KEY':
        print("❌ Enrollment key not configured!")
        print("Please set PULSE_ENROLLMENT_KEY environment variable")
        sys.exit(1)
    
    agent = PulseMDMAgent()
    agent.run()
AGENT_EOF

# Replace placeholders with actual values
sed -i '' "s/PLACEHOLDER_ENROLLMENT_KEY/$ENROLLMENT_KEY/g" /usr/local/bin/pulse-mdm-agent
sed -i '' "s|PLACEHOLDER_SERVER_URL|$SERVER_URL|g" /usr/local/bin/pulse-mdm-agent

# Make agent executable
chmod +x /usr/local/bin/pulse-mdm-agent

print_success "Pulse MDM agent created"

print_status "⚙️ Step 3: Creating launch daemon..."

# Create launch daemon
cat > /Library/LaunchDaemons/com.pulse.mdm.agent.plist << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/pulse-mdm-agent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/pulse-mdm-out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/pulse-mdm-err.log</string>
    <key>UserName</key>
    <string>root</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PULSE_ENROLLMENT_KEY</key>
        <string>ENROLLMENT_KEY_PLACEHOLDER</string>
        <key>PULSE_SERVER_URL</key>
        <string>SERVER_URL_PLACEHOLDER</string>
    </dict>
</dict>
</plist>
PLIST_EOF

# Replace placeholders in plist
sed -i '' "s/ENROLLMENT_KEY_PLACEHOLDER/$ENROLLMENT_KEY/g" /Library/LaunchDaemons/com.pulse.mdm.agent.plist
sed -i '' "s|SERVER_URL_PLACEHOLDER|$SERVER_URL|g" /Library/LaunchDaemons/com.pulse.mdm.agent.plist

print_success "Launch daemon created"

print_status "🔄 Step 4: Starting the agent..."

# Stop any existing agent
launchctl unload /Library/LaunchDaemons/com.pulse.mdm.agent.plist 2>/dev/null || true

# Load and start the new agent
launchctl load /Library/LaunchDaemons/com.pulse.mdm.agent.plist

# Wait a moment for startup
sleep 3

# Check if it's running
if launchctl list | grep -q com.pulse.mdm.agent; then
    print_success "✅ Pulse MDM Agent is running!"
else
    print_warning "⚠️ Agent may not have started. Check logs: tail -f /tmp/pulse-mdm-*.log"
fi

print_status ""
print_status "================================================"
print_success "🎉 Pulse MDM Agent Installation Complete!"
print_status "================================================"
print_status ""
print_status "📊 Status:"
print_status "  • Agent: /usr/local/bin/pulse-mdm-agent"
print_status "  • Daemon: /Library/LaunchDaemons/com.pulse.mdm.agent.plist"
print_status "  • Logs: /tmp/pulse-mdm*.log"
print_status ""
print_status "🔧 Commands:"
print_status "  • Check status: sudo launchctl list | grep pulse"
print_status "  • View logs: tail -f /tmp/pulse-mdm.log"
print_status "  • Restart: sudo launchctl unload /Library/LaunchDaemons/com.pulse.mdm.agent.plist && sudo launchctl load /Library/LaunchDaemons/com.pulse.mdm.agent.plist"
print_status ""
print_status "The agent will automatically:"
print_status "  • Enroll with your MDM server"
print_status "  • Send heartbeats every 30 seconds"  
print_status "  • Check for commands every 10 seconds"
print_status "  • Start on system boot"
print_status ""