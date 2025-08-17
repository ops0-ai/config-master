#!/usr/bin/env python3
"""
Test script for Pulse MDM Agent connectivity and functionality
"""

import os
import sys
import time
import json
import socket
import platform
import subprocess
import requests
from datetime import datetime
import uuid

# Configuration
ENROLLMENT_KEY = "c8aa11331654c99342ace0080a92eaf7f9db381fdc9b10fef0d908c396cd3dae"
SERVER_URL = "http://localhost:5005/api"

def get_device_id():
    """Generate unique device ID"""
    if platform.system() == 'Darwin':  # macOS
        try:
            cmd = "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/{gsub(/\"/,\"\");print $3}'"
            device_id = subprocess.check_output(cmd, shell=True).decode().strip()
        except:
            device_id = str(uuid.getnode())
    else:
        device_id = str(uuid.getnode())
    return device_id

def get_device_info():
    """Collect device information"""
    device_id = get_device_id()
    info = {
        'deviceId': device_id,
        'deviceName': socket.gethostname(),
        'hostname': socket.gethostname(),
        'osVersion': platform.version(),
        'architecture': platform.machine(),
        'platform': platform.system(),
    }
    
    # macOS specific info
    if platform.system() == 'Darwin':
        try:
            # Get serial number
            cmd = "system_profiler SPHardwareDataType | grep 'Serial Number' | awk '{print $4}'"
            info['serialNumber'] = subprocess.check_output(cmd, shell=True).decode().strip()
            
            # Get model
            cmd = "system_profiler SPHardwareDataType | grep 'Model Name' | cut -d: -f2"
            info['model'] = subprocess.check_output(cmd, shell=True).decode().strip()
            
            # Get macOS version
            cmd = "sw_vers -productVersion"
            info['osVersion'] = subprocess.check_output(cmd, shell=True).decode().strip()
        except:
            pass
    
    # Get IP address
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        info['ipAddress'] = s.getsockname()[0]
        s.close()
    except:
        info['ipAddress'] = '127.0.0.1'
    
    return info

def test_connectivity():
    """Test server connectivity"""
    print("🔗 Testing server connectivity...")
    try:
        response = requests.get(f"{SERVER_URL}/health", timeout=5)
        print(f"✅ Server reachable: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Server not reachable: {e}")
        return False

def test_enrollment():
    """Test device enrollment"""
    print("📱 Testing device enrollment...")
    device_info = get_device_info()
    device_info['enrollmentKey'] = ENROLLMENT_KEY
    device_info['agentVersion'] = '1.0.0-test'
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/enroll",
            json=device_info,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Device enrolled successfully: {response.status_code}")
            print(f"   Device ID: {device_info['deviceId']}")
            return device_info['deviceId']
        else:
            print(f"❌ Enrollment failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Enrollment error: {e}")
        return None

def test_heartbeat(device_id):
    """Test heartbeat functionality"""
    print("💓 Testing heartbeat...")
    heartbeat_data = {
        'status': 'online',
        'ipAddress': get_device_info()['ipAddress'],
        'batteryLevel': 85,
        'isCharging': False
    }
    
    try:
        response = requests.post(
            f"{SERVER_URL}/mdm/devices/{device_id}/heartbeat",
            json=heartbeat_data,
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Heartbeat sent successfully")
            return True
        else:
            print(f"❌ Heartbeat failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Heartbeat error: {e}")
        return False

def test_command_polling(device_id):
    """Test command polling"""
    print("🔍 Testing command polling...")
    try:
        response = requests.get(
            f"{SERVER_URL}/mdm/devices/{device_id}/commands/pending",
            timeout=10
        )
        
        if response.status_code == 200:
            commands = response.json()
            print(f"✅ Command polling successful - Found {len(commands)} pending commands")
            for cmd in commands:
                print(f"   Command: {cmd.get('commandType')} (ID: {cmd.get('id')})")
            return commands
        else:
            print(f"❌ Command polling failed: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"❌ Command polling error: {e}")
        return []

def test_lock_command():
    """Test lock command execution"""
    print("🔒 Testing lock command...")
    if platform.system() == 'Darwin':
        try:
            # Method 1: pmset displaysleepnow
            result = subprocess.run(['pmset', 'displaysleepnow'], capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Lock command works (pmset)")
                return True
            else:
                print(f"❌ pmset failed: {result.stderr}")
                
            # Method 2: osascript
            script = 'tell application "System Events" to key code 12 using {control down, command down}'
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Lock command works (osascript)")
                return True
            else:
                print(f"❌ osascript failed: {result.stderr}")
                
            return False
        except Exception as e:
            print(f"❌ Lock test error: {e}")
            return False
    else:
        print("⚠️ Lock test skipped (not macOS)")
        return True

def main():
    print("🚀 Pulse MDM Agent Test Suite")
    print("=" * 40)
    
    # Test 1: Connectivity
    if not test_connectivity():
        print("❌ Cannot proceed without server connectivity")
        return
    
    # Test 2: Enrollment
    device_id = test_enrollment()
    if not device_id:
        print("❌ Cannot proceed without successful enrollment")
        return
    
    # Test 3: Heartbeat
    test_heartbeat(device_id)
    
    # Test 4: Command polling
    commands = test_command_polling(device_id)
    
    # Test 5: Lock command
    test_lock_command()
    
    print("\n" + "=" * 40)
    print("🏁 Test completed!")
    print(f"Device ID: {device_id}")
    print("You can now try sending commands from the web UI.")

if __name__ == "__main__":
    main()