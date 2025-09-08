'use client';

import { useState, useEffect } from 'react';
import {
  UserGroupIcon,
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: Permission[];
  users?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

interface GroupedPermissions {
  [resource: string]: Permission[];
}

export default function RolesManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<GroupedPermissions>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      } else {
        setError('Failed to fetch roles');
      }
    } catch (err) {
      setError('Error fetching roles');
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/roles/permissions/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPermissions(data);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchRoles();
        setIsCreateModalOpen(false);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create role');
      }
    } catch (err) {
      setError('Error creating role');
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchRoles();
        setIsEditModalOpen(false);
        setSelectedRole(null);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update role');
      }
    } catch (err) {
      setError('Error updating role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        await fetchRoles();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete role');
      }
    } catch (err) {
      setError('Error deleting role');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
    });
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions.map(p => p.id),
    });
    setIsEditModalOpen(true);
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const getResourceDisplayName = (resource: string) => {
    return resource
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'read': return '👁️';
      case 'write': return '✏️';
      case 'create': return '➕';
      case 'update': return '📝';
      case 'delete': return '🗑️';
      case 'execute': return '▶️';
      case 'configure': return '⚙️';
      default: return '🔧';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <UserGroupIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="page-title">Roles & Permissions</h1>
            <p className="text-muted">Manage user roles and access permissions</p>
          </div>
        </div>
        
        <button
          onClick={openCreateModal}
          className="btn btn-primary btn-md flex items-center space-x-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Create Role</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <XMarkIcon className="h-4 w-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="card">
            <div className="card-content">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold text-gray-900">{role.name}</h3>
                  {role.isSystem && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                      System
                    </span>
                  )}
                </div>
                
                {!role.isSystem && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(role)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-gray-600 text-sm mb-4">{role.description}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Permissions</span>
                  <span className="font-medium">{role.permissions.length}</span>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 6).map((permission) => (
                    <span
                      key={permission.id}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                    >
                      <span className="mr-1">{getActionIcon(permission.action)}</span>
                      {getResourceDisplayName(permission.resource)}
                    </span>
                  ))}
                  {role.permissions.length > 6 && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                      +{role.permissions.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Create New Role</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Enter role name"
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
                  placeholder="Describe the role's purpose"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {Object.entries(permissions).map(([resource, resourcePermissions]) => (
                    <div key={resource} className="space-y-2">
                      <h4 className="font-medium text-gray-900 border-b pb-1">
                        {getResourceDisplayName(resource)}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {resourcePermissions.map((permission) => (
                          <label key={permission.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">
                              {getActionIcon(permission.action)} {permission.action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                className="btn btn-primary btn-md"
                disabled={!formData.name.trim()}
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditModalOpen && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Edit Role: {selectedRole.name}</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Enter role name"
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
                  placeholder="Describe the role's purpose"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {Object.entries(permissions).map(([resource, resourcePermissions]) => (
                    <div key={resource} className="space-y-2">
                      <h4 className="font-medium text-gray-900 border-b pb-1">
                        {getResourceDisplayName(resource)}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {resourcePermissions.map((permission) => (
                          <label key={permission.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">
                              {getActionIcon(permission.action)} {permission.action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                className="btn btn-primary btn-md"
                disabled={!formData.name.trim()}
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}