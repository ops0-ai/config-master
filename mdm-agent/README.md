# ConfigMaster MDM Agent

A lightweight Python-based MDM (Mobile Device Management) agent for macOS devices that enables remote management and control of MacBooks through the ConfigMaster platform.

## Features

- **Device Enrollment**: Automatically enrolls MacBooks with the MDM server using enrollment keys
- **Remote Commands**: Execute commands remotely including:
  - Lock device screen
  - Shutdown device
  - Restart device
  - Wake device (via Wake-on-LAN)
  - Custom shell commands
- **Real-time Monitoring**: 
  - Device status tracking
  - Battery level and charging status
  - Network information
  - System information
- **Automatic Startup**: Runs as a system daemon and starts automatically on boot
- **Secure Communication**: HTTPS communication with the MDM server
- **Comprehensive Logging**: Detailed logs for troubleshooting and audit trails

## Requirements

- macOS 10.14 or later
- Python 3.6 or later
- Administrative privileges for installation
- Network connectivity to the MDM server

## Installation

### Automatic Installation

1. Download the installer script:
   ```bash
   curl -L -o install.sh https://your-server.com/mdm-agent/install.sh
   chmod +x install.sh
   ```

2. Run the installer with your enrollment key:
   ```bash
   sudo ./install.sh YOUR_ENROLLMENT_KEY [SERVER_URL]
   ```

   Example:
   ```bash
   sudo ./install.sh abc123def456ghi789 https://mdm.yourcompany.com/api
   ```

### Manual Installation

1. Copy the agent script to `/usr/local/bin/configmaster-mdm-agent`
2. Make it executable: `chmod +x /usr/local/bin/configmaster-mdm-agent`
3. Create the launch daemon plist in `/Library/LaunchDaemons/`
4. Load the daemon: `sudo launchctl load /Library/LaunchDaemons/com.configmaster.mdm.agent.plist`

## Configuration

The agent is configured through environment variables:

- `MDM_ENROLLMENT_KEY`: The enrollment key obtained from your MDM profile
- `MDM_SERVER_URL`: The base URL of your ConfigMaster API server (default: http://localhost:5005/api)

## Usage

### Getting Enrollment Keys

1. Log into your ConfigMaster dashboard
2. Go to Settings → MDM
3. Create a new MDM profile
4. Copy the enrollment key from the profile

### Device Enrollment Process

1. Install the agent using the enrollment key
2. The agent automatically:
   - Collects device information
   - Enrolls with the MDM server
   - Starts sending heartbeats
   - Begins listening for commands

### Supported Commands

| Command | Description | Requirements |
|---------|-------------|--------------|
| `lock` | Lock the device screen | User session active |
| `shutdown` | Shutdown the device | Admin privileges |
| `restart` | Restart the device | Admin privileges |
| `wake` | Wake device from sleep | Wake-on-LAN enabled |
| `custom` | Execute custom shell commands | Command permissions |

### Monitoring and Logs

- **Agent logs**: `/tmp/configmaster-mdm.log`
- **System output**: `/tmp/configmaster-mdm-out.log`
- **System errors**: `/tmp/configmaster-mdm-err.log`

View live logs:
```bash
tail -f /tmp/configmaster-mdm.log
```

### Service Management

Check if the agent is running:
```bash
sudo launchctl list | grep configmaster
```

Stop the agent:
```bash
sudo launchctl unload /Library/LaunchDaemons/com.configmaster.mdm.agent.plist
```

Start the agent:
```bash
sudo launchctl load /Library/LaunchDaemons/com.configmaster.mdm.agent.plist
```

## Security Considerations

### Permissions Required

- **System Administration**: Required for installation and service management
- **Network Access**: Required for communication with MDM server
- **Device Control**: Required for lock, shutdown, restart commands

### Security Features

- **Enrollment Key Authentication**: Devices must provide valid enrollment keys
- **HTTPS Communication**: All communication with server should use HTTPS in production
- **Command Validation**: All commands are validated before execution
- **Audit Logging**: All actions are logged for security auditing

### Best Practices

1. **Use HTTPS**: Always configure the server URL with HTTPS in production
2. **Rotate Enrollment Keys**: Regularly rotate enrollment keys and set expiration dates
3. **Monitor Logs**: Regularly review agent logs for security incidents
4. **Network Security**: Ensure proper firewall and network segmentation
5. **Least Privilege**: Only grant necessary permissions in MDM profiles

## Troubleshooting

### Common Issues

1. **Enrollment Failed**
   - Check enrollment key validity
   - Verify server URL accessibility
   - Check network connectivity
   - Review server logs for errors

2. **Agent Not Starting**
   - Check Python installation: `python3 --version`
   - Verify required packages: `pip3 list | grep requests`
   - Check launch daemon syntax: `plutil /Library/LaunchDaemons/com.configmaster.mdm.agent.plist`
   - Review system logs: `sudo tail -f /var/log/system.log | grep configmaster`

3. **Commands Not Executing**
   - Verify device is online in MDM dashboard
   - Check command permissions in MDM profile
   - Review agent logs for error messages
   - Ensure device is not in sleep mode

4. **Network Issues**
   - Test server connectivity: `curl -I https://your-server.com/api/health`
   - Check DNS resolution: `nslookup your-server.com`
   - Verify firewall settings
   - Check proxy configuration if applicable

### Debug Mode

Run the agent manually for debugging:
```bash
export MDM_ENROLLMENT_KEY="your_key"
export MDM_SERVER_URL="https://your-server.com/api"
sudo /usr/local/bin/configmaster-mdm-agent
```

## Uninstallation

To completely remove the agent:

```bash
# Stop and unload the service
sudo launchctl unload /Library/LaunchDaemons/com.configmaster.mdm.agent.plist

# Remove files
sudo rm /Library/LaunchDaemons/com.configmaster.mdm.agent.plist
sudo rm /usr/local/bin/configmaster-mdm-agent

# Clean up logs (optional)
rm /tmp/configmaster-mdm*.log
rm /tmp/configmaster-device-id
```

## API Integration

### Device Information Collected

The agent collects and reports:

```json
{
  "deviceName": "Johns-MacBook-Pro",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "serialNumber": "C02XK0AHJG5H",
  "model": "MacBookPro16,1",
  "osVersion": "12.6.3",
  "architecture": "arm64",
  "ipAddress": "192.168.1.100",
  "macAddress": "88:66:5A:12:34:56",
  "hostname": "Johns-MacBook-Pro.local",
  "batteryLevel": 85,
  "isCharging": true,
  "agentVersion": "1.0.0"
}
```

### Command Response Format

```json
{
  "id": "cmd-123",
  "status": "completed",
  "output": "Command executed successfully",
  "exitCode": 0,
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:05Z"
}
```

## Support

For support and issues:

1. Check the troubleshooting section above
2. Review agent logs for error messages
3. Check server-side logs and configuration
4. Contact your system administrator or ConfigMaster support

## License

This software is part of the ConfigMaster platform. See your license agreement for terms and conditions.