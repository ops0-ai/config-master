#!/usr/bin/env python3
"""
Pulse MDM Agent - Device Management Agent for macOS/Linux
"""

import os
import sys
import time
import json
import socket
import platform
import subprocess
import threading
import logging
import requests
from datetime import datetime
import hashlib
import uuid

# Configuration
CONFIG_FILE = os.path.expanduser("~/.pulse-mdm/config.json")
LOG_FILE = os.path.expanduser("~/.pulse-mdm/agent.log")
HEARTBEAT_INTERVAL = 30  # seconds
COMMAND_POLL_INTERVAL = 10  # seconds

# Setup logging
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PulseMDMAgent:
    def __init__(self):
        self.config = self.load_config()
        self.device_id = self.get_device_id()
        self.running = True
        
    def load_config(self):
        """Load configuration from file or environment"""
        config = {
            'server_url': os.environ.get('PULSE_SERVER_URL', 'http://localhost:5005/api'),
            'enrollment_key': os.environ.get('PULSE_ENROLLMENT_KEY', ''),
            'device_id': None
        }
        
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r') as f:
                    saved_config = json.load(f)
                    config.update(saved_config)
            except Exception as e:
                logger.error(f"Failed to load config: {e}")
        
        return config
    
    def save_config(self):
        """Save configuration to file"""
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def get_device_id(self):
        """Generate or retrieve unique device ID"""
        if self.config.get('device_id'):
            return self.config['device_id']
        
        # Generate unique device ID based on hardware
        if platform.system() == 'Darwin':  # macOS
            try:
                cmd = "ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/{gsub(/\"/,\"\");print $3}'"
                device_id = subprocess.check_output(cmd, shell=True).decode().strip()
            except:
                device_id = str(uuid.getnode())
        else:
            device_id = str(uuid.getnode())
        
        self.config['device_id'] = device_id
        self.save_config()
        return device_id
    
    def get_device_info(self):
        """Collect device information"""
        info = {
            'deviceId': self.device_id,
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
        
        # Get battery info if available
        if platform.system() == 'Darwin':
            try:
                cmd = "pmset -g batt | grep -Eo '[0-9]+%' | head -1 | tr -d '%'"
                battery = subprocess.check_output(cmd, shell=True).decode().strip()
                info['batteryLevel'] = int(battery) if battery else None
                
                cmd = "pmset -g batt | grep 'AC Power'"
                info['isCharging'] = subprocess.call(cmd, shell=True, stdout=subprocess.DEVNULL) == 0
            except:
                pass
        
        return info
    
    def enroll(self):
        """Enroll device with MDM server"""
        if not self.config.get('enrollment_key'):
            logger.error("No enrollment key provided")
            return False
        
        logger.info("Enrolling device...")
        device_info = self.get_device_info()
        device_info['enrollmentKey'] = self.config['enrollment_key']
        device_info['agentVersion'] = '1.0.0'
        device_info['agentInstallPath'] = os.path.dirname(os.path.abspath(__file__))
        
        try:
            response = requests.post(
                f"{self.config['server_url']}/mdm/enroll",
                json=device_info,
                timeout=30
            )
            
            if response.status_code == 200:
                logger.info("Device enrolled successfully")
                return True
            else:
                logger.error(f"Enrollment failed: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Enrollment error: {e}")
            return False
    
    def send_heartbeat(self):
        """Send heartbeat to server"""
        device_info = self.get_device_info()
        heartbeat_data = {
            'status': 'online',
            'ipAddress': device_info.get('ipAddress'),
            'batteryLevel': device_info.get('batteryLevel'),
            'isCharging': device_info.get('isCharging', False)
        }
        
        try:
            response = requests.post(
                f"{self.config['server_url']}/mdm/devices/{self.device_id}/heartbeat",
                json=heartbeat_data,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.debug("Heartbeat sent successfully")
                return True
            else:
                logger.warning(f"Heartbeat failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")
            return False
    
    def poll_commands(self):
        """Poll for pending commands from server"""
        try:
            response = requests.get(
                f"{self.config['server_url']}/mdm/devices/{self.device_id}/commands/pending",
                timeout=10
            )
            
            if response.status_code == 200:
                commands = response.json()
                for command in commands:
                    self.execute_command(command)
            else:
                logger.debug(f"No pending commands or error: {response.status_code}")
        except Exception as e:
            logger.error(f"Command polling error: {e}")
    
    def execute_command(self, command):
        """Execute MDM command"""
        logger.info(f"Executing command: {command['commandType']}")
        command_id = command.get('id')
        command_type = command.get('commandType')
        
        result = {'status': 'failed', 'output': ''}
        
        try:
            if command_type == 'lock':
                # Lock screen (macOS) - use different methods
                if platform.system() == 'Darwin':
                    try:
                        # Method 1: Use pmset to lock screen
                        subprocess.run(['pmset', 'displaysleepnow'], check=True)
                        result = {'status': 'completed', 'output': 'Screen locked using pmset'}
                    except subprocess.CalledProcessError:
                        try:
                            # Method 2: Use osascript to lock screen
                            script = 'tell application "System Events" to key code 12 using {control down, command down}'
                            subprocess.run(['osascript', '-e', script], check=True)
                            result = {'status': 'completed', 'output': 'Screen locked using osascript'}
                        except subprocess.CalledProcessError:
                            try:
                                # Method 3: Use ScreenSaverEngine (immediate lock)
                                subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', '-suspend'], check=True)
                                result = {'status': 'completed', 'output': 'Screen locked using CGSession'}
                            except:
                                result = {'status': 'failed', 'output': 'All lock methods failed'}
            
            elif command_type == 'shutdown':
                # Schedule shutdown in 1 minute
                if platform.system() == 'Darwin':
                    try:
                        subprocess.run(['sudo', 'shutdown', '-h', '+1'], check=True)
                        result = {'status': 'completed', 'output': 'Shutdown scheduled in 1 minute'}
                    except subprocess.CalledProcessError as e:
                        result = {'status': 'failed', 'output': f'Shutdown failed: {e}'}
            
            elif command_type == 'restart':
                # Schedule restart in 1 minute
                if platform.system() == 'Darwin':
                    try:
                        subprocess.run(['sudo', 'shutdown', '-r', '+1'], check=True)
                        result = {'status': 'completed', 'output': 'Restart scheduled in 1 minute'}
                    except subprocess.CalledProcessError as e:
                        result = {'status': 'failed', 'output': f'Restart failed: {e}'}
            
            elif command_type == 'custom':
                # Execute custom command (with caution)
                cmd = command.get('command')
                if cmd and not any(danger in cmd for danger in ['rm -rf', 'format', 'del /f']):
                    try:
                        output = subprocess.check_output(cmd, shell=True, timeout=30).decode()
                        result = {'status': 'completed', 'output': output[:1000]}  # Limit output
                    except subprocess.CalledProcessError as e:
                        result = {'status': 'failed', 'output': f'Command failed: {e}'}
                    except subprocess.TimeoutExpired:
                        result = {'status': 'failed', 'output': 'Command timed out'}
                else:
                    result = {'status': 'failed', 'output': 'Command not allowed or dangerous'}
            
            else:
                result = {'status': 'failed', 'output': f'Unknown command type: {command_type}'}
        
        except Exception as e:
            result = {'status': 'failed', 'output': f'Execution error: {str(e)}'}
            logger.error(f"Command execution error: {e}")
        
        # Report command result
        if command_id:
            self.report_command_result(command_id, result)
    
    def report_command_result(self, command_id, result):
        """Report command execution result to server"""
        try:
            response = requests.put(
                f"{self.config['server_url']}/mdm/commands/{command_id}/status",
                json=result,
                timeout=10
            )
            if response.status_code == 200:
                logger.info(f"Command result reported: {result['status']}")
            else:
                logger.error(f"Failed to report result: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Failed to report command result: {e}")
    
    def heartbeat_thread(self):
        """Background thread for sending heartbeats"""
        while self.running:
            self.send_heartbeat()
            time.sleep(HEARTBEAT_INTERVAL)
    
    def command_thread(self):
        """Background thread for polling commands"""
        while self.running:
            self.poll_commands()
            time.sleep(COMMAND_POLL_INTERVAL)
    
    def run(self):
        """Main agent loop"""
        logger.info("Starting Pulse MDM Agent...")
        
        # Enroll device if needed
        if not self.enroll():
            logger.error("Failed to enroll device. Retrying in 60 seconds...")
            time.sleep(60)
            if not self.enroll():
                logger.error("Enrollment failed. Exiting.")
                return
        
        # Start background threads
        heartbeat = threading.Thread(target=self.heartbeat_thread, daemon=True)
        heartbeat.start()
        
        commands = threading.Thread(target=self.command_thread, daemon=True)
        commands.start()
        
        logger.info("Agent running. Press Ctrl+C to stop.")
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down agent...")
            self.running = False

if __name__ == "__main__":
    agent = PulseMDMAgent()
    agent.run()