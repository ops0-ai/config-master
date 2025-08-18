'use client';

import { useState, useEffect } from 'react';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import { organizationApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ServerIcon,
  CpuChipIcon,
  DevicePhoneMobileIcon,
  ChartPieIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface Organization {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  serverCount: number;
  configCount: number;
  deploymentCount: number;
  mdmDeviceCount: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalOrganizations: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface OrganizationsResponse {
  organizations: Organization[];
  pagination: PaginationInfo;
}

interface OrganizationStats {
  overview: {
    totalOrgs: number;
    activeOrgs: number;
    inactiveOrgs: number;
  };
  mostActiveOrg: {
    orgId: string;
    orgName: string;
    deploymentCount: number;
  } | null;
  recentActivity: Array<{
    orgId: string;
    orgName: string;
    lastDeployment: string;
  }>;
}

interface CreateOrgFormData {
  name: string;
  description: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export default function OrganizationManagement() {
  const { user } = useMinimalAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrgFormData>({
    name: '',
    description: '',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [organizationToDisable, setOrganizationToDisable] = useState<Organization | null>(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Redirect if not super admin
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchData(currentPage, searchTerm);
    }
  }, [user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const fetchData = async (page = 1, search = '') => {
    try {
      setLoading(true);
      
      // Fetch organizations and stats in parallel
      const [orgsResponse, statsResponse] = await Promise.all([
        organizationApi.getAllOrganizations({ page, limit: 6, search }),
        organizationApi.getOrganizationStats(),
      ]);

      setOrganizations(orgsResponse.data.organizations);
      setPagination(orgsResponse.data.pagination);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setError('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      fetchData(1, term);
    }, 300);
    
    setSearchTimeout(timeout);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(page, searchTerm);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);

    try {
      await organizationApi.createOrganization(createForm);
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        description: '',
        adminEmail: '',
        adminName: '',
        adminPassword: '',
      });
      await fetchData(currentPage, searchTerm); // Refresh data
    } catch (error: any) {
      console.error('Error creating organization:', error);
      setError(error.response?.data?.error || 'Failed to create organization');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleOrganization = async (org: Organization) => {
    if (org.isActive) {
      // Show confirmation modal for disabling
      setOrganizationToDisable(org);
      setShowDisableModal(true);
      setConfirmationName('');
    } else {
      // Enable directly without confirmation
      try {
        await organizationApi.updateOrganization(org.id, {
          isActive: true,
        });
        toast.success(`Organization "${org.name}" has been enabled`);
        await fetchData(currentPage, searchTerm); // Refresh data
      } catch (error: any) {
        console.error('Error enabling organization:', error);
        toast.error(error.response?.data?.error || 'Failed to enable organization');
      }
    }
  };

  const handleConfirmDisable = async () => {
    if (!organizationToDisable) return;
    
    if (confirmationName !== organizationToDisable.name) {
      toast.error('Organization name does not match');
      return;
    }

    try {
      await organizationApi.updateOrganization(organizationToDisable.id, {
        isActive: false,
      });
      toast.success(`Organization "${organizationToDisable.name}" has been disabled`);
      setShowDisableModal(false);
      setOrganizationToDisable(null);
      setConfirmationName('');
      await fetchData(currentPage, searchTerm); // Refresh data
    } catch (error: any) {
      console.error('Error disabling organization:', error);
      toast.error(error.response?.data?.error || 'Failed to disable organization');
    }
  };

  if (!user?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading organization data...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <style jsx global>{`
        main {
          overflow: hidden !important;
        }
      `}</style>
      <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
              <p className="mt-2 text-gray-600">
                Manage all organizations across your Pulse deployment
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create Organization</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex-shrink-0 mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Organizations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview.totalOrgs}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ChartPieIcon className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Organizations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview.activeOrgs}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Inactive Organizations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.overview.inactiveOrgs}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <ChartBarIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Most Active</p>
                  <p className="text-lg font-bold text-gray-900">
                    {stats.mostActiveOrg?.orgName || 'None'}
                  </p>
                  {stats.mostActiveOrg && (
                    <p className="text-sm text-gray-500">
                      {stats.mostActiveOrg.deploymentCount} deployments
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Organizations Table */}
        <div className="flex-1 bg-white shadow-sm rounded-lg border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">All Organizations</h2>
              <div className="relative w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resources
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">{org.name}</div>
                          {org.isPrimary && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Primary
                            </span>
                          )}
                        </div>
                        {org.description && (
                          <div className="text-sm text-gray-500">{org.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          org.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <UsersIcon className="h-4 w-4 mr-1 text-gray-400" />
                        {org.userCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <ServerIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {org.serverCount}
                        </div>
                        <div className="flex items-center">
                          <CpuChipIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {org.configCount}
                        </div>
                        <div className="flex items-center">
                          <DevicePhoneMobileIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {org.mdmDeviceCount}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {!org.isPrimary && (
                          <button
                            onClick={() => handleToggleOrganization(org)}
                            className={`${
                              org.isActive
                                ? 'text-red-600 hover:text-red-900'
                                : 'text-green-600 hover:text-green-900'
                            } transition-colors`}
                          >
                            {org.isActive ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {pagination && (
            <div className="flex-shrink-0 bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {(pagination.currentPage - 1) * pagination.limit + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.currentPage * pagination.limit, pagination.totalOrganizations)}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium">{pagination.totalOrganizations}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPrevPage}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    
                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => {
                      let pageNumber;
                      if (pagination.totalPages <= 5) {
                        pageNumber = index + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNumber = index + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 2) {
                        pageNumber = pagination.totalPages - 4 + index;
                      } else {
                        pageNumber = pagination.currentPage - 2 + index;
                      }
                      
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNumber === pagination.currentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNextPage}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create Organization Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Organization</h3>
                <form onSubmit={handleCreateOrganization} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Admin Email</label>
                    <input
                      type="email"
                      required
                      value={createForm.adminEmail}
                      onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Admin Name</label>
                    <input
                      type="text"
                      required
                      value={createForm.adminName}
                      onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Admin Password</label>
                    <input
                      type="password"
                      required
                      value={createForm.adminPassword}
                      onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {createLoading ? 'Creating...' : 'Create Organization'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Disable Organization Confirmation Modal */}
        {showDisableModal && organizationToDisable && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center mb-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">Disable Organization</h3>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    You are about to disable <strong>{organizationToDisable.name}</strong>.
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    This will prevent all users in this organization from accessing the system.
                  </p>
                  <p className="text-sm text-red-600 font-medium">
                    To confirm, please type the organization name below:
                  </p>
                </div>
                <input
                  type="text"
                  value={confirmationName}
                  onChange={(e) => setConfirmationName(e.target.value)}
                  placeholder={organizationToDisable.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                />
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisableModal(false);
                      setOrganizationToDisable(null);
                      setConfirmationName('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDisable}
                    disabled={confirmationName !== organizationToDisable.name}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disable Organization
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </Layout>
  );
}