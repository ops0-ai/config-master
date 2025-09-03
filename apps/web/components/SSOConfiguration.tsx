'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  KeyIcon,
  GlobeAltIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

interface SSOProvider {
  id: string;
  name: string;
  providerType: string;
  clientId: string;
  discoveryUrl?: string;
  issuerUrl: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userinfoUrl?: string;
  jwksUri?: string;
  scopes?: string[];
  autoProvisionUsers: boolean;
  defaultRole: string;
  firstUserRole: string;
  roleMapping: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DomainMapping {
  id: string;
  ssoProviderId: string;
  domain: string;
  organizationId: string;
  organizationName: string;
  isDefault: boolean;
}

export default function SSOConfiguration() {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [domainMappings, setDomainMappings] = useState<DomainMapping[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SSOProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    providerType: 'oidc',
    clientId: '',
    clientSecret: '',
    discoveryUrl: '',
    issuerUrl: '',
    authorizationUrl: '',
    tokenUrl: '',
    userinfoUrl: '',
    jwksUri: '',
    scopes: ['openid', 'profile', 'email'],
    autoProvisionUsers: true,
    defaultRole: 'viewer',
    firstUserRole: 'administrator',
    roleMapping: {},
    // Microsoft-specific fields
    tenantId: '',
  });

  const [domainFormData, setDomainFormData] = useState({
    ssoProviderId: '',
    domain: '',
    organizationId: '',
    isDefault: false,
  });

  useEffect(() => {
    const initializeData = async () => {
      try {
        setError(null);
        await Promise.allSettled([
          fetchProviders(),
          fetchDomainMappings(), 
          fetchOrganizations()
        ]);
      } catch (error: any) {
        console.error('Error initializing SSO configuration data:', error);
        setError('Failed to load SSO configuration data');
        toast.error('Failed to load SSO configuration data');
      }
    };
    
    initializeData();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await api.get('/sso/providers');
      setProviders(response.data || []);
    } catch (error: any) {
      console.error('Error fetching SSO providers:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. Super admin privileges required.');
      } else {
        toast.error('Failed to fetch SSO providers');
      }
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomainMappings = async () => {
    try {
      const response = await api.get('/sso/domain-mappings');
      setDomainMappings(response.data || []);
    } catch (error: any) {
      console.error('Error fetching domain mappings:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. Super admin privileges required.');
      } else {
        toast.error('Failed to fetch domain mappings');
      }
      setDomainMappings([]);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/admin/organizations');
      
      // Handle both array and paginated response formats
      const orgs = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.organizations || []);
      
      setOrganizations(orgs);
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. Super admin privileges required.');
      } else {
        toast.error('Failed to fetch organizations');
      }
      setOrganizations([]);
    }
  };

  // Helper function to detect and configure Microsoft Azure AD
  const isMicrosoftProvider = (name: string) => {
    return name.toLowerCase().includes('microsoft') || 
           name.toLowerCase().includes('azure') ||
           name.toLowerCase().includes('entra');
  };

  const configureMicrosoftProvider = (tenantId: string) => {
    if (!tenantId) return;
    
    const baseUrl = tenantId === 'common' || tenantId === 'organizations' || tenantId === 'consumers'
      ? `https://login.microsoftonline.com/${tenantId}`
      : `https://login.microsoftonline.com/${tenantId}`;
    
    // Microsoft doesn't provide OIDC discovery, so we configure endpoints manually
    setFormData(prev => ({
      ...prev,
      discoveryUrl: '', // Clear discovery URL - use manual configuration
      issuerUrl: `${baseUrl}/v2.0`,
      authorizationUrl: `${baseUrl}/oauth2/v2.0/authorize`,
      tokenUrl: `${baseUrl}/oauth2/v2.0/token`,
      userinfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      jwksUri: `${baseUrl}/discovery/v2.0/keys`,
      scopes: ['openid', 'profile', 'email'] // Ensure it's always an array
    }));
  };

  const handleSubmitProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Remove frontend-only fields before sending to API
      const { tenantId, ...apiPayload } = formData;
      
      if (editingProvider) {
        await api.put(`/sso/providers/${editingProvider.id}`, apiPayload);
        toast.success('SSO provider updated successfully');
      } else {
        await api.post('/sso/providers', apiPayload);
        toast.success('SSO provider created successfully');
      }
      
      setShowProviderForm(false);
      setEditingProvider(null);
      resetForm();
      fetchProviders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save SSO provider');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SSO provider?')) {
      return;
    }

    try {
      await api.delete(`/sso/providers/${id}`);
      toast.success('SSO provider deleted successfully');
      fetchProviders();
    } catch (error) {
      toast.error('Failed to delete SSO provider');
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingProvider(id);
    try {
      const response = await api.post(`/sso/providers/${id}/test`);
      
      if (response.data.success) {
        toast.success('SSO connection test successful!');
      } else {
        toast.error(`Test failed: ${response.data.error}`);
      }
    } catch (error) {
      toast.error('Failed to test SSO provider');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleToggleProvider = async (provider: SSOProvider) => {
    try {
      await api.put(`/sso/providers/${provider.id}`, {
        isActive: !provider.isActive
      });
      toast.success(`SSO provider ${!provider.isActive ? 'enabled' : 'disabled'}`);
      fetchProviders();
    } catch (error) {
      toast.error('Failed to toggle SSO provider');
    }
  };

  const handleAddDomainMapping = async () => {
    try {
      await api.post('/sso/domain-mappings', domainFormData);
      toast.success('Domain mapping added successfully');
      setDomainFormData({
        ssoProviderId: '',
        domain: '',
        organizationId: '',
        isDefault: false,
      });
      fetchDomainMappings();
    } catch (error) {
      toast.error('Failed to add domain mapping');
    }
  };

  const handleDeleteDomainMapping = async (id: string) => {
    try {
      await api.delete(`/sso/domain-mappings/${id}`);
      toast.success('Domain mapping deleted successfully');
      fetchDomainMappings();
    } catch (error) {
      toast.error('Failed to delete domain mapping');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      providerType: 'oidc',
      clientId: '',
      clientSecret: '',
      discoveryUrl: '',
      issuerUrl: '',
      authorizationUrl: '',
      tokenUrl: '',
      userinfoUrl: '',
      jwksUri: '',
      scopes: ['openid', 'profile', 'email'],
      autoProvisionUsers: true,
      defaultRole: 'viewer',
      firstUserRole: 'administrator',
      roleMapping: {},
      tenantId: '',
    });
  };

  const popularProviders = [
    { name: 'Google', discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration' },
    { name: 'Microsoft', discoveryUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration' },
    { name: 'Auth0', hint: 'https://YOUR-DOMAIN.auth0.com/.well-known/openid-configuration' },
    { name: 'Okta', hint: 'https://YOUR-DOMAIN.okta.com/.well-known/openid-configuration' },
    { name: 'Keycloak', hint: 'https://YOUR-DOMAIN/realms/YOUR-REALM/.well-known/openid-configuration' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading SSO configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <XCircleIcon className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error Loading SSO Configuration
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-red-100 px-3 py-1 rounded text-sm text-red-800 hover:bg-red-200"
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
    <div className="space-y-6">
      {/* SSO Providers Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">SSO Providers</h3>
          <button
            onClick={() => setShowProviderForm(true)}
            className="btn btn-primary btn-sm"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Provider
          </button>
        </div>

        {(providers || []).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <KeyIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No SSO providers configured</p>
            <p className="text-sm mt-1">Add your first SSO provider to enable single sign-on</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(providers || []).map((provider) => (
              <div key={provider.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{provider.name}</h4>
                    <p className="text-sm text-gray-500">Type: {provider.providerType.toUpperCase()}</p>
                    <p className="text-sm text-gray-500">Client ID: {provider.clientId}</p>
                    <p className="text-sm text-gray-500">
                      Auto-provision: {provider.autoProvisionUsers ? 'Yes' : 'No'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Default role: {provider.defaultRole} | First user: {provider.firstUserRole}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestProvider(provider.id)}
                      disabled={testingProvider === provider.id}
                      className="btn btn-secondary btn-sm"
                    >
                      {testingProvider === provider.id ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircleIcon className="h-4 w-4" />
                      )}
                      Test
                    </button>
                    <button
                      onClick={() => handleToggleProvider(provider)}
                      className={`btn btn-sm ${provider.isActive ? 'btn-success' : 'btn-secondary'}`}
                    >
                      {provider.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProvider(provider);
                        // Only include form fields, not database metadata
                        setFormData({
                          name: provider.name || '',
                          providerType: provider.providerType || 'oidc',
                          clientId: provider.clientId || '',
                          clientSecret: '', // Always empty for security
                          discoveryUrl: provider.discoveryUrl || '',
                          issuerUrl: provider.issuerUrl || '',
                          authorizationUrl: provider.authorizationUrl || '',
                          tokenUrl: provider.tokenUrl || '',
                          userinfoUrl: provider.userinfoUrl || '',
                          jwksUri: provider.jwksUri || '',
                          scopes: provider.scopes || ['openid', 'profile', 'email'],
                          autoProvisionUsers: provider.autoProvisionUsers ?? true,
                          defaultRole: provider.defaultRole || 'viewer',
                          firstUserRole: provider.firstUserRole || 'administrator',
                          roleMapping: provider.roleMapping || {},
                          tenantId: '', // Microsoft tenant ID field (frontend only)
                        });
                        setShowProviderForm(true);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="btn btn-danger btn-sm"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain Mappings Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Domain Mappings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Automatically assign users to organizations based on their email domain
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <select
            value={domainFormData.ssoProviderId}
            onChange={(e) => setDomainFormData({ ...domainFormData, ssoProviderId: e.target.value })}
            className="input"
          >
            <option value="">Select Provider</option>
            {(providers || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="example.com"
            value={domainFormData.domain}
            onChange={(e) => setDomainFormData({ ...domainFormData, domain: e.target.value })}
            className="input"
          />
          <select
            value={domainFormData.organizationId}
            onChange={(e) => setDomainFormData({ ...domainFormData, organizationId: e.target.value })}
            className="input"
          >
            <option value="">Select Organization</option>
            {(organizations || []).map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddDomainMapping}
            disabled={!domainFormData.ssoProviderId || !domainFormData.domain || !domainFormData.organizationId}
            className="btn btn-primary"
          >
            Add Mapping
          </button>
        </div>

        {(domainMappings || []).length > 0 && (
          <div className="space-y-2">
            {(domainMappings || []).map((mapping) => (
              <div key={mapping.id} className="flex justify-between items-center border rounded p-2">
                <div className="flex items-center space-x-3">
                  <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                  <span className="font-mono text-sm">{mapping.domain}</span>
                  <span className="text-gray-500">→</span>
                  <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{mapping.organizationName}</span>
                  {mapping.isDefault && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteDomainMapping(mapping.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Provider Form Modal */}
      {showProviderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-medium mb-4">
              {editingProvider ? 'Edit SSO Provider' : 'Add SSO Provider'}
            </h3>

            {/* Quick Setup Buttons */}
            {!editingProvider && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Quick setup for popular providers:</p>
                <div className="flex flex-wrap gap-2">
                  {(popularProviders || []).map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        console.log('🔍 Setting popular provider:', p);
                        setFormData({
                          ...formData,
                          name: p.name,
                          discoveryUrl: p.discoveryUrl || '',
                          tenantId: p.name === 'Microsoft' ? 'common' : '',
                          scopes: ['openid', 'profile', 'email'], // Ensure scopes is always an array
                        });
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitProvider} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  className="input"
                  placeholder={editingProvider ? 'Leave blank to keep existing' : ''}
                  required={!editingProvider}
                />
              </div>

              
              {/* Microsoft Azure AD specific configuration */}
              {isMicrosoftProvider(formData.name) && (
                <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">Microsoft Azure AD Configuration</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>Enter your Azure AD tenant ID to auto-configure endpoints.</p>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-blue-800 mb-1">
                          Tenant ID
                        </label>
                        <input
                          type="text"
                          value={formData.tenantId}
                          onChange={(e) => {
                            const tenantId = e.target.value;
                            setFormData({ ...formData, tenantId });
                            if (tenantId) {
                              configureMicrosoftProvider(tenantId);
                            }
                          }}
                          className="input"
                          placeholder="common, organizations, consumers, or your tenant ID"
                        />
                        <div className="mt-1 text-xs text-blue-600">
                          <p>• <strong>common</strong>: Allow both personal and work accounts</p>
                          <p>• <strong>organizations</strong>: Work accounts only</p>
                          <p>• <strong>consumers</strong>: Personal accounts only</p>
                          <p>• Your tenant UUID or domain (e.g., contoso.onmicrosoft.com)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discovery URL (Auto-configures endpoints)
                </label>
                <input
                  type="url"
                  value={formData.discoveryUrl}
                  onChange={(e) => setFormData({ ...formData, discoveryUrl: e.target.value })}
                  className="input"
                  placeholder="https://provider.com/.well-known/openid-configuration"
                />
                {isMicrosoftProvider(formData.name) && formData.tenantId && (
                  <div className="mt-1 text-xs text-green-600">
                    ✓ Auto-configured for Microsoft Azure AD
                  </div>
                )}
              </div>

              {!formData.discoveryUrl && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issuer URL
                    </label>
                    <input
                      type="url"
                      value={formData.issuerUrl}
                      onChange={(e) => setFormData({ ...formData, issuerUrl: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Authorization URL
                    </label>
                    <input
                      type="url"
                      value={formData.authorizationUrl}
                      onChange={(e) => setFormData({ ...formData, authorizationUrl: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token URL
                    </label>
                    <input
                      type="url"
                      value={formData.tokenUrl}
                      onChange={(e) => setFormData({ ...formData, tokenUrl: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      UserInfo URL
                    </label>
                    <input
                      type="url"
                      value={formData.userinfoUrl}
                      onChange={(e) => setFormData({ ...formData, userinfoUrl: e.target.value })}
                      className="input"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Role (for subsequent users)
                  </label>
                  <select
                    value={formData.defaultRole}
                    onChange={(e) => setFormData({ ...formData, defaultRole: e.target.value })}
                    className="input"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First User Role (for new orgs)
                  </label>
                  <select
                    value={formData.firstUserRole}
                    onChange={(e) => setFormData({ ...formData, firstUserRole: e.target.value })}
                    className="input"
                  >
                    <option value="administrator">Administrator</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.autoProvisionUsers}
                    onChange={(e) => setFormData({ ...formData, autoProvisionUsers: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Auto-provision new users
                  </span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderForm(false);
                    setEditingProvider(null);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProvider ? 'Update Provider' : 'Create Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}