'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  CheckIcon,
  UsersIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  users?: User[];
}

interface GroupedPermissions {
  [resource: string]: Permission[];
}

const RESOURCE_DISPLAY_NAMES: { [key: string]: string } = {
  'dashboard': 'Dashboard',
  'settings': 'Settings',
  'users': 'User Management',
  'roles': 'Role Management',
  'servers': 'Servers',
  'server-groups': 'Server Groups',
  'pem-keys': 'PEM Keys',
  'configurations': 'Configurations',
  'deployments': 'Deployments',
  'training': 'Training',
  'chat': 'AI Chat',
  'audit-logs': 'Audit Logs',
  'aws-integrations': 'Integrations',
  'asset': 'Asset Management',
};

const ACTION_DISPLAY_NAMES: { [key: string]: string } = {
  'read': 'View',
  'write': 'Create/Edit',
  'delete': 'Delete',
  'execute': 'Execute',
};

const ACTION_COLORS: { [key: string]: string } = {
  'read': 'bg-green-100 text-green-800',
  'write': 'bg-blue-100 text-blue-800',
  'delete': 'bg-red-100 text-red-800',
  'execute': 'bg-purple-100 text-purple-800',
};

export default function CreateEditRolePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleId = searchParams.get('id');
  const isEditing = !!roleId;

  const [activeTab, setActiveTab] = useState<'permissions' | 'users'>('permissions');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<GroupedPermissions>({});
  const [existingRole, setExistingRole] = useState<Role | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
    assignedUsers: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, [roleId]);

  const fetchData = async () => {
    try {
      setError(null);
      const results = await Promise.allSettled([
        fetchUsers(),
        fetchPermissions(),
        ...(isEditing ? [fetchRole(roleId!)] : [])
      ]);
      
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        setError(`Failed to load some data: ${failures.length} errors`);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const response = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    } else {
      throw new Error(`Failed to fetch users: ${response.status}`);
    }
  };

  const fetchPermissions = async () => {
    const response = await fetch('/api/roles/permissions/all', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      setPermissions(data);
    } else {
      throw new Error(`Failed to fetch permissions: ${response.status}`);
    }
  };

  const fetchRole = async (id: string) => {
    const response = await fetch(`/api/roles/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
    });
    
    if (response.ok) {
      const role = await response.json();
      setExistingRole(role);
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions.map((p: Permission) => p.id),
        assignedUsers: role.users?.map((u: User) => u.id) || [],
      });
    } else {
      throw new Error(`Failed to fetch role: ${response.status}`);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Role name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEditing ? `/api/roles/${roleId}` : '/api/roles';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
        }),
      });

      if (response.ok) {
        const savedRole = await response.json();
        const targetRoleId = isEditing ? roleId : savedRole.id;
        
        // Handle user assignments
        if (isEditing && existingRole) {
          const currentUserIds = existingRole.users?.map(u => u.id) || [];
          const usersToRemove = currentUserIds.filter(id => !formData.assignedUsers.includes(id));
          const usersToAdd = formData.assignedUsers.filter(id => !currentUserIds.includes(id));

          // Remove users
          await Promise.all(
            usersToRemove.map(userId =>
              fetch(`/api/roles/assign/${userId}/${targetRoleId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
              })
            )
          );

          // Add users
          await Promise.all(
            usersToAdd.map(userId =>
              fetch('/api/roles/assign', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
                body: JSON.stringify({ userId, roleId: targetRoleId }),
              })
            )
          );
        } else {
          // New role - assign all selected users
          await Promise.all(
            formData.assignedUsers.map(userId =>
              fetch('/api/roles/assign', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
                body: JSON.stringify({ userId, roleId: targetRoleId }),
              })
            )
          );
        }

        // Redirect back to roles section
        router.push('/settings?tab=roles');
      } else {
        const errorData = await response.json();
        setError(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} role`);
      }
    } catch (err) {
      setError(`Error ${isEditing ? 'updating' : 'creating'} role`);
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const toggleUserAssignment = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedUsers: prev.assignedUsers.includes(userId)
        ? prev.assignedUsers.filter(id => id !== userId)
        : [...prev.assignedUsers, userId]
    }));
  };

  const resources = Object.keys(permissions);
  const actions = ['read', 'write', 'delete', 'execute'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/settings?tab=roles')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Roles
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isEditing ? `Edit Role: ${formData.name || 'Loading...'}` : 'Create New Role'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Basic Info Form */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                placeholder="e.g., DevOps Engineer"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="form-textarea"
                rows={3}
                placeholder="Describe the role's purpose and responsibilities"
              />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-700">{error}</div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('permissions')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'permissions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShieldCheckIcon className="h-5 w-5 inline mr-2" />
                Permissions
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UsersIcon className="h-5 w-5 inline mr-2" />
                Users ({formData.assignedUsers.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'permissions' && (
              <div>
                {/* Permissions Matrix Table */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Permissions Matrix</h3>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {formData.permissions.length} of {Object.values(permissions).flat().length} permissions selected
                      </span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allPermissionIds = Object.values(permissions).flat().map(p => p.id);
                            setFormData(prev => ({ ...prev, permissions: allPermissionIds }));
                          }}
                          className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, permissions: [] }))}
                          className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                              Resource
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              View/Read
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Create/Edit
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Delete
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Execute/Export
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Selected
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {resources.map((resource, resourceIndex) => {
                            const resourcePermissions = permissions[resource] || [];
                            const selectedCount = resourcePermissions.filter(p => formData.permissions.includes(p.id)).length;
                            const totalCount = resourcePermissions.length;
                            
                            return (
                              <tr key={resource} className={resourceIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 z-10" 
                                    style={{ backgroundColor: resourceIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
                                  {RESOURCE_DISPLAY_NAMES[resource] || resource}
                                </td>
                                {['read', 'write', 'delete', 'execute'].map(action => {
                                  // Handle special action mappings for certain resources
                                  let actualAction = action;
                                  let permission = resourcePermissions.find(p => p.action === actualAction);
                                  
                                  // Special mappings
                                  if (!permission && action === 'read' && resource === 'audit-logs') {
                                    actualAction = 'view';
                                    permission = resourcePermissions.find(p => p.action === actualAction);
                                  }
                                  
                                  // For assets, map write to create/update actions
                                  if (!permission && action === 'write' && resource === 'asset') {
                                    const createPermission = resourcePermissions.find(p => p.action === 'create');
                                    const updatePermission = resourcePermissions.find(p => p.action === 'update');
                                    
                                    if (createPermission && updatePermission) {
                                      const createChecked = formData.permissions.includes(createPermission.id);
                                      const updateChecked = formData.permissions.includes(updatePermission.id);
                                      
                                      return (
                                        <td key={action} className="px-4 py-4 text-center">
                                          <div className="space-y-1">
                                            <label className="inline-flex items-center cursor-pointer" title="Create assets">
                                              <input
                                                type="checkbox"
                                                checked={createChecked}
                                                onChange={() => togglePermission(createPermission.id)}
                                                className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                              />
                                              <span className="ml-1 text-xs text-gray-600">Create</span>
                                            </label>
                                            <br />
                                            <label className="inline-flex items-center cursor-pointer" title="Update assets">
                                              <input
                                                type="checkbox"
                                                checked={updateChecked}
                                                onChange={() => togglePermission(updatePermission.id)}
                                                className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                              />
                                              <span className="ml-1 text-xs text-gray-600">Update</span>
                                            </label>
                                          </div>
                                        </td>
                                      );
                                    }
                                  }
                                  
                                  if (!permission) {
                                    // Check if this resource has any non-standard actions we should show
                                    const nonStandardActions = resourcePermissions.filter(p => 
                                      !['read', 'write', 'delete', 'execute', 'view'].includes(p.action)
                                    );
                                    
                                    // For audit-logs, show export in the execute column
                                    if (action === 'execute' && resource === 'audit-logs') {
                                      const exportPermission = resourcePermissions.find(p => p.action === 'export');
                                      if (exportPermission) {
                                        const isChecked = formData.permissions.includes(exportPermission.id);
                                        return (
                                          <td key={action} className="px-4 py-4 text-center">
                                            <label className="inline-flex items-center cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => togglePermission(exportPermission.id)}
                                                className="form-checkbox h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                              />
                                            </label>
                                          </td>
                                        );
                                      }
                                    }
                                    
                                    // For assets, show assign, import, export in the execute column
                                    if (action === 'execute' && resource === 'asset') {
                                      const assignPermission = resourcePermissions.find(p => p.action === 'assign');
                                      const importPermission = resourcePermissions.find(p => p.action === 'import');
                                      const exportPermission = resourcePermissions.find(p => p.action === 'export');
                                      
                                      return (
                                        <td key={action} className="px-4 py-4 text-center">
                                          <div className="space-y-1">
                                            {assignPermission && (
                                              <>
                                                <label className="inline-flex items-center cursor-pointer" title="Assign assets to users">
                                                  <input
                                                    type="checkbox"
                                                    checked={formData.permissions.includes(assignPermission.id)}
                                                    onChange={() => togglePermission(assignPermission.id)}
                                                    className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                  />
                                                  <span className="ml-1 text-xs text-gray-600">Assign</span>
                                                </label>
                                                <br />
                                              </>
                                            )}
                                            {importPermission && (
                                              <>
                                                <label className="inline-flex items-center cursor-pointer" title="Import assets from CSV">
                                                  <input
                                                    type="checkbox"
                                                    checked={formData.permissions.includes(importPermission.id)}
                                                    onChange={() => togglePermission(importPermission.id)}
                                                    className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                  />
                                                  <span className="ml-1 text-xs text-gray-600">Import</span>
                                                </label>
                                                <br />
                                              </>
                                            )}
                                            {exportPermission && (
                                              <label className="inline-flex items-center cursor-pointer" title="Export assets to CSV">
                                                <input
                                                  type="checkbox"
                                                  checked={formData.permissions.includes(exportPermission.id)}
                                                  onChange={() => togglePermission(exportPermission.id)}
                                                  className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="ml-1 text-xs text-gray-600">Export</span>
                                              </label>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    }
                                    
                                    // For aws-integrations, show sync and import permissions in the execute column, but grey out the execute action
                                    if (action === 'execute' && resource === 'aws-integrations') {
                                      const syncPermission = resourcePermissions.find(p => p.action === 'sync');
                                      const importPermission = resourcePermissions.find(p => p.action === 'import');
                                      
                                      if (syncPermission && importPermission) {
                                        const syncChecked = formData.permissions.includes(syncPermission.id);
                                        const importChecked = formData.permissions.includes(importPermission.id);
                                        
                                        return (
                                          <td key={action} className="px-4 py-4 text-center">
                                            <div className="space-y-1">
                                              <label className="inline-flex items-center cursor-pointer" title="Sync AWS instances">
                                                <input
                                                  type="checkbox"
                                                  checked={syncChecked}
                                                  onChange={() => togglePermission(syncPermission.id)}
                                                  className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="ml-1 text-xs text-gray-600">Sync</span>
                                              </label>
                                              <br />
                                              <label className="inline-flex items-center cursor-pointer" title="Import AWS instances as servers">
                                                <input
                                                  type="checkbox"
                                                  checked={importChecked}
                                                  onChange={() => togglePermission(importPermission.id)}
                                                  className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="ml-1 text-xs text-gray-600">Import</span>
                                              </label>
                                            </div>
                                          </td>
                                        );
                                      }
                                    }
                                    
                                    return (
                                      <td key={action} className="px-4 py-4 text-center">
                                        <div className="w-5 h-5 bg-gray-100 rounded border-2 border-gray-200 mx-auto opacity-50"></div>
                                      </td>
                                    );
                                  }
                                  
                                  const isChecked = formData.permissions.includes(permission.id);
                                  
                                  return (
                                    <td key={action} className="px-4 py-4 text-center">
                                      <label className="inline-flex items-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => togglePermission(permission.id)}
                                          className="form-checkbox h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                      </label>
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-4 text-center">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    selectedCount === totalCount && totalCount > 0
                                      ? 'bg-green-100 text-green-800'
                                      : selectedCount > 0
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {selectedCount}/{totalCount}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['read', 'write', 'delete', 'execute'].map(action => {
                    const actionPermissions = Object.values(permissions).flat().filter(p => p.action === action);
                    const selectedActionPermissions = actionPermissions.filter(p => formData.permissions.includes(p.id));
                    
                    return (
                      <div key={action} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            {ACTION_DISPLAY_NAMES[action]}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {selectedActionPermissions.length}/{actionPermissions.length}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              const actionPermissionIds = actionPermissions.map(p => p.id);
                              setFormData(prev => ({
                                ...prev,
                                permissions: Array.from(new Set([...prev.permissions, ...actionPermissionIds]))
                              }));
                            }}
                            className="flex-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const actionPermissionIds = actionPermissions.map(p => p.id);
                              setFormData(prev => ({
                                ...prev,
                                permissions: prev.permissions.filter(id => !actionPermissionIds.includes(id))
                              }));
                            }}
                            className="flex-1 text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                          >
                            None
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Assign Users to Role ({formData.assignedUsers.length} selected)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map(user => (
                    <label key={user.id} className="flex items-center space-x-3 cursor-pointer p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.assignedUsers.includes(user.id)}
                        onChange={() => toggleUserAssignment(user.id)}
                        className="form-checkbox h-4 w-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </label>
                  ))}
                  
                  {users.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-8">
                      No users found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8">
          <button
            onClick={handleSave}
            disabled={!formData.name.trim() || saving}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-5 w-5 mr-2" />
                {isEditing ? 'Update Role' : 'Create Role'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}