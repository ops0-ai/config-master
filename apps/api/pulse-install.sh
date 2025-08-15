#!/bin/bash

# MDM Agent Installer for macOS
# This script installs the MDM agent on a MacBook

set -e

AGENT_NAME="ConfigMasterMDM"
AGENT_DIR="/usr/local/bin"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
LAUNCH_DAEMON_DIR="/Library/LaunchDaemons"
PLIST_NAME="com.configmaster.mdm.agent.plist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This installer is only for macOS systems"
    exit 1
fi

# Check for required parameters
if [ $# -eq 0 ]; then
    print_error "Usage: $0 <enrollment_key> [server_url]"
    print_error "Example: $0 abc123def456 https://your-server.com/api"
    exit 1
fi

ENROLLMENT_KEY="$1"
SERVER_URL="${2:-http://localhost:5005/api}"

print_status "Starting ConfigMaster MDM Agent installation..."
print_status "Enrollment Key: ${ENROLLMENT_KEY:0:8}..."
print_status "Server URL: $SERVER_URL"

# Create agent directory if it doesn't exist
if [ ! -d "$AGENT_DIR" ]; then
    print_status "Creating agent directory: $AGENT_DIR"
    sudo mkdir -p "$AGENT_DIR"
fi

# Create the Python agent script
print_status "Creating MDM agent script..."
sudo tee "$AGENT_DIR/configmaster-mdm-agent" > /dev/null << 'EOF'
#!/usr/bin/env python3

import os
import sys
import json
import time
import signal
import requests
import subprocess
import platform
import uuid
import threading
import logging
from datetime import datetime
import psutil

# Configuration
SERVER_URL = os.environ.get('MDM_SERVER_URL', 'http://localhost:5005/api')
ENROLLMENT_KEY = os.environ.get('MDM_ENROLLMENT_KEY', '')
AGENT_VERSION = "1.0.0"
HEARTBEAT_INTERVAL = 30  # seconds
COMMAND_CHECK_INTERVAL = 10  # seconds

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/configmaster-mdm.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MDMAgent:
    def __init__(self):
        self.device_id = self.get_device_id()
        self.device_info = self.get_device_info()
        self.running = False
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': f'ConfigMaster-MDM-Agent/{AGENT_VERSION}'
        })
        
    def get_device_id(self):
        """Generate a unique device ID based on hardware UUID"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                    capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'Hardware UUID' in line:
                    return line.split(':')[1].strip()
        except Exception as e:
            logger.warning(f"Could not get hardware UUID: {e}")
        
        # Fallback to a persistent UUID
        uuid_file = '/tmp/configmaster-device-id'
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
        try:
            # Get system information
            system_info = {
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
                    'processor': platform.processor(),
                    'install_time': datetime.now().isoformat()
                }
            }
            
            # Get network information
            try:
                import netifaces
                for interface in netifaces.interfaces():
                    if interface.startswith('en'):  # Ethernet interfaces
                        addrs = netifaces.ifaddresses(interface)
                        if netifaces.AF_INET in addrs:
                            system_info['ipAddress'] = addrs[netifaces.AF_INET][0]['addr']
                        if netifaces.AF_LINK in addrs:
                            system_info['macAddress'] = addrs[netifaces.AF_LINK][0]['addr']
                        break
            except ImportError:
                # Fallback method without netifaces
                try:
                    result = subprocess.run(['ifconfig'], capture_output=True, text=True)
                    lines = result.stdout.split('\n')
                    for i, line in enumerate(lines):
                        if 'en0:' in line or 'en1:' in line:
                            # Look for inet address
                            for j in range(i+1, min(i+10, len(lines))):
                                if 'inet ' in lines[j]:
                                    system_info['ipAddress'] = lines[j].split('inet ')[1].split(' ')[0]
                                if 'ether ' in lines[j]:
                                    system_info['macAddress'] = lines[j].split('ether ')[1].split(' ')[0]
                                    break
                            break
                except Exception as e:
                    logger.warning(f"Could not get network info: {e}")
            
            # Get serial number
            try:
                result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                        capture_output=True, text=True)
                for line in result.stdout.split('\n'):
                    if 'Serial Number' in line:
                        system_info['serialNumber'] = line.split(':')[1].strip()
                        break
            except Exception as e:
                logger.warning(f"Could not get serial number: {e}")
                
            return system_info
        except Exception as e:
            logger.error(f"Error collecting device info: {e}")
            return {
                'deviceName': platform.node(),
                'deviceId': self.device_id,
                'osVersion': platform.mac_ver()[0],
                'architecture': platform.machine(),
                'agentVersion': AGENT_VERSION
            }
    
    def get_mac_model(self):
        """Get Mac model identifier"""
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                    capture_output=True, text=True)
            for line in result.stdout.split('\n'):
                if 'Model Identifier' in line:
                    return line.split(':')[1].strip()
        except Exception:
            pass
        return 'Unknown Mac'
    
    def get_battery_info(self):
        """Get battery information"""
        try:
            battery = psutil.sensors_battery()
            if battery:
                return {
                    'batteryLevel': int(battery.percent),
                    'isCharging': battery.power_plugged
                }
        except Exception as e:
            logger.warning(f"Could not get battery info: {e}")
        return {}
    
    def enroll_device(self):
        """Enroll this device with the MDM server"""
        try:
            enrollment_data = {
                'enrollmentKey': ENROLLMENT_KEY,
                **self.device_info
            }
            
            response = self.session.post(f'{SERVER_URL}/mdm/enroll', 
                                         json=enrollment_data)
            
            if response.status_code in [200, 201]:
                logger.info(f"Device enrolled successfully: {self.device_info['deviceName']}")
                return True
            else:
                logger.error(f"Enrollment failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error during enrollment: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to server"""
        try:
            heartbeat_data = {
                'status': 'online',
                **self.get_battery_info()
            }
            
            response = self.session.post(f'{SERVER_URL}/mdm/devices/{self.device_id}/heartbeat',
                                         json=heartbeat_data)
            
            if response.status_code == 200:
                logger.debug("Heartbeat sent successfully")
                return True
            else:
                logger.warning(f"Heartbeat failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.warning(f"Error sending heartbeat: {e}")
            return False
    
    def check_for_commands(self):
        """Check for pending commands from server"""
        try:
            response = self.session.get(f'{SERVER_URL}/mdm/devices/{self.device_id}/commands/pending')
            
            if response.status_code == 200:
                commands = response.json()
                for command in commands:
                    self.execute_command(command)
                return True
            else:
                logger.warning(f"Command check failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.warning(f"Error checking for commands: {e}")
            return False
    
    def execute_command(self, command):
        """Execute a command received from the server"""
        command_id = command['id']
        command_type = command['commandType']
        
        logger.info(f"Executing command: {command_type} ({command_id})")
        
        try:
            # Update command status to executing
            self.update_command_status(command_id, 'executing', 
                                       output=f"Starting {command_type} command...")
            
            if command_type == 'lock':
                self.lock_device()
                self.update_command_status(command_id, 'completed', 
                                           output="Device locked successfully")
                
            elif command_type == 'shutdown':
                self.update_command_status(command_id, 'completed', 
                                           output="Shutdown command initiated")
                self.shutdown_device()
                
            elif command_type == 'restart':
                self.update_command_status(command_id, 'completed', 
                                           output="Restart command initiated")
                self.restart_device()
                
            elif command_type == 'wake':
                # Wake is handled by Wake-on-LAN, this is just acknowledgment
                self.update_command_status(command_id, 'completed', 
                                           output="Wake command acknowledged")
                
            elif command_type == 'custom':
                output = self.execute_custom_command(command.get('command', ''))
                self.update_command_status(command_id, 'completed', output=output)
                
            else:
                self.update_command_status(command_id, 'failed', 
                                           error_message=f"Unknown command type: {command_type}")
                
        except Exception as e:
            logger.error(f"Error executing command {command_type}: {e}")
            self.update_command_status(command_id, 'failed', error_message=str(e))
    
    def update_command_status(self, command_id, status, output=None, error_message=None, exit_code=None):
        """Update command execution status on server"""
        try:
            data = {
                'status': status,
                'output': output,
                'errorMessage': error_message,
                'exitCode': exit_code
            }
            
            response = self.session.put(f'{SERVER_URL}/mdm/commands/{command_id}/status',
                                        json=data)
            
            if response.status_code == 200:
                logger.debug(f"Command status updated: {command_id} -> {status}")
            else:
                logger.warning(f"Failed to update command status: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error updating command status: {e}")
    
    def lock_device(self):
        """Lock the device screen"""
        try:
            subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', 
                           '-suspend'], check=True)
            logger.info("Device locked successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to lock device: {e}")
            raise
    
    def shutdown_device(self):
        """Shutdown the device"""
        try:
            subprocess.run(['sudo', 'shutdown', '-h', 'now'], check=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to shutdown device: {e}")
            raise
    
    def restart_device(self):
        """Restart the device"""
        try:
            subprocess.run(['sudo', 'shutdown', '-r', 'now'], check=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to restart device: {e}")
            raise
    
    def execute_custom_command(self, command):
        """Execute a custom shell command"""
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=60)
            output = f"Exit code: {result.returncode}\nStdout:\n{result.stdout}\nStderr:\n{result.stderr}"
            return output
        except subprocess.TimeoutExpired:
            return "Command timed out after 60 seconds"
        except Exception as e:
            return f"Error executing command: {str(e)}"
    
    def heartbeat_loop(self):
        """Background thread for sending heartbeats"""
        while self.running:
            try:
                self.send_heartbeat()
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
            time.sleep(HEARTBEAT_INTERVAL)
    
    def command_loop(self):
        """Background thread for checking commands"""
        while self.running:
            try:
                self.check_for_commands()
            except Exception as e:
                logger.error(f"Error in command loop: {e}")
            time.sleep(COMMAND_CHECK_INTERVAL)
    
    def start(self):
        """Start the MDM agent"""
        logger.info(f"Starting ConfigMaster MDM Agent v{AGENT_VERSION}")
        logger.info(f"Device ID: {self.device_id}")
        logger.info(f"Device Name: {self.device_info['deviceName']}")
        logger.info(f"Server URL: {SERVER_URL}")
        
        # Enroll device
        if not self.enroll_device():
            logger.error("Device enrollment failed. Exiting.")
            return False
        
        self.running = True
        
        # Start background threads
        heartbeat_thread = threading.Thread(target=self.heartbeat_loop, daemon=True)
        command_thread = threading.Thread(target=self.command_loop, daemon=True)
        
        heartbeat_thread.start()
        command_thread.start()
        
        # Main loop
        try:
            logger.info("MDM Agent started successfully. Press Ctrl+C to stop.")
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Received interrupt signal. Stopping agent...")
            self.stop()
        
        return True
    
    def stop(self):
        """Stop the MDM agent"""
        self.running = False
        logger.info("MDM Agent stopped")

def signal_handler(signum, frame):
    """Handle system signals"""
    logger.info(f"Received signal {signum}. Shutting down gracefully...")
    agent.stop()
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Validate required parameters
    if not ENROLLMENT_KEY:
        print("Error: MDM_ENROLLMENT_KEY environment variable is required")
        sys.exit(1)
    
    # Create and start agent
    agent = MDMAgent()
    success = agent.start()
    
    if not success:
        sys.exit(1)
EOF

# Make the agent script executable
sudo chmod +x "$AGENT_DIR/configmaster-mdm-agent"

# Create the launch daemon plist
print_status "Creating launch daemon configuration..."
sudo tee "$LAUNCH_DAEMON_DIR/$PLIST_NAME" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.configmaster.mdm.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$AGENT_DIR/configmaster-mdm-agent</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>MDM_ENROLLMENT_KEY</key>
        <string>$ENROLLMENT_KEY</string>
        <key>MDM_SERVER_URL</key>
        <string>$SERVER_URL</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/configmaster-mdm-out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/configmaster-mdm-err.log</string>
    <key>UserName</key>
    <string>root</string>
    <key>WorkingDirectory</key>
    <string>/tmp</string>
</dict>
</plist>
EOF

# Install required Python packages
print_status "Installing required Python packages..."
pip3 install requests psutil 2>/dev/null || {
    print_warning "Could not install Python packages via pip3. Trying with sudo..."
    sudo pip3 install requests psutil 2>/dev/null || {
        print_warning "Could not install via pip3. Packages may need to be installed manually."
    }
}

# Try to install netifaces for better network detection (optional)
pip3 install netifaces 2>/dev/null || print_warning "Could not install netifaces (optional package)"

# Load and start the launch daemon
print_status "Loading and starting the MDM agent service..."
sudo launchctl load "$LAUNCH_DAEMON_DIR/$PLIST_NAME" 2>/dev/null || {
    print_warning "Could not load launch daemon. Starting manually for testing..."
    # Start the agent manually for immediate testing
    export MDM_ENROLLMENT_KEY="$ENROLLMENT_KEY"
    export MDM_SERVER_URL="$SERVER_URL"
    "$AGENT_DIR/configmaster-mdm-agent" &
    AGENT_PID=$!
    print_status "Agent started manually with PID: $AGENT_PID"
}

print_success "ConfigMaster MDM Agent installation completed!"
print_status "Configuration:"
print_status "  - Agent location: $AGENT_DIR/configmaster-mdm-agent"
print_status "  - Launch daemon: $LAUNCH_DAEMON_DIR/$PLIST_NAME"
print_status "  - Enrollment key: ${ENROLLMENT_KEY:0:8}..."
print_status "  - Server URL: $SERVER_URL"
print_status "  - Logs: /tmp/configmaster-mdm*.log"

print_status ""
print_status "The agent should now be running and will:"
print_status "  - Automatically enroll this MacBook with your MDM server"
print_status "  - Send heartbeats every 30 seconds"
print_status "  - Check for and execute remote commands"
print_status "  - Start automatically on system boot"

print_status ""
print_status "To check if the agent is running:"
print_status "  sudo launchctl list | grep configmaster"
print_status ""
print_status "To view logs:"
print_status "  tail -f /tmp/configmaster-mdm.log"
print_status ""
print_status "To uninstall:"
print_status "  sudo launchctl unload $LAUNCH_DAEMON_DIR/$PLIST_NAME"
print_status "  sudo rm $LAUNCH_DAEMON_DIR/$PLIST_NAME"
print_status "  sudo rm $AGENT_DIR/configmaster-mdm-agent"