'use client';

import { useState, useEffect } from 'react';
import { githubApi } from '@/lib/api';

interface AWSIntegration {
  id: string;
  name: string;
  roleArn: string;
  regions: string[];
  isActive: boolean;
  syncStatus: 'pending' | 'syncing' | 'success' | 'partial' | 'error';
  lastSyncAt?: string;
  createdAt: string;
}

interface AWSInstance {
  id: string;
  instanceId: string;
  name?: string;
  region: string;
  state: string;
  instanceType?: string;
  publicIp?: string;
  privateIp?: string;
  tags: Record<string, string>;
}

interface IAMPolicyResponse {
  externalId: string;
  trustPolicy: any;
  permissionsPolicy: any;
  instructions: string[];
}

interface GitHubIntegration {
  id: string;
  name: string;
  githubUsername: string;
  repositoryName: string;
  repositoryFullName: string;
  defaultBranch: string;
  basePath: string;
  isActive: boolean;
  autoFetch: boolean;
  fetchInterval: number;
  lastFetchAt?: string;
  lastSyncAt?: string;
  syncStatus: 'pending' | 'syncing' | 'connected' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  html_url: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export default function IntegrationsPage() {
  const [showAWSConfig, setShowAWSConfig] = useState(false);
  const [showGitHubConfig, setShowGitHubConfig] = useState(false);
  
  // AWS state
  const [awsIntegrations, setAwsIntegrations] = useState<AWSIntegration[]>([]);
  
  // GitHub state
  const [githubIntegrations, setGithubIntegrations] = useState<GitHubIntegration[]>([]);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepository[]>([]);
  const [githubAccessToken, setGithubAccessToken] = useState<string | null>(null);
  const [showGitHubSetup, setShowGitHubSetup] = useState(false);
  const [showGitHubSetupModal, setShowGitHubSetupModal] = useState(false);
  const [githubOrganizations, setGithubOrganizations] = useState<any[]>([]);
  const [repositoriesByOrg, setRepositoriesByOrg] = useState<Record<string, any[]>>({});
  const [personalRepos, setPersonalRepos] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('personal');
  const [awsRegions, setAwsRegions] = useState<string[]>([]);
  const [awsInstances, setAwsInstances] = useState<AWSInstance[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyData, setPolicyData] = useState<IAMPolicyResponse | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    roleArn: '',
    selectedRegions: [] as string[]
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; error?: string; identity?: any } | null>(null);

  const loadAWSData = async () => {
    if (!showAWSConfig) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      // Load integrations and regions in parallel
      const [integrationsRes, regionsRes] = await Promise.all([
        fetch('/api/aws', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/aws/regions', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (integrationsRes.ok) {
        const integrations = await integrationsRes.json();
        setAwsIntegrations(integrations);
      }

      if (regionsRes.ok) {
        const regions = await regionsRes.json();
        setAwsRegions(regions);
      }
    } catch (err) {
      console.error('Error loading AWS data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load AWS data');
    } finally {
      setLoading(false);
    }
  };

  const loadAWSInstances = async (integrationId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/aws/${integrationId}/instances`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load instances');
      }

      const data = await response.json();
      setAwsInstances(data);
      setSelectedIntegration(integrationId);
    } catch (err) {
      console.error('Error loading instances:', err);
      setError(err instanceof Error ? err.message : 'Failed to load instances');
    }
  };

  const generateIAMPolicy = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/aws/iam-policy', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate IAM policy');
      }

      const data = await response.json();
      setPolicyData(data);
      setShowPolicyModal(true);
    } catch (err) {
      console.error('Error generating IAM policy:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate IAM policy');
    }
  };

  const testConnection = async () => {
    if (!formData.roleArn || !policyData?.externalId) return;

    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/aws/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roleArn: formData.roleArn,
          externalId: policyData.externalId
        })
      });

      const data = await response.json();
      setConnectionResult(data);
    } catch (err) {
      console.error('Error testing connection:', err);
      setConnectionResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection test failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const createIntegration = async () => {
    if (!formData.name || !formData.roleArn || formData.selectedRegions.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/aws', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          roleArn: formData.roleArn,
          regions: formData.selectedRegions
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create integration');
      }

      const data = await response.json();
      setAwsIntegrations([...awsIntegrations, data]);
      setShowPolicyModal(false);
      setFormData({ name: '', roleArn: '', selectedRegions: [] });
      setPolicyData(null);
      setConnectionResult(null);
      await loadAWSData(); // Refresh the list
    } catch (err) {
      console.error('Error creating integration:', err);
      setError(err instanceof Error ? err.message : 'Failed to create integration');
    }
  };

  const syncIntegration = async (integrationId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/aws/${integrationId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      await loadAWSData(); // Refresh the list
      
      if (selectedIntegration === integrationId) {
        await loadAWSInstances(integrationId);
      }
    } catch (err) {
      console.error('Error syncing integration:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync integration');
    }
  };

  const importInstance = async (integrationId: string, instanceId: string, instanceData: AWSInstance) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/aws/${integrationId}/instances/${instanceId}/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: instanceData.name || `AWS-${instanceData.instanceId}`,
          username: 'ec2-user'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import instance');
      }

      alert('Instance imported successfully! You can find it in the Servers section.');
    } catch (err) {
      console.error('Error importing instance:', err);
      setError(err instanceof Error ? err.message : 'Failed to import instance');
    }
  };

  // GitHub functions
  const loadGitHubData = async () => {
    if (!showGitHubConfig) return;
    
    try {
      setLoading(true);
      const response = await githubApi.getIntegrations();
      setGithubIntegrations(response.data);
    } catch (err) {
      console.error('Error loading GitHub data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load GitHub data');
    } finally {
      setLoading(false);
    }
  };

  const [showTokenInput, setShowTokenInput] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
  
  const authenticateWithGitHub = async () => {
    if (!githubToken.trim()) {
      setError('Please enter your GitHub Personal Access Token');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await githubApi.authenticateWithToken(githubToken);
      const data = response.data;
      
      if (data.success) {
        setGithubUser(data.user);
        setGithubOrganizations(data.organizations || []);
        setRepositoriesByOrg(data.repositoriesByOrg || {});
        setPersonalRepos(data.personalRepos || []);
        setGithubAccessToken(data.accessToken);
        setShowGitHubSetup(true);
        setShowTokenInput(false);
        setGithubToken(''); // Clear token from state
      }
    } catch (err: any) {
      console.error('Error authenticating with GitHub:', err);
      setError(err.response?.data?.error || 'Failed to authenticate with GitHub. Please check your token.');
    } finally {
      setLoading(false);
    }
  };

  const createGitHubIntegration = async (formData: {
    name: string;
    repositoryId: string;
    repositoryName: string;
    repositoryFullName: string;
    defaultBranch: string;
    basePath: string;
  }) => {
    if (!githubUser || !githubAccessToken) {
      setError('GitHub authentication required');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      if (editingIntegrationId) {
        // Update existing integration (delete old and create new)
        const response = await fetch(`/api/github/integrations/${editingIntegrationId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to update GitHub integration');
        }
        
        // Remove old integration from state
        setGithubIntegrations(githubIntegrations.filter(i => i.id !== editingIntegrationId));
      }
      
      // Create new integration
      const response = await fetch('/api/github/integrations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          accessToken: githubAccessToken,
          user: githubUser
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create GitHub integration');
      }

      const integration = await response.json();
      setGithubIntegrations([...githubIntegrations.filter(i => i.id !== editingIntegrationId), integration]);
      setShowGitHubSetup(false);
      setGithubUser(null);
      setGithubRepositories([]);
      setGithubAccessToken(null);
      setEditingIntegrationId(null);
      
    } catch (err) {
      console.error('Error creating/updating GitHub integration:', err);
      setError(err instanceof Error ? err.message : 'Failed to create/update GitHub integration');
    } finally {
      setLoading(false);
    }
  };

  const refreshGitHubRepos = async (integrationId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the integration's stored token
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/github/integrations/${integrationId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh repositories');
      }

      const data = await response.json();
      
      // Update state with refreshed data
      setGithubUser(data.user);
      setGithubOrganizations(data.organizations || []);
      setRepositoriesByOrg(data.repositoriesByOrg || {});
      setPersonalRepos(data.personalRepos || []);
      setGithubAccessToken(data.accessToken);
      
      // Show success message
      setError(null);
      alert('Repositories refreshed successfully!');
    } catch (err) {
      console.error('Error refreshing repositories:', err);
      setError('Failed to refresh repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const changeRepository = async (integrationId: string) => {
    try {
      setLoading(true);
      setError(null);
      setEditingIntegrationId(integrationId);
      
      // Get the integration's stored token and fetch repos
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/github/integrations/${integrationId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      
      // Update state with data from stored token
      setGithubUser(data.user);
      setGithubOrganizations(data.organizations || []);
      setRepositoriesByOrg(data.repositoriesByOrg || {});
      setPersonalRepos(data.personalRepos || []);
      setGithubAccessToken(data.accessToken);
      setShowGitHubSetup(true);
    } catch (err) {
      console.error('Error fetching repositories:', err);
      setError('Failed to fetch repositories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteGitHubIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this GitHub integration?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/github/integrations/${integrationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete GitHub integration');
      }

      setGithubIntegrations(githubIntegrations.filter(i => i.id !== integrationId));
    } catch (err) {
      console.error('Error deleting GitHub integration:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete GitHub integration');
    }
  };

  useEffect(() => {
    if (showAWSConfig) {
      loadAWSData();
    } else if (showGitHubConfig) {
      loadGitHubData();
    }
  }, [showAWSConfig, showGitHubConfig]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {!showAWSConfig && !showGitHubConfig && (
        <>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
            <p className="mt-2 text-gray-600">
              Connect external services to extend your configuration management capabilities
            </p>
          </div>

          {/* Cloud Integrations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cloud Providers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* AWS Integration */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.75 11.35a4.32 4.32 0 0 0-.79-.26 4.18 4.18 0 0 0-.84-.09 4.34 4.34 0 0 0-3.47 1.69 4.19 4.19 0 0 0-.85 2.56v.3a4.17 4.17 0 0 0 .85 2.55 4.34 4.34 0 0 0 3.47 1.69 4.18 4.18 0 0 0 .84-.09c.28-.06.54-.15.79-.26v1.31H22V11.35zM10.32 5.1H8.54V3.32h1.78zm5.15 0h-1.78V3.32h1.78z"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">Amazon Web Services</h3>
                    <p className="text-sm text-gray-600">Connect to AWS to import EC2 instances</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAWSConfig(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Configure AWS
                </button>
              </div>

              {/* Placeholder for other cloud providers */}
              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-400">Google Cloud Platform</h3>
                    <p className="text-sm text-gray-400">Coming Soon</p>
                  </div>
                </div>
                <button 
                  disabled
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  Configure GCP
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8 8-3.59 8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-400">Microsoft Azure</h3>
                    <p className="text-sm text-gray-400">Coming Soon</p>
                  </div>
                </div>
                <button 
                  disabled
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  Configure Azure
                </button>
              </div>
            </div>
          </div>

          {/* Source Control Integrations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Source Control</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* GitHub Integration */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">GitHub</h3>
                    <p className="text-sm text-gray-600">Sync configurations with GitHub repositories</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGitHubConfig(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Configure GitHub
                </button>
              </div>

              {/* Placeholder for other source control providers */}
              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-400">GitLab</h3>
                    <p className="text-sm text-gray-400">Coming Soon</p>
                  </div>
                </div>
                <button 
                  disabled
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  Configure GitLab
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 opacity-50">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-400">Bitbucket</h3>
                    <p className="text-sm text-gray-400">Coming Soon</p>
                  </div>
                </div>
                <button 
                  disabled
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  Configure Bitbucket
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {showAWSConfig && (
        /* AWS Configuration Section */
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowAWSConfig(false);
                  setSelectedIntegration(null);
                  setAwsInstances([]);
                  setError(null);
                }}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Integrations
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AWS Integration</h1>
                <p className="mt-2 text-gray-600">
                  Connect to Amazon Web Services to import and manage your EC2 instances
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                generateIAMPolicy();
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add AWS Integration
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">Loading AWS data...</span>
            </div>
          )}

          {/* AWS Integrations List */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">AWS Integrations</h2>
            </div>
            {awsIntegrations.length === 0 && !loading ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">No AWS integrations configured</p>
                <p className="text-sm text-gray-400 mt-2">Click "Add AWS Integration" to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {awsIntegrations.map((integration) => (
                  <div key={integration.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
                        <p className="text-sm text-gray-600">Role: {integration.roleArn}</p>
                        <p className="text-sm text-gray-600">Regions: {integration.regions.join(', ')}</p>
                        <div className="flex items-center mt-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            integration.syncStatus === 'success' ? 'bg-green-100 text-green-800' :
                            integration.syncStatus === 'syncing' ? 'bg-yellow-100 text-yellow-800' :
                            integration.syncStatus === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {integration.syncStatus}
                          </span>
                          {integration.lastSyncAt && (
                            <span className="ml-2 text-xs text-gray-500">
                              Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => syncIntegration(integration.id)}
                          disabled={integration.syncStatus === 'syncing'}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          {integration.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                        </button>
                        <button
                          onClick={() => loadAWSInstances(integration.id)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          View Instances
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instances List */}
          {selectedIntegration && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">EC2 Instances</h2>
              </div>
              {awsInstances.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-500">No instances found</p>
                  <p className="text-sm text-gray-400 mt-2">Try syncing the integration to fetch instances</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instance</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {awsInstances.map((instance) => (
                        <tr key={instance.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {instance.name || instance.instanceId}
                              </div>
                              <div className="text-sm text-gray-500">{instance.instanceId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              instance.state === 'running' ? 'bg-green-100 text-green-800' :
                              instance.state === 'stopped' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {instance.state}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {instance.instanceType || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {instance.publicIp || instance.privateIp || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {instance.region}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => importInstance(selectedIntegration, instance.instanceId, instance)}
                              disabled={instance.state !== 'running'}
                              className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              Import as Server
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* IAM Policy Modal */}
      {showPolicyModal && policyData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">AWS IAM Setup</h3>
                <button
                  onClick={() => {
                    setShowPolicyModal(false);
                    setPolicyData(null);
                    setFormData({ name: '', roleArn: '', selectedRegions: [] });
                    setConnectionResult(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Instructions</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  {policyData.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">External ID</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <code className="text-sm text-gray-800">{policyData.externalId}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(policyData.externalId)}
                      className="ml-2 text-indigo-600 hover:text-indigo-500 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Trust Policy</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(policyData.trustPolicy, null, 2)}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(policyData.trustPolicy, null, 2))}
                      className="mt-2 text-indigo-600 hover:text-indigo-500 text-sm"
                    >
                      Copy Trust Policy
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Permissions Policy</h4>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(policyData.permissionsPolicy, null, 2)}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(policyData.permissionsPolicy, null, 2))}
                      className="mt-2 text-indigo-600 hover:text-indigo-500 text-sm"
                    >
                      Copy Permissions Policy
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">Create Integration</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Integration Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="My AWS Integration"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role ARN</label>
                    <input
                      type="text"
                      value={formData.roleArn}
                      onChange={(e) => setFormData({ ...formData, roleArn: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="arn:aws:iam::123456789012:role/ConfigManagementRole"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Regions to Monitor</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {awsRegions.map((region) => (
                        <label key={region} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.selectedRegions.includes(region)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  selectedRegions: [...formData.selectedRegions, region]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  selectedRegions: formData.selectedRegions.filter(r => r !== region)
                                });
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{region}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {formData.roleArn && (
                    <div>
                      <button
                        onClick={testConnection}
                        disabled={testingConnection}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {testingConnection ? 'Testing...' : 'Test Connection'}
                      </button>
                      
                      {connectionResult && (
                        <div className={`mt-2 p-3 rounded-md ${
                          connectionResult.success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className={`text-sm ${
                            connectionResult.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {connectionResult.success ? (
                              <>
                                ✅ Connection successful!
                                {connectionResult.identity && (
                                  <div className="mt-1 text-xs">
                                    Identity: {connectionResult.identity.arn}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="whitespace-pre-line">
                                {connectionResult.error}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowPolicyModal(false);
                      setPolicyData(null);
                      setConnectionResult(null);
                      setFormData({ name: '', roleArn: '', selectedRegions: [] });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createIntegration}
                    disabled={!connectionResult?.success}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Create Integration
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showGitHubConfig && (
        /* GitHub Configuration Section */
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowGitHubConfig(false);
                  setGithubUser(null);
                  setGithubRepositories([]);
                  setGithubAccessToken(null);
                  setShowGitHubSetup(false);
                  setError(null);
                }}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Integrations
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">GitHub Integration</h1>
                <p className="mt-2 text-gray-600">
                  Connect to GitHub to sync configurations with your repositories
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowTokenInput(true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Add GitHub Integration'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GitHub Token Input Modal */}
          {showTokenInput && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingIntegrationId ? 'Change Repository' : 'Connect to GitHub'}
                </h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    {editingIntegrationId ? 
                      'Enter your GitHub token to select a different repository.' :
                      <>
                        Create a token at{' '}
                        <a
                          href="https://github.com/settings/tokens/new?scopes=repo,read:org,user:email"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500"
                        >
                          GitHub Settings
                        </a>
                        {' '}with repo, read:org, and user:email scopes.
                      </>
                    }
                  </p>
                </div>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowTokenInput(false);
                      setGithubToken('');
                      setError(null);
                      setEditingIntegrationId(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={authenticateWithGitHub}
                    disabled={loading || !githubToken.trim()}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Authenticating...' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GitHub Integrations List */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">GitHub Integrations</h2>
            </div>
            {githubIntegrations.length === 0 && !loading ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">No GitHub integrations configured</p>
                <p className="text-sm text-gray-400 mt-2">Click "Add GitHub Integration" to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {githubIntegrations.map((integration) => (
                  <div key={integration.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{integration.name}</h3>
                        <p className="text-sm text-gray-600">Repository: {integration.repositoryFullName}</p>
                        <p className="text-sm text-gray-600">Branch: {integration.defaultBranch}</p>
                        <div className="flex items-center mt-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            integration.syncStatus === 'connected' ? 'bg-green-100 text-green-800' :
                            integration.syncStatus === 'syncing' ? 'bg-yellow-100 text-yellow-800' :
                            integration.syncStatus === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {integration.syncStatus}
                          </span>
                          {integration.lastSyncAt && (
                            <span className="ml-2 text-xs text-gray-500">
                              Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => refreshGitHubRepos(integration.id)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          title="Refresh repositories"
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                        <button
                          onClick={() => changeRepository(integration.id)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Change Repository
                        </button>
                        <button
                          onClick={() => deleteGitHubIntegration(integration.id)}
                          className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GitHub Setup Modal */}
      {showGitHubSetup && githubUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingIntegrationId ? 'Change Repository' : 'GitHub Integration Setup'}
                </h3>
                <button
                  onClick={() => {
                    setShowGitHubSetup(false);
                    setGithubUser(null);
                    setGithubRepositories([]);
                    setGithubAccessToken(null);
                    setGithubOrganizations([]);
                    setEditingIntegrationId(null);
                    setRepositoriesByOrg({});
                    setPersonalRepos([]);
                    setSelectedOrg('personal');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Connected as: {githubUser.login}</h4>
                <p className="text-sm text-gray-600 mb-4">Select an organization and repository to sync your configurations with</p>
                
                {/* Organization Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Organization</label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="personal">Personal ({githubUser.login})</option>
                    {githubOrganizations.map((org: any) => (
                      <option key={org.login} value={org.login}>
                        {org.login} {org.description && `- ${org.description}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-4">
                {/* Show repositories based on selected organization */}
                {(selectedOrg === 'personal' ? personalRepos : repositoriesByOrg[selectedOrg] || []).map((repo: any) => (
                  <div key={repo.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{repo.full_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{repo.description || 'No description'}</p>
                        <div className="flex items-center mt-2 space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            repo.private ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {repo.private ? 'Private' : 'Public'}
                          </span>
                          <span className="text-xs text-gray-500">Default branch: {repo.default_branch}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          createGitHubIntegration({
                            name: `${repo.name} Integration`,
                            repositoryId: repo.id.toString(),
                            repositoryName: repo.name,
                            repositoryFullName: repo.full_name,
                            defaultBranch: repo.default_branch,
                            basePath: '/configs'
                          });
                        }}
                        className="ml-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Select Repository
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Show message if no repositories available */}
                {selectedOrg !== 'personal' && (!repositoriesByOrg[selectedOrg] || repositoriesByOrg[selectedOrg].length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No repositories found for this organization.
                    <br />
                    <span className="text-sm">Make sure you have access to repositories in this organization.</span>
                  </div>
                )}
                
                {selectedOrg === 'personal' && personalRepos.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No personal repositories found.
                    <br />
                    <span className="text-sm">Create a repository on GitHub first.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}