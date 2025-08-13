'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  DevicePhoneMobileIcon,
  KeyIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentDuplicateIcon,
  LockClosedIcon,
  PowerIcon,
  ArrowPathIcon,
  WifiIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { mdmApi } from '@/lib/api';

interface MDMProfile {
  id: string;
  name: string;
  description?: string;
  profileType: 'macos' | 'windows' | 'ios' | 'android';
  allowRemoteCommands: boolean;
  allowLockDevice: boolean;
  allowShutdown: boolean;
  allowRestart: boolean;
  allowWakeOnLan: boolean;
  requireAuthentication: boolean;
  maxSessionDuration: number;
  allowedIpRanges: string[];
  enrollmentKey: string;
  enrollmentExpiresAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MDMDevice {
  id: string;
  profileId: string;
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
  profile?: {
    id: string;
    name: string;
    profileType: string;
  };
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
  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    profileType: 'macos' as const,
    allowRemoteCommands: true,
    allowLockDevice: true,
    allowShutdown: false,
    allowRestart: true,
    allowWakeOnLan: true,
    requireAuthentication: true,
    maxSessionDuration: 3600,
    allowedIpRanges: [] as string[],
    enrollmentExpiresAt: '',
  });

  useEffect(() => {
    loadDevices();
  }, []);


  const loadDevices = async () => {
    try {
      const response = await mdmApi.getDevices();
      setDevices(response.data);
    } catch (error: any) {
      toast.error('Failed to load MDM devices');
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

  const handleCreateProfile = async () => {
    try {
      setLoading(true);
      await mdmApi.createProfile(profileForm);
      toast.success('MDM profile created successfully');
      setShowCreateProfile(false);
      setProfileForm({
        name: '',
        description: '',
        profileType: 'macos',
        allowRemoteCommands: true,
        allowLockDevice: true,
        allowShutdown: false,
        allowRestart: true,
        allowWakeOnLan: true,
        requireAuthentication: true,
        maxSessionDuration: 3600,
        allowedIpRanges: [],
        enrollmentExpiresAt: '',
      });
      loadProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create MDM profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this MDM profile?')) return;

    try {
      await mdmApi.deleteProfile(profileId);
      toast.success('MDM profile deleted successfully');
      loadProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete MDM profile');
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

  const copyEnrollmentKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Enrollment key copied to clipboard');
  };

  const getApiBaseUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api';
  };

  const downloadWithToken = async (profileId: string, profileName: string, type: 'profile' | 'installer' | 'instructions') => {
    try {
      // Generate a temporary download token
      const response = await mdmApi.generateDownloadToken(profileId, type);
      const token = response.data.token;
      
      // Create download URL with token using the full API base URL
      const url = `${getApiBaseUrl()}/mdm/download/${token}`;
      
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const typeNames = {
        'profile': 'MDM profile',
        'installer': 'MDM installer',
        'instructions': 'installation instructions'
      };
      
      toast.success(`${typeNames[type]} download started`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Download failed');
    }
  };

  const downloadProfile = (profileId: string, profileName: string) => {
    downloadWithToken(profileId, profileName, 'profile');
  };

  const downloadInstaller = (profileId: string, profileName: string) => {
    downloadWithToken(profileId, profileName, 'installer');
  };

  const downloadInstructions = (profileId: string, profileName: string) => {
    downloadWithToken(profileId, profileName, 'instructions');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircleIcon className="h-4 w-4 text-gray-400" />;
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

  if (loading && profiles.length === 0) {
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
          <h2 className="text-2xl font-bold text-gray-900">Mobile Device Management</h2>
          <p className="text-gray-600 mt-1">
            Manage Pulse MDM agents and remotely control devices
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInstallInstructions(true)}
            className="btn btn-primary btn-sm"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
            Download Agent Installer
          </button>
          <button
            onClick={loadDevices}
            className="btn btn-secondary btn-sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Refresh Devices
          </button>
        </div>
      </div>

      {/* Profiles Tab */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="card">
              <div className="card-content">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <DevicePhoneMobileIcon className="h-5 w-5 text-primary-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        profile.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {profile.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full capitalize">
                        {profile.profileType}
                      </span>
                    </div>
                    {profile.description && (
                      <p className="text-gray-600 mb-3">{profile.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Permissions:</span>
                        <div className="mt-1 space-y-1">
                          {profile.allowRemoteCommands && (
                            <div className="flex items-center text-green-600">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Remote Commands
                            </div>
                          )}
                          {profile.allowLockDevice && (
                            <div className="flex items-center text-green-600">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Lock Device
                            </div>
                          )}
                          {profile.allowRestart && (
                            <div className="flex items-center text-green-600">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Restart
                            </div>
                          )}
                          {profile.allowShutdown && (
                            <div className="flex items-center text-green-600">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Shutdown
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-700">Security:</span>
                        <div className="mt-1 space-y-1">
                          <div className="text-gray-600">
                            Auth: {profile.requireAuthentication ? 'Required' : 'Optional'}
                          </div>
                          <div className="text-gray-600">
                            Session: {Math.floor(profile.maxSessionDuration / 60)}m
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-700">Enrollment Key:</span>
                        <div className="mt-1 flex items-center space-x-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {showEnrollmentKey === profile.id 
                              ? profile.enrollmentKey 
                              : profile.enrollmentKey.substring(0, 8) + '...'
                            }
                          </code>
                          <button
                            onClick={() => setShowEnrollmentKey(
                              showEnrollmentKey === profile.id ? null : profile.id
                            )}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {showEnrollmentKey === profile.id ? (
                              <EyeSlashIcon className="h-4 w-4" />
                            ) : (
                              <EyeIcon className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => copyEnrollmentKey(profile.enrollmentKey)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-gray-700">Created:</span>
                        <div className="mt-1 text-gray-600 text-xs">
                          {new Date(profile.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowInstallInstructions(profile)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                      title="Installation Instructions"
                    >
                      <InformationCircleIcon className="h-4 w-4" />
                    </button>
                    <div className="relative group">
                      <button
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md"
                        title="Download Options"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => downloadInstaller(profile.id, profile.name)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
                          >
                            <CommandLineIcon className="h-4 w-4 mr-2" />
                            Pulse Agent Installer
                          </button>
                          <button
                            onClick={() => setShowInstallInstructions(profile)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md flex items-center"
                          >
                            <InformationCircleIcon className="h-4 w-4 mr-2" />
                            Setup Instructions
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                      title="Delete Profile"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          {devices.map((device) => (
            <div key={device.id} className="card">
              <div className="card-content">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusIcon(device.status)}
                      <h3 className="text-lg font-semibold text-gray-900">{device.deviceName}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                        device.status === 'online' 
                          ? 'bg-green-100 text-green-800'
                          : device.status === 'locked'
                          ? 'bg-yellow-100 text-yellow-800'
                          : device.status === 'shutdown'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {device.status}
                      </span>
                      {device.profile && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {device.profile.name}
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
                        <div className="mt-1 text-gray-600 text-xs">
                          {device.lastSeen 
                            ? new Date(device.lastSeen).toLocaleString()
                            : 'Never'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {device.status === 'online' && (
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
                    {device.status === 'shutdown' && (
                      <button
                        onClick={() => handleSendCommand(device.deviceId, 'wake')}
                        className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md"
                        title="Wake Device"
                      >
                        <WifiIcon className="h-4 w-4" />
                      </button>
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
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {devices.length === 0 && (
            <div className="text-center py-12">
              <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No devices enrolled</h3>
              <p className="mt-2 text-gray-600">
                Create a profile first, then download and install the Pulse MDM agent on your devices.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Profile Modal */}
      {showCreateProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Create MDM Profile</h3>
              <button
                onClick={() => setShowCreateProfile(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                    className="input"
                    placeholder="MacBook Management"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Device Type
                  </label>
                  <select
                    value={profileForm.profileType}
                    onChange={(e) => setProfileForm({...profileForm, profileType: e.target.value as any})}
                    className="input"
                  >
                    <option value="macos">macOS</option>
                    <option value="windows">Windows</option>
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({...profileForm, description: e.target.value})}
                  className="input"
                  rows={3}
                  placeholder="Profile description..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileForm.allowRemoteCommands}
                      onChange={(e) => setProfileForm({...profileForm, allowRemoteCommands: e.target.checked})}
                      className="mr-2"
                    />
                    Allow Remote Commands
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileForm.allowLockDevice}
                      onChange={(e) => setProfileForm({...profileForm, allowLockDevice: e.target.checked})}
                      className="mr-2"
                    />
                    Allow Lock Device
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileForm.allowRestart}
                      onChange={(e) => setProfileForm({...profileForm, allowRestart: e.target.checked})}
                      className="mr-2"
                    />
                    Allow Restart
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={profileForm.allowShutdown}
                      onChange={(e) => setProfileForm({...profileForm, allowShutdown: e.target.checked})}
                      className="mr-2"
                    />
                    Allow Shutdown
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Session Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={Math.floor(profileForm.maxSessionDuration / 60)}
                    onChange={(e) => setProfileForm({...profileForm, maxSessionDuration: parseInt(e.target.value) * 60})}
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enrollment Expires (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={profileForm.enrollmentExpiresAt}
                    onChange={(e) => setProfileForm({...profileForm, enrollmentExpiresAt: e.target.value})}
                    className="input"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateProfile(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProfile}
                disabled={loading || !profileForm.name}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                Installation Instructions - {showInstallInstructions.name}
              </h3>
              <button
                onClick={() => setShowInstallInstructions(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Agent Installation */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <CommandLineIcon className="h-5 w-5 mr-2 text-green-600" />
                  Pulse MDM Agent Installation
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Download and install the Pulse MDM agent:
                  </p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <div># Download the agent installer</div>
                    <div>curl -L -o pulse-install.sh "{getApiBaseUrl()}/mdm/download/agent-installer"</div>
                    <div></div>
                    <div># Make executable and run</div>
                    <div>chmod +x pulse-install.sh</div>
                    <div>sudo ./pulse-install.sh {showInstallInstructions.enrollmentKey} {getApiBaseUrl()}</div>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={() => downloadInstaller(showInstallInstructions.id, showInstallInstructions.name)}
                      className="btn btn-primary btn-sm"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Download Pulse Agent
                    </button>
                  </div>
                </div>
              </div>

              {/* What Gets Installed */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">What Gets Installed</h4>
                
                <div className="border rounded-lg p-4">
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>• <strong>Pulse MDM Agent:</strong> Background service for device management</p>
                    <p>• <strong>Python Dependencies:</strong> Required modules (requests, psutil, netifaces)</p>
                    <p>• <strong>Launch Daemon:</strong> Ensures agent starts on boot</p>
                    <p>• <strong>Secure Communication:</strong> Encrypted connection to MDM server</p>
                  </div>
                  
                  <div className="mt-4 bg-blue-50 p-3 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>📱 Agent Features:</strong> Remote lock, restart, shutdown, custom commands, battery monitoring, and real-time status updates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Enrollment Information */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-md font-semibold text-blue-900 mb-2">Enrollment Information</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Profile:</strong> {showInstallInstructions.name}</p>
                  <p><strong>Type:</strong> {showInstallInstructions.profileType}</p>
                  <p><strong>Enrollment Key:</strong> 
                    <code className="ml-2 bg-blue-200 px-2 py-1 rounded text-xs">
                      {showInstallInstructions.enrollmentKey}
                    </code>
                  </p>
                </div>
              </div>

              {/* Verification Steps */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">Verification</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">After installation, verify the agent is running:</p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm space-y-1">
                    <div># Check if Pulse agent is running</div>
                    <div>sudo launchctl list | grep pulse</div>
                    <div></div>
                    <div># View agent logs</div>
                    <div>tail -f /tmp/pulse-mdm.log</div>
                    <div></div>
                    <div># Agent status check</div>
                    <div>ps aux | grep pulse-mdm-agent</div>
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
                onClick={() => downloadInstructions(showInstallInstructions.id, showInstallInstructions.name)}
                className="btn btn-secondary"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Download Instructions
              </button>
              <button
                onClick={() => setShowInstallInstructions(null)}
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