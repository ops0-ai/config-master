'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  ServerIcon,
  TrashIcon,
  PencilIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { serversApi, serverGroupsApi, pemKeysApi } from '@/lib/api';
import { useOrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';
import toast from 'react-hot-toast';

interface Server {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
  type: 'linux' | 'windows';
  username: string;
  operatingSystem?: string;
  osVersion?: string;
  status: 'online' | 'offline' | 'testing' | 'unknown';
  lastSeen?: string;
  groupId?: string;
  pemKeyId?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  group?: { id: string; name: string };
  pemKey?: { id: string; name: string };
}

interface ServerGroup {
  id: string;
  name: string;
  description?: string;
  defaultPemKeyId?: string;
}

interface PemKey {
  id: string;
  name: string;
  description?: string;
  fingerprint: string;
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const [pemKeys, setPemKeys] = useState<PemKey[]>([]);
  const [loading, setLoading] = useState(true);
  const { isFeatureEnabled } = useOrganizationFeatures();
  
  // Check if servers feature is enabled
  const serversEnabled = isFeatureEnabled('servers');
  const [showModal, setShowModal] = useState(false);
  const [showWindowsInstructions, setShowWindowsInstructions] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverTypeFilter, setServerTypeFilter] = useState<'all' | 'linux' | 'windows'>('all');

  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    ipAddress: '',
    port: 22,
    type: 'linux' as 'linux' | 'windows',
    username: 'root',
    password: '', // For Windows servers
    operatingSystem: '',
    osVersion: '',
    groupId: '',
    pemKeyId: '',
    metadata: {},
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Always load servers and PEM keys
      const promises = [
        serversApi.getAll(),
        pemKeysApi.getAll(),
      ];
      
      // Only load server groups if the serverGroups feature is enabled
      const serverGroupsEnabled = isFeatureEnabled('serverGroups');
      if (serverGroupsEnabled) {
        promises.push(serverGroupsApi.getAll());
      }
      
      const responses = await Promise.all(promises);
      const [serversRes, keysRes, groupsRes] = responses;

      setServers(serversRes.data);
      setPemKeys(keysRes.data);
      
      // Only set server groups if we fetched them
      if (serverGroupsEnabled && groupsRes) {
        setServerGroups(groupsRes.data);
      } else {
        setServerGroups([]); // Empty array if serverGroups feature is disabled
      }
    } catch (error) {
      toast.error('Failed to load servers data');
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare data based on server type
      const submitData = { ...formData };
      
      // For Linux servers, remove password field and ensure pemKeyId is set
      if (formData.type === 'linux') {
        delete (submitData as any).password;
      }
      // For Windows servers, remove pemKeyId field
      else if (formData.type === 'windows') {
        delete (submitData as any).pemKeyId;
      }
      
      if (editingServer) {
        await serversApi.update(editingServer.id, submitData);
        toast.success('Server updated successfully');
      } else {
        await serversApi.create(submitData);
        toast.success('Server created successfully');
      }
      
      await loadData();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save server');
    }
  };

  const handleEdit = (server: Server) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      hostname: server.hostname,
      ipAddress: server.ipAddress,
      port: server.port,
      type: server.type || 'linux',
      username: server.username,
      password: '', // Don't populate password for security - will keep existing if empty
      operatingSystem: server.operatingSystem || '',
      osVersion: server.osVersion || '',
      groupId: server.groupId || '',
      pemKeyId: server.pemKeyId || '',
      metadata: server.metadata || {},
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;

    try {
      await serversApi.delete(id);
      toast.success('Server deleted successfully');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete server');
    }
  };

  const testConnection = async (id: string) => {
    try {
      setTestingConnection(id);
      const response = await serversApi.testConnection(id);
      
      if (response.data.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error(`Connection failed: ${response.data.error}`);
      }
      
      await loadData(); // Refresh to get updated status
    } catch (error: any) {
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const handleServerTypeChange = (newType: 'linux' | 'windows') => {
    setFormData(prev => ({
      ...prev,
      type: newType,
      port: newType === 'windows' ? 5985 : 22,
      username: newType === 'windows' ? 'administrator' : 'root',
      password: '',
      pemKeyId: newType === 'windows' ? '' : prev.pemKeyId,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      hostname: '',
      ipAddress: '',
      port: 22,
      type: 'linux',
      username: 'root',
      password: '',
      operatingSystem: '',
      osVersion: '',
      groupId: '',
      pemKeyId: '',
      metadata: {},
    });
    setEditingServer(null);
    setShowModal(false);
  };

  // Filter servers based on search term and server type
  const filteredServers = servers.filter(server => {
    const matchesSearch = searchTerm === '' || 
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (server.operatingSystem && server.operatingSystem.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = serverTypeFilter === 'all' || 
      server.type === serverTypeFilter ||
      (!server.type && serverTypeFilter === 'linux'); // Default to linux for servers without type
    
    return matchesSearch && matchesType;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'offline':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'testing':
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return 'status-online';
      case 'offline':
        return 'status-offline';
      case 'testing':
        return 'status-testing';
      default:
        return 'status-unknown';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Feature Disabled Warning */}
      {!serversEnabled && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Servers feature is not enabled for your organization.</strong> 
                Please reach out to the support team for assistance to enable this feature.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="page-title">Servers</h1>
              <p className="text-muted mt-1">
                Manage your infrastructure servers and connections
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowWindowsInstructions(true)}
                className="btn btn-secondary btn-md"
                title="Windows Server Setup Instructions"
              >
                <InformationCircleIcon className="h-5 w-5 mr-2" />
                Windows Setup Guide
              </button>
              <button
                onClick={() => serversEnabled ? setShowModal(true) : toast.error('This feature is not enabled for your organization. Please reach out to the support team for assistance.')}
                className={`btn btn-md ${serversEnabled ? 'btn-primary' : 'btn-disabled cursor-not-allowed opacity-50'}`}
                disabled={!serversEnabled}
                title={serversEnabled ? undefined : 'This feature is not enabled for your organization'}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Server
              </button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search servers by name, hostname, IP, or OS..."
              />
              {searchTerm && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Filter:</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setServerTypeFilter('all')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      serverTypeFilter === 'all'
                        ? 'bg-primary-100 text-primary-800 border border-primary-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    All ({servers.length})
                  </button>
                  <button
                    onClick={() => setServerTypeFilter('linux')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center ${
                      serverTypeFilter === 'linux'
                        ? 'bg-primary-100 text-primary-800 border border-primary-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    🐧 Linux ({servers.filter(s => s.type === 'linux' || !s.type).length})
                  </button>
                  <button
                    onClick={() => setServerTypeFilter('windows')}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center ${
                      serverTypeFilter === 'windows'
                        ? 'bg-primary-100 text-primary-800 border border-primary-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    🪟 Windows ({servers.filter(s => s.type === 'windows').length})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          {(searchTerm || serverTypeFilter !== 'all') && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredServers.length} of {servers.length} servers
              {searchTerm && <span> matching "{searchTerm}"</span>}
              {serverTypeFilter !== 'all' && <span> • {serverTypeFilter} only</span>}
              {(searchTerm || serverTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setServerTypeFilter('all');
                  }}
                  className="ml-2 text-primary-600 hover:text-primary-800 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Servers Grid */}
          <div className="grid grid-cols-1 gap-6">
        {filteredServers.map((server) => (
          <div key={server.id} className="card hover:shadow-md transition-shadow">
            <div className="card-content">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary-100 rounded-lg">
                    <ServerIcon className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {server.name}
                      </h3>
                      {getStatusIcon(server.status)}
                      <span className={getStatusBadge(server.status)}>
                        {server.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                      <span>📍 {server.ipAddress}:{server.port}</span>
                      <span>{server.type === 'windows' ? '🪟' : '🐧'} {server.type === 'windows' ? 'Windows' : 'Linux'}</span>
                      <span>👤 {server.username}</span>
                      {server.operatingSystem && (
                        <span>💻 {server.operatingSystem} {server.osVersion}</span>
                      )}
                      {server.group && (
                        <span>🏷️ {server.group.name}</span>
                      )}
                      {server.type === 'linux' && server.pemKey && (
                        <span>🔑 {server.pemKey.name}</span>
                      )}
                      {server.type === 'windows' && (
                        <span>🔐 WinRM Authentication</span>
                      )}
                    </div>
                    {server.lastSeen && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last seen: {new Date(server.lastSeen).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => serversEnabled ? testConnection(server.id) : toast.error('This feature is not enabled for your organization. Please reach out to the support team for assistance.')}
                    disabled={testingConnection === server.id || !serversEnabled}
                    className={`btn btn-ghost btn-sm ${!serversEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={serversEnabled ? "Test Connection" : "This feature is not enabled for your organization"}
                  >
                    <WifiIcon className={`h-4 w-4 ${testingConnection === server.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => serversEnabled ? handleEdit(server) : toast.error('This feature is not enabled for your organization. Please reach out to the support team for assistance.')}
                    className={`btn btn-ghost btn-sm ${!serversEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!serversEnabled}
                    title={serversEnabled ? "Edit Server" : "This feature is not enabled for your organization"}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => serversEnabled ? handleDelete(server.id) : toast.error('This feature is not enabled for your organization. Please reach out to the support team for assistance.')}
                    className={`btn btn-ghost btn-sm text-red-600 hover:text-red-700 ${!serversEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!serversEnabled}
                    title={serversEnabled ? "Delete Server" : "This feature is not enabled for your organization"}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {servers.length === 0 && (
          <div className="text-center py-12">
            <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No servers yet</h3>
            <p className="text-gray-600 mb-6">Get started by adding your first server.</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary btn-md"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Server
            </button>
          </div>
        )}

        {servers.length > 0 && filteredServers.length === 0 && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No servers found</h3>
            <p className="text-gray-600 mb-6">
              No servers match your search criteria
              {searchTerm && <span> for "{searchTerm}"</span>}
              {serverTypeFilter !== 'all' && <span> in {serverTypeFilter} servers</span>}.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setServerTypeFilter('all');
              }}
              className="btn btn-secondary btn-md"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Clear filters
            </button>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingServer ? 'Edit Server' : 'Add New Server'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Server Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                    placeholder="web-server-01"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hostname *
                  </label>
                  <input
                    type="text"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="input"
                    required
                    placeholder="server.example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Address *
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="input"
                    required
                    placeholder="192.168.1.100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Server Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleServerTypeChange(e.target.value as 'linux' | 'windows')}
                    className="input"
                    required
                  >
                    <option value="linux">🐧 Linux (SSH)</option>
                    <option value="windows">🪟 Windows (WinRM)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.type === 'windows' ? 'WinRM Port' : 'SSH Port'}
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    max="65535"
                    placeholder={formData.type === 'windows' ? '5985' : '22'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="input"
                    placeholder="root"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Server Group
                  </label>
                  <select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a group...</option>
                    {serverGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Authentication fields - conditional based on server type */}
                {formData.type === 'linux' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PEM Key *
                    </label>
                    <select
                      value={formData.pemKeyId}
                      onChange={(e) => setFormData({ ...formData, pemKeyId: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">Select a PEM key...</option>
                      {pemKeys.map((key) => (
                        <option key={key.id} value={key.id}>
                          {key.name} ({key.fingerprint?.substring(0, 16)}...)
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Private key for SSH authentication
                    </p>
                  </div>
                ) : formData.type === 'windows' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password {!editingServer ? '*' : '(optional)'}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input"
                      required={formData.type === 'windows' && !editingServer}
                      placeholder={editingServer ? "Leave empty to keep existing password" : "Enter WinRM password"}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editingServer 
                        ? "Password is saved. Leave empty to keep existing password, or enter new password to change it."
                        : "Password for WinRM authentication"
                      }
                    </p>
                  </div>
                ) : null}
              </div>
              
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary btn-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md"
                >
                  {editingServer ? 'Update Server' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Windows Setup Instructions Modal */}
      {showWindowsInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold text-gray-900">
                🪟 Windows Server WinRM Setup Instructions
              </h2>
              <button
                onClick={() => setShowWindowsInstructions(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                  <div className="flex">
                    <InformationCircleIcon className="h-6 w-6 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-800 mb-2">
                        Required Setup for Windows Servers
                      </h3>
                      <p className="text-sm text-blue-700">
                        Before adding a Windows server, you must configure WinRM (Windows Remote Management) 
                        on the target server. Run the following PowerShell commands as Administrator.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-3">
                      1
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Enable WinRM Service
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Enables the WinRM service and sets up the HTTP listener
                  </p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <code>Enable-PSRemoting -Force</code>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-3">
                      2
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Configure Firewall
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Opens port 5985 for all network profiles
                  </p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <pre><code>{`$firewallParams = @{
    Action      = 'Allow'
    Description = 'Inbound rule for Windows Remote Management via WS-Management. [TCP 5985]'
    Direction   = 'Inbound'
    DisplayName = 'Windows Remote Management (HTTP-In)'
    LocalPort   = 5985
    Profile     = 'Any'
    Protocol    = 'TCP'
}
New-NetFirewallRule @firewallParams`}</code></pre>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-3">
                      3
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Enable Local Account Access
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Allows local user accounts to be used with WinRM (ignore if using domain accounts)
                  </p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <pre><code>{`$tokenFilterParams = @{
    Path         = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System'
    Name         = 'LocalAccountTokenFilterPolicy'
    Value        = 1
    PropertyType = 'DWORD'
    Force        = $true
}
New-ItemProperty @tokenFilterParams`}</code></pre>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-3">
                      4
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Enable Basic Authentication
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Configure WinRM to accept basic authentication
                  </p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <code>{'winrm set winrm/config/service/auth \'@{Basic="true"}\''}</code>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <div className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-3">
                      5
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Allow Unencrypted Traffic
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Enable unencrypted HTTP communication (for port 5985)
                  </p>
                  <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                    <code>{'winrm set winrm/config/service \'@{AllowUnencrypted="true"}\''}</code>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 mb-2">
                      Important Notes
                    </h3>
                    <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                      <li>Run all commands in an elevated PowerShell session (Run as Administrator)</li>
                      <li>Default WinRM port is <strong>5985</strong> for HTTP communication</li>
                      <li>For production environments, consider using HTTPS on port 5986 with proper certificates</li>
                      <li>Ensure the Administrator account is enabled: <code>{'net user Administrator /active:yes'}</code></li>
                      <li>Test the connection locally first: <code>{'winrs -r:localhost -u:Administrator hostname'}</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowWindowsInstructions(false)}
                  className="btn btn-secondary btn-md"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowWindowsInstructions(false);
                    setShowModal(true);
                  }}
                  className="btn btn-primary btn-md"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Windows Server
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}