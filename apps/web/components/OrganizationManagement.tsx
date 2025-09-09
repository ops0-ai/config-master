'use client';

import React, { useState, useEffect } from 'react';
import { 
  BuildingOfficeIcon,
  CogIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  KeyIcon,
  UserIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import SSOConfiguration from './SSOConfiguration';

interface Organization {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isActive: boolean;
  isPrimary: boolean;
  featuresEnabled: {
    servers?: boolean;
    serverGroups?: boolean;
    pemKeys?: boolean;
    configurations?: boolean;
    deployments?: boolean;
    chat?: boolean;
    training?: boolean;
    awsIntegrations?: boolean;
    githubIntegrations?: boolean;
    mdm?: boolean;
    assets?: boolean;
    auditLogs?: boolean;
    pulseAssist?: boolean;
    hive?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
}

interface FeatureConfig {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'core' | 'integration' | 'advanced';
}

const FEATURES: FeatureConfig[] = [
  // Core Features
  { 
    key: 'servers', 
    name: 'Server Management', 
    description: 'Manage servers and infrastructure inventory',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'serverGroups', 
    name: 'Server Groups', 
    description: 'Group servers for organized management',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'pemKeys', 
    name: 'PEM Keys', 
    description: 'SSH key management and secure authentication',
    icon: ({ className }) => <ShieldCheckIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'configurations', 
    name: 'Configuration Management', 
    description: 'Create and manage Ansible configurations',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'deployments', 
    name: 'Deployment Pipeline', 
    description: 'Deploy configurations to servers',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'chat', 
    name: 'AI Chat Assistant', 
    description: 'Conversational AI for configuration generation',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'pulseAssist', 
    name: 'Pulse Assist', 
    description: 'Context-aware AI assistant with smart suggestions across all pages',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  { 
    key: 'hive', 
    name: 'Hive Monitoring', 
    description: 'Distributed monitoring agents for logs, metrics, and observability',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'core'
  },
  
  // Integration Features
  { 
    key: 'awsIntegrations', 
    name: 'AWS Integration', 
    description: 'Import instances and manage AWS resources',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'integration'
  },
  { 
    key: 'githubIntegrations', 
    name: 'GitHub Integration', 
    description: 'Import/export configurations and sync assets',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'integration'
  },
  
  // Advanced Features
  { 
    key: 'mdm', 
    name: 'Mobile Device Management', 
    description: 'Manage and monitor mobile devices',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'advanced'
  },
  { 
    key: 'assets', 
    name: 'Asset Management', 
    description: 'Track and manage organizational assets',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'advanced'
  },
  { 
    key: 'training', 
    name: 'Training Modules', 
    description: 'Access infrastructure training content',
    icon: ({ className }) => <CogIcon className={className} />,
    category: 'advanced'
  },
  { 
    key: 'auditLogs', 
    name: 'Audit Logs', 
    description: 'View and export activity audit logs',
    icon: ({ className }) => <ShieldCheckIcon className={className} />,
    category: 'advanced'
  }
];

// Common email providers that we should not extract company names from
const COMMON_EMAIL_PROVIDERS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'mail.com',
  'ymail.com',
  'live.com',
  'msn.com',
  'rediffmail.com',
  'zoho.com'
];

// Function to extract company name from email domain
const extractCompanyFromEmail = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;
  
  const domain = email.split('@')[1].toLowerCase();
  
  // Skip common email providers
  if (COMMON_EMAIL_PROVIDERS.includes(domain)) {
    return null;
  }
  
  // Extract company name (remove .com, .org, etc. and capitalize)
  const companyName = domain
    .split('.')[0] // Take the part before the first dot
    .split(/[-_]/) // Split on hyphens and underscores
    .map(part => part.charAt(0).toUpperCase() + part.slice(1)) // Capitalize each part
    .join(' '); // Join with spaces
  
  return companyName;
};

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  // Removed pagination to show all organizations with scroll
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateOrgId, setDeactivateOrgId] = useState<string>('');
  const [deactivateOrgName, setDeactivateOrgName] = useState<string>('');
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    adminEmail: '',
    adminName: '',
    adminPassword: ''
  });
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'features' | 'platform' | 'statistics' | 'sso'>('features');
  const [orgStats, setOrgStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    fetchOrganizations();
    checkSuperAdminStatus();
    fetchSystemSettings();
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedOrg && activeTab === 'statistics') {
      fetchOrgStats(selectedOrg.id);
    }
  }, [selectedOrg, activeTab]);

  const checkSuperAdminStatus = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setIsSuperAdmin(user.isSuperAdmin === true);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      setLoadingSettings(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('/api/system-settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const settings = await response.json();
        const settingsMap = settings.reduce((acc: any, setting: any) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {});
        setSystemSettings(settingsMap);
      }
    } catch (err) {
      // Silent fail for non-super admins
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchOrgStats = async (orgId: string) => {
    try {
      setLoadingStats(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/organizations/${orgId}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const stats = await response.json();
        setOrgStats(stats);
      }
    } catch (err) {
      console.error('Failed to fetch organization stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const updateSystemSetting = async (key: string, value: any) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/system-settings/${key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      setSystemSettings((prev: any) => ({ ...prev, [key]: value }));
      setSuccessMessage('Platform setting updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError('Failed to update platform setting');
    } finally {
      setSaving(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const { adminApi } = await import('../lib/api');
      
      const response = await adminApi.getOrganizations(statusFilter);
      const data = response.data;
      
      setOrganizations(data.organizations || []);
      
      if (data.organizations?.length > 0 && !selectedOrg) {
        setSelectedOrg(data.organizations[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const updateOrganizationFeatures = async (orgId: string, featuresEnabled: any) => {
    try {
      setSaving(true);
      setError(null);
      
      const { adminApi } = await import('../lib/api');
      await adminApi.updateOrganizationFeatures(orgId, featuresEnabled);
      
      // Update local state
      setOrganizations(prev => prev.map(org => 
        org.id === orgId ? { ...org, featuresEnabled } : org
      ));
      
      if (selectedOrg?.id === orgId) {
        setSelectedOrg(prev => prev ? { ...prev, featuresEnabled } : null);
      }

      setSuccessMessage('Organization features updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update organization features');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = async (featureKey: string) => {
    if (!selectedOrg) return;

    const currentValue = selectedOrg.featuresEnabled[featureKey as keyof typeof selectedOrg.featuresEnabled];
    const newFeatures = {
      ...selectedOrg.featuresEnabled,
      [featureKey]: !currentValue
    };

    await updateOrganizationFeatures(selectedOrg.id, newFeatures);
  };

  const toggleOrganizationStatus = async (orgId: string, isActive: boolean) => {
    // If deactivating, show confirmation modal
    if (!isActive) {
      const org = organizations.find(o => o.id === orgId);
      if (org) {
        setDeactivateOrgId(orgId);
        setDeactivateOrgName(org.name);
        setConfirmationInput('');
        setShowDeactivateModal(true);
        return;
      }
    }
    
    // Proceed with activation (no confirmation needed)
    await performStatusToggle(orgId, isActive);
  };

  const performStatusToggle = async (orgId: string, isActive: boolean) => {
    try {
      setSaving(true);
      setError(null);
      
      const { adminApi } = await import('../lib/api');
      await adminApi.updateOrganizationStatus(orgId, isActive);

      // Update local state
      setOrganizations(prev => prev.map(org => 
        org.id === orgId ? { ...org, isActive } : org
      ));
      
      if (selectedOrg?.id === orgId) {
        setSelectedOrg(prev => prev ? { ...prev, isActive } : null);
      }

      setSuccessMessage(`Organization ${isActive ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update organization status');
    } finally {
      setSaving(false);
    }
  };


  const groupedFeatures = {
    core: FEATURES.filter(f => f.category === 'core'),
    integration: FEATURES.filter(f => f.category === 'integration'),
    advanced: FEATURES.filter(f => f.category === 'advanced')
  };

  // Filter organizations based on search query
  const filteredOrganizations = organizations.filter(org => 
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (org.description && org.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // No pagination - show all filtered organizations

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createFormData.name || !createFormData.adminEmail || !createFormData.adminName || !createFormData.adminPassword) {
      setError('All fields are required');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const { adminApi } = await import('../lib/api');
      const response = await adminApi.createOrganization(createFormData);
      
      const newOrg = response.data.organization;
      
      // Add the new organization to the list
      setOrganizations(prev => [newOrg, ...prev]);
      
      // Reset form and close modal
      setCreateFormData({
        name: '',
        description: '',
        adminEmail: '',
        adminName: '',
        adminPassword: ''
      });
      setShowCreateModal(false);
      
      // Select the newly created organization
      setSelectedOrg(newOrg);
      
      setSuccessMessage(`Organization "${newOrg.name}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
          <p className="mt-2 text-gray-600">
            Manage organizations and control feature access
          </p>
        </div>
        
        {/* Error/Success Messages */}
        {error && (
          <div className="max-w-7xl mx-auto mt-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="max-w-7xl mx-auto mt-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <CheckIcon className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Fixed Height Grid Layout */}
      <div className="flex-1 max-w-7xl mx-auto p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          
          {/* Left Sidebar - Organizations List */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 h-full flex flex-col">
              {/* Header for Organizations */}
              <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Organizations</h3>
                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-gray-500">
                      {filteredOrganizations.length} total
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      + Add
                    </button>
                  </div>
                </div>
                
                {/* Search Input */}
                <div className="space-y-3">
                  {/* Search Input */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search organizations..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="all">All Organizations</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Organizations List - Fixed Height Container with improved scrolling */}
              <div className="flex-1 min-h-0 overflow-hidden" style={{ maxHeight: '500px' }}>
                {filteredOrganizations.length > 0 ? (
                  <div className="divide-y divide-gray-200 h-full overflow-y-auto custom-scrollbar">
                    {filteredOrganizations.map((org) => (
                      <div
                        key={org.id}
                        className={`px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedOrg?.id === org.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                        }`}
                        onClick={() => setSelectedOrg(org)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {org.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {org._count?.users || 0} users
                            </p>
                            {org.isPrimary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {org.isActive ? (
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            ) : (
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-gray-500 text-sm">
                      {searchQuery ? 'No organizations found matching your search' : 'No organizations found'}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Organization count footer */}
              {filteredOrganizations.length > 0 && (
                <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                  <div className="text-xs text-gray-500 text-center">
                    Showing {filteredOrganizations.length} organization{filteredOrganizations.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Content Area - Organization Details */}
          <div className="lg:col-span-3">
            {selectedOrg ? (
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 h-full flex flex-col">
                {/* Organization Header */}
                <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                        {selectedOrg.name}
                      </h3>
                      <p className="text-sm text-gray-500">{selectedOrg.description}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedOrg.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedOrg.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {!selectedOrg.isPrimary && (
                        <button
                          onClick={() => toggleOrganizationStatus(selectedOrg.id, !selectedOrg.isActive)}
                          disabled={saving}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            selectedOrg.isActive
                              ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                              : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                          }`}
                        >
                          {saving ? 'Updating...' : selectedOrg.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="flex -mb-px" aria-label="Tabs">
                    <button
                      onClick={() => setActiveTab('features')}
                      className={`py-2 px-6 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'features'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <CogIcon className="inline-block h-4 w-4 mr-2" />
                      Feature Access Control
                    </button>
                    <button
                      onClick={() => setActiveTab('statistics')}
                      className={`py-2 px-6 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'statistics'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <BuildingOfficeIcon className="inline-block h-4 w-4 mr-2" />
                      Organization Statistics
                    </button>
                    {isSuperAdmin && (
                      <>
                        <button
                          onClick={() => setActiveTab('platform')}
                          className={`py-2 px-6 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'platform'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <ShieldCheckIcon className="inline-block h-4 w-4 mr-2" />
                          Platform Settings
                        </button>
                        <button
                          onClick={() => setActiveTab('sso')}
                          className={`py-2 px-6 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'sso'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <KeyIcon className="inline-block h-4 w-4 mr-2" />
                          SSO Configuration
                        </button>
                      </>
                    )}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6" style={{maxHeight: 'calc(100vh - 350px)'}}>
                  {activeTab === 'features' && (
                    <>
                  {/* Core Features */}
                  <div className="mb-8">
                    <h5 className="text-sm font-medium text-gray-900 mb-4">Core Features</h5>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {groupedFeatures.core.map((feature) => (
                        <div
                          key={feature.key}
                          className={`border rounded-lg p-4 transition-all ${
                            selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                              ? 'border-green-200 bg-green-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <feature.icon className={`h-5 w-5 ${
                                selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`} />
                              <div>
                                <h6 className="text-sm font-medium text-gray-900">{feature.name}</h6>
                                <p className="text-xs text-gray-500">{feature.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleFeature(feature.key)}
                              disabled={saving}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                  ? 'bg-green-600'
                                  : 'bg-gray-200'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Integration Features */}
                  <div className="mb-8">
                    <h5 className="text-sm font-medium text-gray-900 mb-4">Integration Features</h5>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {groupedFeatures.integration.map((feature) => (
                        <div
                          key={feature.key}
                          className={`border rounded-lg p-4 transition-all ${
                            selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                              ? 'border-green-200 bg-green-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <feature.icon className={`h-5 w-5 ${
                                selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`} />
                              <div>
                                <h6 className="text-sm font-medium text-gray-900">{feature.name}</h6>
                                <p className="text-xs text-gray-500">{feature.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleFeature(feature.key)}
                              disabled={saving}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                  ? 'bg-green-600'
                                  : 'bg-gray-200'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Features */}
                  <div className="mb-8">
                    <h5 className="text-sm font-medium text-gray-900 mb-4">Advanced Features</h5>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {groupedFeatures.advanced.map((feature) => (
                        <div
                          key={feature.key}
                          className={`border rounded-lg p-4 transition-all ${
                            selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                              ? 'border-green-200 bg-green-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <feature.icon className={`h-5 w-5 ${
                                selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`} />
                              <div>
                                <h6 className="text-sm font-medium text-gray-900">{feature.name}</h6>
                                <p className="text-xs text-gray-500">{feature.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleFeature(feature.key)}
                              disabled={saving}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                  ? 'bg-green-600'
                                  : 'bg-gray-200'
                              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  selectedOrg.featuresEnabled[feature.key as keyof typeof selectedOrg.featuresEnabled]
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                    </>
                  )}

                  {activeTab === 'statistics' && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-6">Organization Statistics</h4>
                      
                      {loadingStats ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : orgStats ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                                  <p className="text-2xl font-bold text-gray-900">{orgStats.users || 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CogIcon className="h-8 w-8 text-green-600" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-600">Configurations</p>
                                  <p className="text-2xl font-bold text-gray-900">{orgStats.configurations || 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CogIcon className="h-8 w-8 text-purple-600" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-600">Deployments</p>
                                  <p className="text-2xl font-bold text-gray-900">{orgStats.deployments || 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CogIcon className="h-8 w-8 text-yellow-600" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-600">Servers</p>
                                  <p className="text-2xl font-bold text-gray-900">{orgStats.servers || 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <CogIcon className="h-8 w-8 text-indigo-600" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-600">Conversations</p>
                                  <p className="text-2xl font-bold text-gray-900">{orgStats.conversations || 0}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <ShieldCheckIcon className="h-8 w-8 text-red-600" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-600">Assets</p>
                                  <p className="text-2xl font-bold text-gray-900">{orgStats.assets || 0}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* First User Information */}
                          {orgStats.firstUser && (
                            <div className="mt-8">
                              <h5 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                                <UserIcon className="h-5 w-5 text-blue-600 mr-2" />
                                First User (Founder)
                              </h5>
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                      <span className="text-lg font-medium text-blue-600">
                                        {orgStats.firstUser.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4 flex-1">
                                    <div className="text-lg font-semibold text-gray-900">
                                      {orgStats.firstUser.name}
                                    </div>
                                    <div className="text-sm text-gray-600 flex items-center mt-1">
                                      <EnvelopeIcon className="h-4 w-4 mr-1" />
                                      {orgStats.firstUser.email}
                                    </div>
                                    {(() => {
                                      const companyName = extractCompanyFromEmail(orgStats.firstUser.email);
                                      return companyName ? (
                                        <div className="text-sm text-blue-600 font-medium mt-2 flex items-center">
                                          <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                                          {companyName}
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No statistics available
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'platform' && isSuperAdmin && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                        <ShieldCheckIcon className="h-5 w-5 text-purple-600 mr-2" />
                        Platform Settings
                        <span className="ml-2 text-xs text-gray-500">(Super Admin Only)</span>
                      </h4>
                      
                      <div className="space-y-4">
                        {/* User Registration Toggle */}
                        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <ShieldCheckIcon className="h-5 w-5 text-purple-600" />
                              <div>
                                <h6 className="text-sm font-medium text-gray-900">User Registration</h6>
                                <p className="text-xs text-gray-500">
                                  Allow new users to register and create organizations
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => updateSystemSetting('user_registration_enabled', !systemSettings.user_registration_enabled)}
                              disabled={saving || loadingSettings}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                                systemSettings.user_registration_enabled
                                  ? 'bg-green-600'
                                  : 'bg-gray-200'
                              } ${saving || loadingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  systemSettings.user_registration_enabled
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-gray-600">
                            {systemSettings.user_registration_enabled 
                              ? "✅ New users can register and create organizations"
                              : "🚫 Registration is disabled - users must contact support"}
                          </div>
                        </div>

                        {/* Maintenance Mode Toggle */}
                        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                              <div>
                                <h6 className="text-sm font-medium text-gray-900">Maintenance Mode</h6>
                                <p className="text-xs text-gray-500">
                                  Enable maintenance mode to prevent new logins
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => updateSystemSetting('maintenance_mode', !systemSettings.maintenance_mode)}
                              disabled={saving || loadingSettings}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${
                                systemSettings.maintenance_mode
                                  ? 'bg-yellow-600'
                                  : 'bg-gray-200'
                              } ${saving || loadingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  systemSettings.maintenance_mode
                                    ? 'translate-x-5'
                                    : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-gray-600">
                            {systemSettings.maintenance_mode 
                              ? "⚠️ Platform is in maintenance mode - only admins can login"
                              : "✅ Platform is operational"}
                          </div>
                        </div>

                        {/* Webhook Notifications */}
                        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <EnvelopeIcon className="h-5 w-5 text-blue-600" />
                              <div className="flex-1">
                                <h6 className="text-sm font-medium text-gray-900">Webhook Notifications</h6>
                                <p className="text-xs text-gray-500">
                                  Get notified when new organizations are created
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Webhook URL
                              </label>
                              <div className="flex space-x-2">
                                <input
                                  type="url"
                                  placeholder="https://your-webhook-url.com/signup"
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  value={systemSettings.user_signup_webhook_url || ''}
                                  onChange={(e) => updateSystemSetting('user_signup_webhook_url', e.target.value)}
                                />
                                <button
                                  onClick={async () => {
                                    if (!systemSettings.user_signup_webhook_url) {
                                      setError('Please enter a webhook URL first');
                                      return;
                                    }
                                    
                                    try {
                                      setSaving(true);
                                      const token = localStorage.getItem('authToken');
                                      
                                      const response = await fetch('/api/system-settings/test-webhook', {
                                        method: 'POST',
                                        headers: {
                                          'Authorization': `Bearer ${token}`,
                                          'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({ 
                                          webhookUrl: systemSettings.user_signup_webhook_url 
                                        }),
                                      });
                                      
                                      if (response.ok) {
                                        setSuccessMessage('Test webhook sent successfully!');
                                      } else {
                                        const errorData = await response.json();
                                        setError(errorData.error || 'Failed to send test webhook');
                                      }
                                    } catch (err: any) {
                                      setError('Failed to send test webhook');
                                    } finally {
                                      setSaving(false);
                                      setTimeout(() => {
                                        setError(null);
                                        setSuccessMessage(null);
                                      }, 3000);
                                    }
                                  }}
                                  disabled={saving || !systemSettings.user_signup_webhook_url}
                                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {saving ? 'Testing...' : 'Test'}
                                </button>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <h6 className="text-sm font-medium text-gray-900">New Organization Signup Notifications</h6>
                                <p className="text-xs text-gray-500">
                                  Notify when users create new organizations (first-time signups only)
                                </p>
                              </div>
                              <button
                                onClick={() => updateSystemSetting('webhook_new_org_notifications', !systemSettings.webhook_new_org_notifications)}
                                disabled={saving || loadingSettings}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                  systemSettings.webhook_new_org_notifications
                                    ? 'bg-blue-600'
                                    : 'bg-gray-200'
                                } ${saving || loadingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    systemSettings.webhook_new_org_notifications
                                      ? 'translate-x-5'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Support Contact */}
                        <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <CogIcon className="h-5 w-5 text-gray-600" />
                            <div>
                              <h6 className="text-sm font-medium text-gray-900">Support Contact</h6>
                              <p className="text-xs text-gray-500">Support email shown to users</p>
                              <p className="text-sm text-gray-700 mt-1">
                                {systemSettings.support_contact || 'support@pulse.dev'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'sso' && isSuperAdmin && (
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                        <KeyIcon className="h-5 w-5 text-blue-600 mr-2" />
                        SSO Configuration
                        <span className="ml-2 text-xs text-gray-500">(Super Admin Only)</span>
                      </h4>
                      <SSOConfiguration />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                  <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No Organization Selected</h3>
                  <p className="mt-2 text-gray-500">Select an organization from the sidebar to manage its features</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border max-w-md shadow-lg rounded-lg bg-white">
            <form onSubmit={handleCreateOrganization}>
              <h3 className="text-lg font-medium text-gray-900 mb-6">Create New Organization</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter organization name"
                  />
                </div>
                
                <div>
                  <label htmlFor="orgDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="orgDescription"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description (optional)"
                  />
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Administrator Details</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Name *
                      </label>
                      <input
                        id="adminName"
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={createFormData.adminName}
                        onChange={(e) => setCreateFormData(prev => ({ ...prev, adminName: e.target.value }))}
                        placeholder="Administrator full name"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Email *
                      </label>
                      <input
                        id="adminEmail"
                        type="email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={createFormData.adminEmail}
                        onChange={(e) => setCreateFormData(prev => ({ ...prev, adminEmail: e.target.value }))}
                        placeholder="admin@organization.com"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Password *
                      </label>
                      <input
                        id="adminPassword"
                        type="password"
                        required
                        minLength={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={createFormData.adminPassword}
                        onChange={(e) => setCreateFormData(prev => ({ ...prev, adminPassword: e.target.value }))}
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFormData({
                      name: '',
                      description: '',
                      adminEmail: '',
                      adminName: '',
                      adminPassword: ''
                    });
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !createFormData.name || !createFormData.adminEmail || !createFormData.adminName || !createFormData.adminPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Deactivate Organization
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                This action will deactivate the organization "{deactivateOrgName}". 
                All users will lose access to this organization.
              </p>
              
              <div className="mb-4">
                <label htmlFor="confirmationInput" className="block text-sm font-medium text-gray-700 mb-2">
                  To confirm, please type the organization name: <strong>{deactivateOrgName}</strong>
                </label>
                <input
                  id="confirmationInput"
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Type organization name here..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setConfirmationInput('');
                    setDeactivateOrgId('');
                    setDeactivateOrgName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowDeactivateModal(false);
                    await performStatusToggle(deactivateOrgId, false);
                    setConfirmationInput('');
                    setDeactivateOrgId('');
                    setDeactivateOrgName('');
                  }}
                  disabled={confirmationInput !== deactivateOrgName || saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Deactivating...' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}