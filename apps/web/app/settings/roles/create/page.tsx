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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side - Resources */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Resources</h3>
                  <div className="space-y-4">
                    {resources.map(resource => {
                      const resourcePermissions = permissions[resource] || [];
                      const selectedCount = resourcePermissions.filter(p => formData.permissions.includes(p.id)).length;
                      
                      return (
                        <div key={resource} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">
                              {RESOURCE_DISPLAY_NAMES[resource] || resource}
                            </h4>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              selectedCount === resourcePermissions.length 
                                ? 'bg-green-100 text-green-800' 
                                : selectedCount > 0 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {selectedCount}/{resourcePermissions.length}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {actions.map(action => {
                              const permission = resourcePermissions.find(p => p.action === action);
                              if (!permission) return (
                                <div key={action} className="text-center py-2 text-gray-400 text-sm">
                                  No {ACTION_DISPLAY_NAMES[action]}
                                </div>
                              );
                              
                              const isChecked = formData.permissions.includes(permission.id);
                              
                              return (
                                <label key={action} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermission(permission.id)}
                                    className="form-checkbox h-4 w-4 text-blue-600"
                                  />
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[action]}`}>
                                    {ACTION_DISPLAY_NAMES[action]}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side - Actions Summary */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Permissions</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-4">
                      {formData.permissions.length} of {Object.values(permissions).flat().length} permissions selected
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {actions.map(action => {
                        const actionPermissions = Object.entries(permissions).flatMap(([resource, perms]) => 
                          perms.filter(p => p.action === action && formData.permissions.includes(p.id))
                            .map(p => ({ ...p, resource }))
                        );
                        
                        if (actionPermissions.length === 0) return null;
                        
                        return (
                          <div key={action}>
                            <h4 className={`text-sm font-medium mb-2 inline-flex items-center px-2 py-1 rounded ${ACTION_COLORS[action]}`}>
                              {ACTION_DISPLAY_NAMES[action]} ({actionPermissions.length})
                            </h4>
                            <ul className="ml-4 space-y-1">
                              {actionPermissions.map(perm => (
                                <li key={perm.id} className="text-sm text-gray-600">
                                  {RESOURCE_DISPLAY_NAMES[perm.resource] || perm.resource}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                      
                      {formData.permissions.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          No permissions selected
                        </div>
                      )}
                    </div>
                  </div>
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