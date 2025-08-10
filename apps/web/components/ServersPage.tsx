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
  ClockIcon
} from '@heroicons/react/24/outline';
import { serversApi, serverGroupsApi, pemKeysApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Server {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  port: number;
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
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    ipAddress: '',
    port: 22,
    username: 'root',
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
      const [serversRes, groupsRes, keysRes] = await Promise.all([
        serversApi.getAll(),
        serverGroupsApi.getAll(),
        pemKeysApi.getAll(),
      ]);

      setServers(serversRes.data);
      setServerGroups(groupsRes.data);
      setPemKeys(keysRes.data);
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
      if (editingServer) {
        await serversApi.update(editingServer.id, formData);
        toast.success('Server updated successfully');
      } else {
        await serversApi.create(formData);
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
      username: server.username,
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

  const resetForm = () => {
    setFormData({
      name: '',
      hostname: '',
      ipAddress: '',
      port: 22,
      username: 'root',
      operatingSystem: '',
      osVersion: '',
      groupId: '',
      pemKeyId: '',
      metadata: {},
    });
    setEditingServer(null);
    setShowModal(false);
  };

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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="page-title">Servers</h1>
          <p className="text-muted mt-1">
            Manage your infrastructure servers and connections
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-md"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Server
        </button>
      </div>

      {/* Servers Grid */}
      <div className="grid grid-cols-1 gap-6">
        {servers.map((server) => (
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
                      <span>👤 {server.username}</span>
                      {server.operatingSystem && (
                        <span>💻 {server.operatingSystem} {server.osVersion}</span>
                      )}
                      {server.group && (
                        <span>🏷️ {server.group.name}</span>
                      )}
                      {server.pemKey && (
                        <span>🔑 {server.pemKey.name}</span>
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
                    onClick={() => testConnection(server.id)}
                    disabled={testingConnection === server.id}
                    className="btn btn-ghost btn-sm"
                    title="Test Connection"
                  >
                    <WifiIcon className={`h-4 w-4 ${testingConnection === server.id ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleEdit(server)}
                    className="btn btn-ghost btn-sm"
                    title="Edit Server"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                    title="Delete Server"
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
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    max="65535"
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PEM Key
                  </label>
                  <select
                    value={formData.pemKeyId}
                    onChange={(e) => setFormData({ ...formData, pemKeyId: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a PEM key...</option>
                    {pemKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name}
                      </option>
                    ))}
                  </select>
                </div>
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
    </div>
  );
}