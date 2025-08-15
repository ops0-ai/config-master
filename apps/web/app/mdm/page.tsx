'use client';

import { useState, useEffect } from 'react';
import {
  DevicePhoneMobileIcon,
  UserGroupIcon,
  ChartBarIcon,
  WifiIcon,
  LockClosedIcon,
  PowerIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { mdmApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';

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

interface MDMStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  recentCommands: number;
}

function MDMDashboard() {
  const [devices, setDevices] = useState<MDMDevice[]>([]);
  const [stats, setStats] = useState<MDMStats>({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    recentCommands: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [bulkCommand, setBulkCommand] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await mdmApi.getDevices();
      const deviceList = response.data;
      setDevices(deviceList);
      
      // Calculate stats
      const stats = deviceList.reduce(
        (acc: MDMStats, device: MDMDevice) => {
          acc.totalDevices++;
          if (device.status === 'online') {
            acc.onlineDevices++;
          } else {
            acc.offlineDevices++;
          }
          return acc;
        },
        { totalDevices: 0, onlineDevices: 0, offlineDevices: 0, recentCommands: 0 }
      );
      setStats(stats);
    } catch (error: any) {
      toast.error('Failed to load MDM devices');
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCommand = async (deviceId: string, commandType: 'lock' | 'unlock' | 'shutdown' | 'restart' | 'wake' | 'custom') => {
    try {
      await mdmApi.sendCommand(deviceId, { commandType });
      toast.success(`${commandType} command sent successfully`);
      // Refresh device list to show updated status
      setTimeout(loadDevices, 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to send ${commandType} command`);
    }
  };

  const handleBulkCommand = async () => {
    if (!bulkCommand || selectedDevices.length === 0) {
      toast.error('Please select devices and a command');
      return;
    }

    try {
      const promises = selectedDevices.map(deviceId => 
        mdmApi.sendCommand(deviceId, { commandType: bulkCommand as any })
      );
      
      await Promise.all(promises);
      toast.success(`${bulkCommand} command sent to ${selectedDevices.length} devices`);
      setSelectedDevices([]);
      setBulkCommand('');
      setTimeout(loadDevices, 2000);
    } catch (error: any) {
      toast.error(`Failed to send bulk ${bulkCommand} command`);
    }
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAllDevices = () => {
    const filteredDevices = getFilteredDevices();
    const allSelected = filteredDevices.every(device => selectedDevices.includes(device.deviceId));
    
    if (allSelected) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(filteredDevices.map(device => device.deviceId));
    }
  };

  const getFilteredDevices = () => {
    return devices.filter(device => {
      const matchesSearch = device.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           device.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           device.hostname?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <XCircleIcon className="h-5 w-5 text-gray-400" />;
      case 'locked':
        return <LockClosedIcon className="h-5 w-5 text-yellow-500" />;
      case 'shutdown':
        return <PowerIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Never';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
              </div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredDevices = getFilteredDevices();

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title flex items-center">
                <DevicePhoneMobileIcon className="h-8 w-8 text-blue-600 mr-3" />
                Mobile Device Management
              </h1>
              <p className="text-muted mt-1">
                Monitor and control your MacBook devices remotely
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{stats.totalDevices}</div>
              <div className="text-sm text-gray-500">Total Devices</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.onlineDevices}</div>
                <div className="text-sm text-gray-500">Online</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-gray-100">
                <XCircleIcon className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.offlineDevices}</div>
                <div className="text-sm text-gray-500">Offline</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <UserGroupIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{devices.filter(d => d.profile).length}</div>
                <div className="text-sm text-gray-500">Enrolled</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{Math.round(stats.onlineDevices / stats.totalDevices * 100) || 0}%</div>
                <div className="text-sm text-gray-500">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls and Filters */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input"
                >
                  <option value="all">All Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="locked">Locked</option>
                  <option value="shutdown">Shutdown</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedDevices.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedDevices.length} selected
                </span>
                <select
                  value={bulkCommand}
                  onChange={(e) => setBulkCommand(e.target.value)}
                  className="input"
                >
                  <option value="">Select Command</option>
                  <option value="lock">Lock</option>
                  <option value="restart">Restart</option>
                  <option value="shutdown">Shutdown</option>
                </select>
                <button
                  onClick={handleBulkCommand}
                  disabled={!bulkCommand}
                  className="btn btn-primary btn-sm"
                >
                  Execute
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Device List */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Devices ({filteredDevices.length})
              </h2>
              {devices.length > 0 && (
                <button
                  onClick={selectAllDevices}
                  className="btn btn-secondary btn-sm"
                >
                  {filteredDevices.every(device => selectedDevices.includes(device.deviceId))
                    ? 'Deselect All'
                    : 'Select All'
                  }
                </button>
              )}
            </div>
          </div>

          {filteredDevices.length === 0 ? (
            <div className="text-center py-12">
              <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                {devices.length === 0 ? 'No devices enrolled' : 'No devices match your filters'}
              </h3>
              <p className="mt-2 text-gray-600">
                {devices.length === 0
                  ? 'Create an MDM profile and use the enrollment key to register devices.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredDevices.map((device) => (
                <div key={device.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedDevices.includes(device.deviceId)}
                        onChange={() => toggleDeviceSelection(device.deviceId)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(device.status)}
                          <h3 className="text-lg font-semibold text-gray-900">
                            {device.deviceName}
                          </h3>
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <div className="font-medium text-gray-700">Device Info</div>
                            {device.model && <div>Model: {device.model}</div>}
                            {device.serialNumber && <div>SN: {device.serialNumber}</div>}
                            {device.osVersion && <div>OS: {device.osVersion}</div>}
                          </div>
                          
                          <div>
                            <div className="font-medium text-gray-700">Network</div>
                            {device.ipAddress && <div>IP: {device.ipAddress}</div>}
                            {device.hostname && <div>Host: {device.hostname}</div>}
                          </div>
                          
                          <div>
                            <div className="font-medium text-gray-700">Power</div>
                            {device.batteryLevel !== null && device.batteryLevel !== undefined && (
                              <div className="flex items-center space-x-1">
                                <span>Battery: {device.batteryLevel}%</span>
                                {device.isCharging && (
                                  <span className="text-green-600 text-xs">⚡</span>
                                )}
                              </div>
                            )}
                            {device.agentVersion && <div>Agent: v{device.agentVersion}</div>}
                          </div>
                          
                          <div>
                            <div className="font-medium text-gray-700">Activity</div>
                            <div>Last seen: {formatLastSeen(device.lastSeen)}</div>
                            <div>Enrolled: {new Date(device.enrolledAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {device.status === 'online' && (
                        <>
                          <button
                            onClick={() => handleSendCommand(device.deviceId, 'lock')}
                            className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50 rounded-md"
                            title="Lock Device"
                          >
                            <LockClosedIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleSendCommand(device.deviceId, 'restart')}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                            title="Restart Device"
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleSendCommand(device.deviceId, 'shutdown')}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                            title="Shutdown Device"
                          >
                            <PowerIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {device.status === 'shutdown' && (
                        <button
                          onClick={() => handleSendCommand(device.deviceId, 'wake')}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md"
                          title="Wake Device"
                        >
                          <WifiIcon className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md"
                        title="View Details"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default function MDMPage() {
  return (
    <Layout>
      <MDMDashboard />
    </Layout>
  );
}