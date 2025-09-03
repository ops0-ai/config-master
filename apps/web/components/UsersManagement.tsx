'use client';

import { useState, useEffect } from 'react';
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  EnvelopeIcon,
  CalendarIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';

interface Role {
  id: string;
  name: string;
  description: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  isSSO?: boolean;
  roles?: Role[];
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    isActive: true,
    isSSO: false,
  });

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>('');

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      // For now, let's get users from the existing endpoint
      // We'll need to modify this to get users with their roles
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      setError('Error fetching users');
    }
  };

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
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    // Only validate password match for non-SSO users
    if (!formData.isSSO && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const requestBody: any = {
        name: formData.name,
        email: formData.email,
        isActive: formData.isActive,
        isSSO: formData.isSSO,
      };

      // Only include password for non-SSO users
      if (!formData.isSSO) {
        requestBody.password = formData.password;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        await fetchUsers();
        setIsCreateModalOpen(false);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Error creating user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        isActive: formData.isActive,
      };

      if (formData.password) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        await fetchUsers();
        setIsEditModalOpen(false);
        setSelectedUser(null);
        resetForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update user');
      }
    } catch (err) {
      setError('Error updating user');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user? They will no longer be able to log in.')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to deactivate user');
      }
    } catch (err) {
      setError('Error deactivating user');
    }
  };

  const handleReactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to reactivate this user? They will be able to log in again.')) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ isActive: true }),
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to reactivate user');
      }
    } catch (err) {
      setError('Error reactivating user');
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleBulkAction = async () => {
    if (selectedUsers.length === 0 || !bulkAction) return;

    const actionText = bulkAction === 'activate' ? 'activate' : 
                      bulkAction === 'deactivate' ? 'deactivate' : 'change roles for';
    
    if (!confirm(`Are you sure you want to ${actionText} ${selectedUsers.length} selected user(s)?`)) return;

    try {
      if (bulkAction === 'activate' || bulkAction === 'deactivate') {
        const isActive = bulkAction === 'activate';
        
        // Process users in parallel
        await Promise.all(
          selectedUsers.map(userId =>
            fetch(`/api/users/${userId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              },
              body: JSON.stringify({ isActive }),
            })
          )
        );
      }
      
      await fetchUsers();
      setSelectedUsers([]);
      setBulkAction('');
    } catch (err) {
      setError(`Error performing bulk ${bulkAction}`);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      const response = await fetch('/api/roles/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ userId, roleId }),
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to assign role');
      }
    } catch (err) {
      setError('Error assigning role');
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      const response = await fetch(`/api/roles/assign/${userId}/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        await fetchUsers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to remove role');
      }
    } catch (err) {
      setError('Error removing role');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      isActive: true,
      isSSO: false,
    });
    setSelectedRoles([]);
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      isActive: user.isActive,
      isSSO: user.isSSO || false,
    });
    setIsEditModalOpen(true);
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles?.map(r => r.id) || []);
    setIsRoleModalOpen(true);
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
          <UsersIcon className="h-8 w-8 text-purple-600" />
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="text-muted">Manage users and their role assignments</p>
          </div>
        </div>
        
        <button
          onClick={openCreateModal}
          className="btn btn-primary btn-md flex items-center space-x-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 font-medium">
              {selectedUsers.length} user(s) selected
            </span>
            <div className="flex items-center space-x-3">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="form-select text-sm"
              >
                <option value="">Select action...</option>
                <option value="activate">Activate Users</option>
                <option value="deactivate">Deactivate Users</option>
                <option value="change-roles">Change Roles</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="btn btn-primary btn-sm"
              >
                Apply
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="btn btn-secondary btn-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Users Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Organization Users</h2>
          <p className="text-sm text-gray-600">Manage user accounts and permissions</p>
        </div>
        
        <div className="card-content p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={(e) => handleSelectAllUsers(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 ${!user.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-purple-600">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${user.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                            {user.name}
                            {!user.isActive && <span className="ml-2 text-xs text-red-500 font-normal">(Deactivated)</span>}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <EnvelopeIcon className="h-4 w-4 mr-1" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.slice(0, 2).map((role) => (
                          <span
                            key={role.id}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                          >
                            <ShieldCheckIcon className="h-3 w-3 mr-1" />
                            {role.name}
                          </span>
                        ))}
                        {(user.roles?.length || 0) > 2 && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            +{(user.roles?.length || 0) - 2} more
                          </span>
                        )}
                        {(!user.roles || user.roles.length === 0) && (
                          <span className="text-sm text-gray-400">No roles assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openRoleModal(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Manage Roles"
                        >
                          <ShieldCheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit User"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleReactivateUser(user.id)}
                          disabled={user.isActive}
                          className={`${user.isActive 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : 'text-green-600 hover:text-green-900'
                          }`}
                          title={user.isActive ? "User is already active" : "Activate User"}
                        >
                          <ShieldCheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeactivateUser(user.id)}
                          disabled={!user.isActive}
                          className={`${!user.isActive 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : 'text-red-600 hover:text-red-900'
                          }`}
                          title={!user.isActive ? "User is already inactive" : "Deactivate User"}
                        >
                          <NoSymbolIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content max-w-lg w-full">
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Add New User</h2>
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
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="form-input"
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ssoUser"
                  checked={formData.isSSO}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    isSSO: e.target.checked,
                    password: e.target.checked ? '' : prev.password,
                    confirmPassword: e.target.checked ? '' : prev.confirmPassword,
                  }))}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="ssoUser" className="ml-2 block text-sm text-gray-900">
                  SSO User (will login via Single Sign-On)
                </label>
              </div>

              {!formData.isSSO && (
                <>
                  <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="form-input"
                  placeholder="Enter password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="form-input"
                  placeholder="Confirm password"
                  required
                />
              </div>
                </>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Account is active
                </label>
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
                onClick={handleCreateUser}
                className="btn btn-primary btn-md"
                disabled={!formData.name.trim() || !formData.email.trim() || (!formData.isSSO && !formData.password)}
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content max-w-lg w-full">
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Edit User: {selectedUser.name}</h2>
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
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="form-input"
                  placeholder="Enter new password"
                />
              </div>

              {formData.password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="form-input"
                    placeholder="Confirm new password"
                  />
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="editIsActive" className="ml-2 text-sm text-gray-700">
                  Account is active
                </label>
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
                onClick={handleUpdateUser}
                className="btn btn-primary btn-md"
                disabled={!formData.name.trim() || !formData.email.trim()}
              >
                Update User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {isRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="modal-content max-w-lg w-full">
            <div className="modal-header">
              <h2 className="text-xl font-semibold">Manage Roles: {selectedUser.name}</h2>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Available Roles</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {roles.map((role) => {
                    const hasRole = selectedUser.roles?.some(ur => ur.id === role.id);
                    return (
                      <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="flex items-center space-x-2">
                            <ShieldCheckIcon className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{role.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">{role.description}</p>
                        </div>
                        <button
                          onClick={() => hasRole 
                            ? handleRemoveRole(selectedUser.id, role.id)
                            : handleAssignRole(selectedUser.id, role.id)
                          }
                          className={`btn btn-sm ${hasRole 
                            ? 'btn-secondary' 
                            : 'btn-primary'
                          }`}
                        >
                          {hasRole ? 'Remove' : 'Assign'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setIsRoleModalOpen(false)}
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