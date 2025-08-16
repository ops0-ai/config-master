'use client';

import { useState, useEffect } from 'react';
import {
  DevicePhoneMobileIcon,
  LockClosedIcon,
  PowerIcon,
  ArrowPathIcon,
  WifiIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  CommandLineIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { mdmApi } from '@/lib/api';

interface MDMDevice {
  id: string;
  deviceName: string;
  deviceId: string;
  serialNumber?: string;
  model?: string;
  osVersion?: string;
  architecture?: string;
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  status: 'online' | 'offline' | 'locked' | 'shutdown';
  lastSeen?: string;
  lastHeartbeat?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  agentVersion?: string;
  enrolledAt: string;
  isActive: boolean;
  metadata?: any;
}

interface MDMCommand {
  id: string;
  deviceId: string;
  commandType: 'lock' | 'unlock' | 'shutdown' | 'restart' | 'wake' | 'custom';
  command?: string;
  parameters?: any;
  status: 'pending' | 'sent' | 'executing' | 'completed' | 'failed' | 'timeout';
  output?: string;
  errorMessage?: string;
  exitCode?: number;
  sentAt?: string;
  startedAt?: string;
  completedAt?: string;
  timeout: number;
  initiatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function MDMManagement() {
  const [devices, setDevices] = useState<MDMDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MDMDevice | null>(null);
  const [deviceCommands, setDeviceCommands] = useState<MDMCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [enrollmentKey, setEnrollmentKey] = useState<string>('');

  useEffect(() => {
    loadDevices();
    loadEnrollmentKey();
    // Auto-refresh devices every 5 seconds for real-time updates
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDevices = async () => {
    try {
      const response = await mdmApi.getDevices();
      setDevices(response.data);
    } catch (error: any) {
      toast.error('Failed to load MDM devices');
    }
  };

  const loadEnrollmentKey = async () => {
    try {
      const response = await mdmApi.getProfiles();
      if (response.data && response.data.length > 0) {
        setEnrollmentKey(response.data[0].enrollmentKey);
      }
    } catch (error: any) {
      console.error('Failed to load enrollment key');
    }
  };

  const loadDeviceCommands = async (deviceId: string) => {
    try {
      const response = await mdmApi.getDeviceCommands(deviceId);
      setDeviceCommands(response.data);
    } catch (error: any) {
      toast.error('Failed to load device commands');
    }
  };

  const handleSendCommand = async (deviceId: string, commandType: 'lock' | 'unlock' | 'shutdown' | 'restart' | 'wake' | 'custom') => {
    try {
      await mdmApi.sendCommand(deviceId, { commandType });
      toast.success(`${commandType} command sent successfully`);
      if (selectedDevice && selectedDevice.deviceId === deviceId) {
        loadDeviceCommands(deviceId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to send ${commandType} command`);
    }
  };

  const handleDeleteDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Are you sure you want to delete device "${deviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await mdmApi.deleteDevice(deviceId);
      toast.success(`Device "${deviceName}" deleted successfully`);
      loadDevices(); // Refresh the device list
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to delete device`);
    }
  };

  const downloadAgentInstaller = () => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api'}/mdm/download/agent-installer`;
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pulse-mdm-agent-install.sh';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Pulse MDM agent installer download started');
  };

  const getActualStatus = (device: MDMDevice) => {
    // Check if device was explicitly uninstalled
    if (device.metadata?.uninstalled) {
      return 'uninstalled';
    }
    
    const lastTime = device.lastHeartbeat || device.lastSeen;
    if (!lastTime) return 'offline';
    
    const lastDate = new Date(lastTime);
    const twoMinutesAgo = new Date(Date.now() - 120000); // 2 minutes in milliseconds
    
    // If last heartbeat is older than 2 minutes, consider offline
    if (lastDate < twoMinutesAgo) {
      return 'offline';
    }
    
    return device.status || 'online';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircleIcon className="h-4 w-4 text-gray-400" />;
      case 'uninstalled':
        return <TrashIcon className="h-4 w-4 text-red-400" />;
      case 'locked':
        return <LockClosedIcon className="h-4 w-4 text-yellow-500" />;
      case 'shutdown':
        return <PowerIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCommandStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'timeout':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'executing':
        return <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'sent':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading && devices.length === 0) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pulse Device Management</h2>
          <p className="text-gray-600 mt-1">
            Manage Pulse agents and remotely control devices
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInstallInstructions(true)}
            className="btn btn-primary btn-sm"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
            Download Agent
          </button>
          <button
            onClick={loadDevices}
            className="btn btn-secondary btn-sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Refresh ({devices.length})
          </button>
        </div>
      </div>

      {/* Devices List */}
      <div className="space-y-4">
        {devices.map((device) => {
          const actualStatus = getActualStatus(device);
          return (
          <div key={device.id} className="card">
            <div className="card-content">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getStatusIcon(actualStatus)}
                    <h3 className="text-lg font-semibold text-gray-900">{device.deviceName}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                      actualStatus === 'online' 
                        ? 'bg-green-100 text-green-800'
                        : actualStatus === 'locked'
                        ? 'bg-yellow-100 text-yellow-800'
                        : actualStatus === 'shutdown'
                        ? 'bg-red-100 text-red-800'
                        : actualStatus === 'uninstalled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {actualStatus}
                    </span>
                    {device.agentVersion && (
                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                        Agent v{device.agentVersion}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-medium text-gray-700">Device Info:</span>
                      <div className="mt-1 space-y-1 text-gray-600">
                        {device.model && <div>Model: {device.model}</div>}
                        {device.serialNumber && <div>SN: {device.serialNumber}</div>}
                        {device.osVersion && <div>OS: {device.osVersion}</div>}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">Network:</span>
                      <div className="mt-1 space-y-1 text-gray-600">
                        {device.ipAddress && <div>IP: {device.ipAddress}</div>}
                        {device.hostname && <div>Host: {device.hostname}</div>}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">Power:</span>
                      <div className="mt-1 space-y-1 text-gray-600">
                        {device.batteryLevel !== null && (
                          <div>Battery: {device.batteryLevel}%</div>
                        )}
                        {device.isCharging !== null && (
                          <div>{device.isCharging ? 'Charging' : 'Not Charging'}</div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium text-gray-700">Last Seen:</span>
                      <div className="mt-1 text-xs">
                        {(() => {
                          // If device is uninstalled, don't show as active
                          if (device.metadata?.uninstalled) {
                            const uninstalledAt = device.metadata.uninstalledAt;
                            return (
                              <div>
                                <span className="text-red-600">
                                  Agent uninstalled
                                </span>
                                {uninstalledAt && (
                                  <div className="text-xs text-gray-500">
                                    {new Date(uninstalledAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          const lastTime = device.lastHeartbeat || device.lastSeen;
                          if (!lastTime) {
                            return <span className="text-gray-500">Never</span>;
                          }
                          const lastDate = new Date(lastTime);
                          const isActive = lastDate > new Date(Date.now() - 60000);
                          const isRecent = lastDate > new Date(Date.now() - 300000);
                          
                          return (
                            <>
                              <span className={
                                isActive ? 'text-green-600 font-medium' 
                                : isRecent ? 'text-yellow-600'
                                : 'text-gray-600'
                              }>
                                {lastDate.toLocaleString()}
                              </span>
                              {isActive && (
                                <span className="ml-2 text-green-600">● Active</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {actualStatus === 'online' && (
                    <>
                      <button
                        onClick={() => handleSendCommand(device.deviceId, 'lock')}
                        className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-md"
                        title="Lock Device"
                      >
                        <LockClosedIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSendCommand(device.deviceId, 'restart')}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                        title="Restart Device"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSendCommand(device.deviceId, 'shutdown')}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                        title="Shutdown Device"
                      >
                        <PowerIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {actualStatus === 'shutdown' && (
                    <button
                      onClick={() => handleSendCommand(device.deviceId, 'wake')}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md"
                      title="Wake Device"
                    >
                      <WifiIcon className="h-4 w-4" />
                    </button>
                  )}
                  {actualStatus === 'uninstalled' && (
                    <span className="text-sm text-red-600 italic">
                      Agent removed - device inactive
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSelectedDevice(device);
                      loadDeviceCommands(device.deviceId);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Commands
                  </button>
                  <button
                    onClick={() => handleDeleteDevice(device.deviceId, device.deviceName)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                    title="Delete Device"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })}
        
        {devices.length === 0 && (
          <div className="text-center py-12">
            <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No devices enrolled</h3>
            <p className="mt-2 text-gray-600">
              Download and install the Pulse MDM agent on your devices to get started.
            </p>
            <button
              onClick={() => setShowInstallInstructions(true)}
              className="mt-4 btn btn-primary"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Download Agent Installer
            </button>
          </div>
        )}
      </div>

      {/* Device Commands Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Command History - {selectedDevice.deviceName}
              </h3>
              <button
                onClick={() => {
                  setSelectedDevice(null);
                  setDeviceCommands([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {deviceCommands.map((command) => (
                <div key={command.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getCommandStatusIcon(command.status)}
                      <span className="font-medium capitalize">{command.commandType}</span>
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                        command.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : command.status === 'failed' || command.status === 'timeout'
                          ? 'bg-red-100 text-red-800'
                          : command.status === 'executing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {command.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(command.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  {command.output && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Output:</p>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                        {command.output}
                      </pre>
                    </div>
                  )}
                  
                  {command.errorMessage && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-red-700">Error:</p>
                      <pre className="text-xs bg-red-50 p-2 rounded mt-1 whitespace-pre-wrap text-red-600">
                        {command.errorMessage}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
              
              {deviceCommands.length === 0 && (
                <div className="text-center py-8">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No commands yet</h3>
                  <p className="mt-2 text-gray-600">
                    Commands sent to this device will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Installation Instructions Modal */}
      {showInstallInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Pulse MDM Agent Installation
              </h3>
              <button
                onClick={() => setShowInstallInstructions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Simple Installation */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <CommandLineIcon className="h-5 w-5 mr-2 text-green-600" />
                  Simple Installation
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Download and run the Pulse MDM agent installer with your enrollment key:
                  </p>
                  {enrollmentKey && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-700 font-medium mb-1">Your Enrollment Key:</p>
                      <code className="text-xs text-blue-900 bg-blue-100 px-2 py-1 rounded font-mono break-all">
                        {enrollmentKey}
                      </code>
                    </div>
                  )}
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <div># Method 1: Direct download and install</div>
                    <div>curl -L -o pulse-install.sh "{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api'}/mdm/download/agent-installer"</div>
                    <div>chmod +x pulse-install.sh</div>
                    <div>./pulse-install.sh {enrollmentKey || 'YOUR_ENROLLMENT_KEY'}</div>
                    <div></div>
                    <div># Method 2: One-line install</div>
                    <div>curl -L "{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api'}/mdm/download/agent-installer" | bash -s {enrollmentKey || 'YOUR_ENROLLMENT_KEY'}</div>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={downloadAgentInstaller}
                      className="btn btn-primary btn-sm"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Download Installer
                    </button>
                  </div>
                </div>
              </div>

              {/* What Gets Installed */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">What Gets Installed</h4>
                
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>• <strong>Pulse MDM Agent:</strong> LaunchAgent service for device management</p>
                    <p>• <strong>Python Dependencies:</strong> Required modules (requests, psutil, netifaces)</p>
                    <p>• <strong>Launch Agent:</strong> Runs as user service (no root required)</p>
                    <p>• <strong>Secure Enrollment:</strong> Device registers using your organization's enrollment key</p>
                    <p>• <strong>Real-time Status:</strong> Automatic heartbeat and status updates</p>
                  </div>
                  
                  <div className="mt-4 bg-blue-50 p-3 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>📱 Agent Features:</strong> Screen lock, display wake, custom commands, battery monitoring, and real-time status updates.
                    </p>
                  </div>
                  
                  <div className="mt-3 bg-yellow-50 p-3 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Note:</strong> LaunchAgent mode runs with user privileges. System shutdown/restart commands require admin rights.
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Verification</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">After installation, verify the agent is running:</p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm space-y-1">
                    <div># Check if Pulse agent is running</div>
                    <div>launchctl list | grep pulse</div>
                    <div></div>
                    <div># View agent logs</div>
                    <div>tail -f ~/Library/Logs/pulse-mdm.log</div>
                    <div></div>
                    <div># Check agent status</div>
                    <div>ps aux | grep pulse-mdm-agent</div>
                    <div></div>
                    <div># Manual restart if needed</div>
                    <div>launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist</div>
                    <div>launchctl load ~/Library/LaunchAgents/com.pulse.mdm.agent.plist</div>
                  </div>
                </div>
              </div>

              {/* Uninstallation */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <TrashIcon className="h-5 w-5 mr-2 text-red-600" />
                  Uninstallation
                </h4>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    To completely remove the Pulse MDM agent from your device:
                  </p>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-800 mb-2">Method 1: Download Uninstall Script</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                      <div># Download and run uninstall script</div>
                      <div>curl -L -o pulse-uninstall.sh \"{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api'}/mdm/download/uninstall-script\"</div>
                      <div>chmod +x pulse-uninstall.sh</div>
                      <div>./pulse-uninstall.sh</div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-red-800 mb-2">Method 2: Manual Uninstall</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm space-y-1 overflow-x-auto">
                      <div># Stop and unload LaunchAgent</div>
                      <div>launchctl unload ~/Library/LaunchAgents/com.pulse.mdm.agent.plist</div>
                      <div></div>
                      <div># Kill agent processes</div>
                      <div>pkill -f pulse-mdm-agent</div>
                      <div></div>
                      <div># Remove files</div>
                      <div>rm -rf ~/.pulse-mdm/</div>
                      <div>rm -f ~/Library/LaunchAgents/com.pulse.mdm.agent.plist</div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-100 p-3 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Note:</strong> After uninstalling, the device will remain visible in this console until manually deleted using the trash icon.
                    </p>
                  </div>
                </div>
              </div>

              {/* Support Information */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="text-md font-semibold text-yellow-900 mb-2">Need Help?</h4>
                <div className="text-sm text-yellow-800 space-y-1">
                  <p>• <strong>Permission Issues:</strong> Make sure you're running with sudo privileges</p>
                  <p>• <strong>Network Issues:</strong> Verify connectivity to the MDM server</p>
                  <p>• <strong>Agent Issues:</strong> Check the logs at /tmp/pulse-mdm.log</p>
                  <p>• <strong>Python Issues:</strong> Ensure system Python 3 is available</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowInstallInstructions(false)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}