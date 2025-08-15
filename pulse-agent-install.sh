#!/bin/bash

# Pulse MDM Agent Quick Installer
# Usage: ./pulse-agent-install.sh

set -e

ENROLLMENT_KEY="82daaeaaee2ead070507255e5c4d662ab4bb786cdf13d271d6674f530008fa9b"
PULSE_SERVER_URL="http://localhost:5005/api"
AGENT_DIR="$HOME/.pulse-mdm"

echo "🚀 Installing Pulse MDM Agent"
echo "Server: $PULSE_SERVER_URL"
echo "Key: ${ENROLLMENT_KEY:0:20}..."

# Create agent directory
mkdir -p "$AGENT_DIR"
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs"

# Create the Python agent
cat > "$AGENT_DIR/pulse-agent.py" << 'AGENT_EOF'
#!/usr/bin/env python3
import os
import sys
import time
import json
import socket
import platform
import subprocess
import signal
import uuid
from datetime import datetime

try:
    import requests
except ImportError:
    print("Installing requests module...")
    subprocess.run([sys.executable, "-m", "pip", "install", "requests", "--quiet"], check=False)
    import requests

try:
    import psutil
except ImportError:
    print("Installing psutil module...")
    subprocess.run([sys.executable, "-m", "pip", "install", "psutil", "--quiet"], check=False)
    import psutil

# Configuration
ENROLLMENT_KEY = os.environ.get('PULSE_ENROLLMENT_KEY', '')
SERVER_URL = os.environ.get('PULSE_SERVER_URL', 'http://localhost:5005/api')
HEARTBEAT_INTERVAL = 30

def log(message):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    try:
        with open(os.path.expanduser('~/Library/Logs/pulse-agent.log'), 'a') as f:
            f.write(log_msg + '\n')
    except:
        pass

def get_device_id():
    id_file = os.path.expanduser('~/.pulse-mdm/device_id')
    if os.path.exists(id_file):
        with open(id_file, 'r') as f:
            return f.read().strip()
    
    device_id = str(uuid.uuid4())
    os.makedirs(os.path.dirname(id_file), exist_ok=True)
    with open(id_file, 'w') as f:
        f.write(device_id)
    return device_id

def get_device_info():
    try:
        # Get serial number
        serial = 'UNKNOWN'
        try:
            result = subprocess.run(['system_profiler', 'SPHardwareDataType'], 
                                  capture_output=True, text=True, timeout=5)
            for line in result.stdout.split('\n'):
                if 'Serial Number' in line:
                    serial = line.split(':')[1].strip()
                    break
        except:
            pass
        
        # Get IP address
        ip_address = socket.gethostbyname(socket.gethostname())
        
        # Get battery info
        battery = psutil.sensors_battery()
        battery_level = int(battery.percent) if battery else None
        is_charging = battery.power_plugged if battery else None
        
        return {
            'deviceName': socket.gethostname(),
            'deviceId': get_device_id(),
            'serialNumber': serial,
            'model': platform.machine(),
            'osVersion': platform.mac_ver()[0] if platform.system() == 'Darwin' else platform.version(),
            'architecture': platform.machine(),
            'hostname': socket.getfqdn(),
            'agentVersion': '1.0.0',
            'metadata': {
                'ipAddress': ip_address,
                'batteryLevel': battery_level,
                'isCharging': is_charging
            }
        }
    except Exception as e:
        log(f"Error getting device info: {e}")
        return {
            'deviceName': socket.gethostname(),
            'deviceId': get_device_id(),
            'osVersion': platform.version(),
            'agentVersion': '1.0.0'
        }

def enroll_device():
    log("Enrolling device...")
    
    device_info = get_device_info()
    device_info['enrollmentKey'] = ENROLLMENT_KEY
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/enroll",
            json=device_info,
            timeout=10
        )
        
        if response.status_code in [200, 201]:
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

def check_commands():
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
    log(f"Executing command: {command.get('commandType')}")
    
    command_id = command['id']
    command_type = command['commandType']
    
    try:
        if command_type == 'lock':
            # Try multiple methods to lock the screen
            try:
                # Method 1: Using pmset (works on most macOS versions)
                subprocess.run(['pmset', 'displaysleepnow'], check=True)
                report_command(command_id, 'completed', 'Display turned off')
            except:
                try:
                    # Method 2: Using osascript to trigger screen saver
                    subprocess.run(['osascript', '-e', 'tell application "System Events" to start current screen saver'], check=True)
                    report_command(command_id, 'completed', 'Screen saver started')
                except:
                    # Method 3: Old CGSession path (legacy)
                    try:
                        subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', '-suspend'])
                        report_command(command_id, 'completed', 'Screen locked (legacy)')
                    except:
                        report_command(command_id, 'failed', 'Could not lock screen - no working method found')
        
        elif command_type == 'wake':
            subprocess.run(['caffeinate', '-u', '-t', '2'])
            report_command(command_id, 'completed', 'Display awakened')
        
        else:
            report_command(command_id, 'failed', f'Unknown command: {command_type}')
    
    except Exception as e:
        report_command(command_id, 'failed', str(e))

def report_command(command_id, status, output):
    try:
        requests.put(
            f"{SERVER_URL}/mdm/commands/{command_id}/status",
            json={
                'status': status,
                'output': output,
                'completedAt': datetime.now().isoformat()
            },
            headers={'X-Enrollment-Key': ENROLLMENT_KEY},
            timeout=5
        )
    except:
        pass

def signal_handler(signum, frame):
    log("Agent stopping...")
    sys.exit(0)

def main():
    log("🚀 Pulse MDM Agent starting...")
    log(f"Server: {SERVER_URL}")
    log(f"Device ID: {get_device_id()}")
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Initial enrollment
    enrolled = enroll_device()
    if not enrolled:
        log("Waiting 30s before retry...")
        time.sleep(30)
    
    # Main loop
    last_heartbeat = 0
    while True:
        try:
            current_time = time.time()
            
            if current_time - last_heartbeat >= HEARTBEAT_INTERVAL:
                if not enrolled:
                    enrolled = enroll_device()
                
                if enrolled and send_heartbeat():
                    check_commands()
                
                last_heartbeat = current_time
            
            time.sleep(5)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f"Error: {e}")
            time.sleep(30)
    
    log("Agent stopped")

if __name__ == '__main__':
    main()
AGENT_EOF

# Make executable
chmod +x "$AGENT_DIR/pulse-agent.py"

# Create LaunchAgent plist
cat > "$HOME/Library/LaunchAgents/com.pulse.mdm.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.mdm</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_DIR/pulse-agent.py</string>
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
    <string>$HOME/Library/Logs/pulse-agent-out.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/pulse-agent-err.log</string>
</dict>
</plist>
PLIST_EOF

# Load the agent
echo "Starting agent..."
launchctl unload "$HOME/Library/LaunchAgents/com.pulse.mdm.plist" 2>/dev/null || true
launchctl load "$HOME/Library/LaunchAgents/com.pulse.mdm.plist"

# Verify
sleep 3
if launchctl list | grep -q "com.pulse.mdm"; then
    echo "✅ Pulse MDM agent installed and running!"
    echo ""
    echo "Commands:"
    echo "  Check status: launchctl list | grep pulse"
    echo "  View logs: tail -f ~/Library/Logs/pulse-agent.log"
    echo "  Stop: launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.plist"
    echo ""
    tail -5 ~/Library/Logs/pulse-agent.log 2>/dev/null || true
else
    echo "❌ Agent failed to start"
    echo "Check: ~/Library/Logs/pulse-agent-err.log"
    exit 1
fi