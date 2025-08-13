#!/bin/bash

# Pulse MDM Agent - Test Installation (Demo Mode)
# Usage: ./test-install.sh <enrollment_key> [server_url]

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
print_status "🚀 Pulse MDM Agent Installation (DEMO MODE)"
print_status "Enrollment Key: ${ENROLLMENT_KEY:0:8}..."
print_status "Server URL: $SERVER_URL"
print_status "================================================"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This installer is only for macOS systems"
    exit 1
fi

print_status "📱 Step 1: Would install Python dependencies..."
print_success "Python dependencies would be installed globally"

print_status "🤖 Step 2: Would create Pulse MDM agent..."

# Create a test agent script in /tmp instead of /usr/local/bin
cat > /tmp/pulse-mdm-agent-test << 'AGENT_EOF'
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
    print("Please run: /usr/bin/python3 -m pip install requests psutil netifaces --break-system-packages")
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
        logging.FileHandler('/tmp/pulse-mdm-test.log'),
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
            for line in result.stdout.split('\n'):
                if 'Model Name' in line:
                    return line.split(':')[1].strip()
        except:
            pass
        return 'Unknown Mac'
    
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
    
    def run_test(self):
        """Test enrollment"""
        logger.info("🚀 Testing Pulse MDM Agent")
        logger.info(f"Device ID: {self.device_id}")
        logger.info(f"Device Name: {self.device_info['deviceName']}")
        logger.info(f"Server URL: {SERVER_URL}")
        
        # Test enrollment
        if self.enroll_device():
            logger.info("✅ Test enrollment successful!")
            return True
        else:
            logger.error("❌ Test enrollment failed")
            return False

if __name__ == '__main__':
    if ENROLLMENT_KEY == 'PLACEHOLDER_ENROLLMENT_KEY':
        print("❌ Enrollment key not configured!")
        print("Please set PULSE_ENROLLMENT_KEY environment variable")
        sys.exit(1)
    
    agent = PulseMDMAgent()
    success = agent.run_test()
    sys.exit(0 if success else 1)
AGENT_EOF

# Replace placeholders with actual values
sed -i '' "s/PLACEHOLDER_ENROLLMENT_KEY/$ENROLLMENT_KEY/g" /tmp/pulse-mdm-agent-test
sed -i '' "s|PLACEHOLDER_SERVER_URL|$SERVER_URL|g" /tmp/pulse-mdm-agent-test

# Make agent executable
chmod +x /tmp/pulse-mdm-agent-test

print_success "Test Pulse MDM agent created at /tmp/pulse-mdm-agent-test"

print_status "⚙️ Step 3: Would create launch daemon..."
print_success "Launch daemon would be created at /Library/LaunchDaemons/com.pulse.mdm.agent.plist"

print_status "🔄 Step 4: Testing enrollment..."

# Test the agent by running it once
if /tmp/pulse-mdm-agent-test; then
    print_success "✅ Test enrollment successful!"
else
    print_warning "⚠️ Test enrollment failed - check server connectivity"
fi

print_status ""
print_status "================================================"
print_success "🎉 Pulse MDM Agent Test Complete!"
print_status "================================================"
print_status ""
print_status "📊 Test Results:"
print_status "  • Agent: /tmp/pulse-mdm-agent-test"
print_status "  • Logs: /tmp/pulse-mdm-test.log"
print_status ""
print_status "🔧 To install for real, run with sudo:"
print_status "  sudo ./simple-install.sh $ENROLLMENT_KEY $SERVER_URL"
print_status ""
print_status "📋 View test logs:"
print_status "  tail -f /tmp/pulse-mdm-test.log"
print_status ""