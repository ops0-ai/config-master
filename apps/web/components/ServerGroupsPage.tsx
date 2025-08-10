'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  ServerIcon,
  TrashIcon,
  PencilIcon,
  KeyIcon,
  FolderIcon
} from '@heroicons/react/24/outline';
import { serverGroupsApi, pemKeysApi, serversApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface ServerGroup {
  id: string;
  name: string;
  description?: string;
  defaultPemKeyId?: string;
  createdAt: string;
  updatedAt: string;
}

interface PemKey {
  id: string;
  name: string;
}

interface Server {
  id: string;
  name: string;
  ipAddress: string;
  groupId?: string;
  status: string;
}

export default function ServerGroupsPage() {
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const [pemKeys, setPemKeys] = useState<PemKey[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
  const [managingGroup, setManagingGroup] = useState<ServerGroup | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultPemKeyId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsRes, keysRes, serversRes] = await Promise.all([
        serverGroupsApi.getAll(),
        pemKeysApi.getAll(),
        serversApi.getAll(),
      ]);

      setServerGroups(groupsRes.data);
      setPemKeys(keysRes.data);
      setServers(serversRes.data);
    } catch (error) {
      toast.error('Failed to load data');
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        defaultPemKeyId: formData.defaultPemKeyId || undefined,
      };

      console.log('Submitting server group:', { editingGroup: !!editingGroup, payload });
      
      if (editingGroup) {
        console.log('Updating group:', editingGroup.id, payload);
        const response = await serverGroupsApi.update(editingGroup.id, payload);
        console.log('Update response:', response);
        toast.success('Server group updated successfully');
      } else {
        console.log('Creating group:', payload);
        const response = await serverGroupsApi.create(payload);
        console.log('Create response:', response);
        toast.success('Server group created successfully');
      }
      
      await loadData();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save server group');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      defaultPemKeyId: '',
    });
    setEditingGroup(null);
    setShowModal(false);
  };

  const getGroupServers = (groupId: string) => {
    return servers.filter(server => server.groupId === groupId);
  };

  const getPemKeyName = (pemKeyId: string) => {
    const pemKey = pemKeys.find(key => key.id === pemKeyId);
    return pemKey?.name || 'Unknown Key';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'testing':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const handleEdit = (group: ServerGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      defaultPemKeyId: group.defaultPemKeyId || '',
    });
    setShowModal(true);
  };

  const handleAddServerToGroup = async (serverId: string, groupId: string) => {
    try {
      console.log('Adding server to group:', { serverId, groupId });
      const response = await serversApi.update(serverId, { groupId });
      console.log('Add server response:', response);
      toast.success('Server added to group');
      await loadData();
    } catch (error: any) {
      console.error('Failed to add server to group:', error);
      toast.error(error.response?.data?.error || 'Failed to add server to group');
    }
  };

  const handleRemoveServerFromGroup = async (serverId: string) => {
    try {
      await serversApi.update(serverId, { groupId: null });
      toast.success('Server removed from group');
      await loadData();
    } catch (error: any) {
      toast.error('Failed to remove server from group');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server group?')) return;

    try {
      await serverGroupsApi.delete(id);
      toast.success('Server group deleted successfully');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete server group');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
          <h1 className="page-title">Server Groups</h1>
          <p className="text-muted mt-1">
            Organize servers into logical groups for easier management
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary btn-md"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Group
        </button>
      </div>

      {/* Server Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {serverGroups.map((group) => {
          const groupServers = getGroupServers(group.id);
          
          return (
            <div key={group.id} className="card hover:shadow-lg transition-shadow">
              <div className="card-content">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FolderIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        console.log('Managing servers for group:', group.name);
                        setManagingGroup(group);
                        setShowServerModal(true);
                      }}
                      className="btn btn-ghost btn-sm"
                      title="Manage Servers"
                    >
                      <ServerIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(group)}
                      className="btn btn-ghost btn-sm"
                      title="Edit Group"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                      title="Delete Group"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Default PEM Key */}
                {group.defaultPemKeyId && (
                  <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
                    <KeyIcon className="h-4 w-4" />
                    <span>Default Key: {getPemKeyName(group.defaultPemKeyId)}</span>
                  </div>
                )}

                {/* Server Count */}
                <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
                  <ServerIcon className="h-4 w-4" />
                  <span>{groupServers.length} server{groupServers.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Server List */}
                <div className="border-t border-gray-200 pt-4">
                  {groupServers.length > 0 ? (
                    <div className="space-y-2">
                      {groupServers.slice(0, 3).map((server) => (
                        <div key={server.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span>{getStatusIcon(server.status)}</span>
                            <span className="font-medium">{server.name}</span>
                          </div>
                          <span className="text-gray-500">{server.ipAddress}</span>
                        </div>
                      ))}
                      
                      {groupServers.length > 3 && (
                        <div className="text-xs text-gray-500 pt-1">
                          +{groupServers.length - 3} more servers
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <ServerIcon className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No servers in this group</p>
                    </div>
                  )}
                </div>

                {/* Created Date */}
                <div className="border-t border-gray-200 pt-3 mt-4">
                  <p className="text-xs text-gray-500">
                    Created: {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {serverGroups.length === 0 && (
          <div className="col-span-full text-center py-12">
            <FolderIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No server groups yet</h3>
            <p className="text-gray-600 mb-6">Create groups to organize your servers by environment, function, or team.</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary btn-md"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create First Group
            </button>
          </div>
        )}
      </div>

      {/* Ungrouped Servers */}
      {servers.filter(server => !server.groupId).length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ungrouped Servers</h2>
          <div className="card">
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {servers
                  .filter(server => !server.groupId)
                  .map((server) => (
                    <div key={server.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span>{getStatusIcon(server.status)}</span>
                        <div>
                          <p className="font-medium text-gray-900">{server.name}</p>
                          <p className="text-sm text-gray-500">{server.ipAddress}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <p className="text-sm text-gray-600 mt-4">
                💡 Assign these servers to groups for better organization
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingGroup ? 'Edit Server Group' : 'Create Server Group'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                    placeholder="Production Web Servers"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    rows={3}
                    placeholder="Group description or purpose"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default PEM Key
                  </label>
                  <select
                    value={formData.defaultPemKeyId}
                    onChange={(e) => setFormData({ ...formData, defaultPemKeyId: e.target.value })}
                    className="input"
                  >
                    <option value="">No default key</option>
                    {pemKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This PEM key will be used by default for new servers in this group
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
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
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Servers Modal */}
      {showServerModal && managingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Manage Servers - {managingGroup.name}
              </h2>
              <button
                onClick={() => {
                  setShowServerModal(false);
                  setManagingGroup(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Servers in Group */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Servers in Group ({getGroupServers(managingGroup.id).length})
                  </h3>
                  <div className="space-y-2">
                    {getGroupServers(managingGroup.id).map((server) => (
                      <div key={server.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-3">
                          <span>{getStatusIcon(server.status)}</span>
                          <div>
                            <p className="font-medium text-gray-900">{server.name}</p>
                            <p className="text-sm text-gray-500">{server.ipAddress}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveServerFromGroup(server.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {getGroupServers(managingGroup.id).length === 0 && (
                      <div className="text-center py-6 text-gray-500">
                        <ServerIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No servers in this group yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Available Servers */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Available Servers ({servers.filter(s => !s.groupId).length})
                  </h3>
                  <div className="space-y-2">
                    {servers.filter(server => !server.groupId).map((server) => (
                      <div key={server.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <span>{getStatusIcon(server.status)}</span>
                          <div>
                            <p className="font-medium text-gray-900">{server.name}</p>
                            <p className="text-sm text-gray-500">{server.ipAddress}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddServerToGroup(server.id, managingGroup.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                    {servers.filter(s => !s.groupId).length === 0 && (
                      <div className="text-center py-6 text-gray-500">
                        <ServerIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No available servers</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowServerModal(false);
                  setManagingGroup(null);
                }}
                className="btn btn-primary btn-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}