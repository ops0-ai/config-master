'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserGroupIcon,
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  UsersIcon,
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
  isSystem: boolean;
  isActive: boolean;
  permissions: Permission[];
  users?: User[];
}

export default function RoleMatrixManagement() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    console.log('🔄 Starting to fetch roles data...');
    try {
      setError(null);
      await fetchRoles();
      console.log('✅ Roles data loaded successfully');
    } catch (err) {
      console.error('❌ Fetch data error:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    console.log('📋 Fetching roles...');
    const response = await fetch('/api/roles', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Loaded ${data.length} roles`);
      setRoles(data);
    } else {
      console.error('❌ Failed to fetch roles:', response.status, response.statusText);
      throw new Error(`Failed to fetch roles: ${response.status}`);
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

  const handleCreateRole = () => {
    router.push('/settings/roles/create');
  };

  const handleEditRole = (role: Role) => {
    router.push(`/settings/roles/create?id=${role.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading roles and permissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={fetchData}
                className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
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
            <h1 className="page-title">Role & Permission Matrix</h1>
            <p className="text-muted">Manage roles, permissions, and user assignments</p>
          </div>
        </div>
        
        <button
          onClick={handleCreateRole}
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
                      onClick={() => handleEditRole(role)}
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

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Permissions</span>
                  <span className="font-medium">{role.permissions.length}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center">
                    <UsersIcon className="h-4 w-4 mr-1" />
                    Users
                  </span>
                  <span className="font-medium">{role.users?.length || 0}</span>
                </div>
                
                {role.users && role.users.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {role.users.slice(0, 2).map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded"
                      >
                        {user.name}
                      </span>
                    ))}
                    {role.users.length > 2 && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                        +{role.users.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}