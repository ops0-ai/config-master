'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { githubApi } from '@/lib/api';

interface Configuration {
  id: string;
  name: string;
  description?: string;
  type: 'playbook' | 'role' | 'task';
  content: string;
  metadata?: {
    sourcePath?: string;
    sourceRepo?: string;
    sourceBranch?: string;
    importedAt?: string;
    [key: string]: any;
  };
}

interface GitHubIntegration {
  id: string;
  name: string;
  repositoryName: string;
  repositoryFullName: string;
  defaultBranch: string;
  basePath: string;
  githubUsername?: string;
}

interface GitHubMapping {
  id: string;
  githubIntegrationId: string;
  relativePath: string;
  branch: string;
  lastSyncedSha?: string;
  lastSyncAt?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  integrationName: string;
  repositoryName: string;
  repositoryFullName: string;
}

interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface GitHubSyncModalProps {
  configuration: Configuration;
  onClose: () => void;
  onSyncComplete: () => void;
}

export default function GitHubSyncModal({ configuration, onClose, onSyncComplete }: GitHubSyncModalProps) {
  const [integrations, setIntegrations] = useState<GitHubIntegration[]>([]);
  const [mappings, setMappings] = useState<GitHubMapping[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Form state
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [relativePath, setRelativePath] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [configuration.id]);

  useEffect(() => {
    // Set initial form values based on existing mapping, metadata, or defaults
    if (mappings.length > 0) {
      const mapping = mappings[0]; // Use first mapping
      setSelectedIntegration(mapping.githubIntegrationId);
      setSelectedBranch(mapping.branch);
      setRelativePath(mapping.relativePath);
      setCommitMessage(`Update ${configuration.name} configuration`);
    } else if (configuration.metadata?.sourcePath && configuration.metadata?.sourceRepo) {
      // Use metadata from import to pre-populate form
      const { sourcePath, sourceRepo, sourceBranch } = configuration.metadata;
      
      // Find integration that matches the source repo
      const matchingIntegration = integrations.find(integration => 
        integration.repositoryFullName === sourceRepo
      );
      
      if (matchingIntegration) {
        setSelectedIntegration(matchingIntegration.id);
        setSelectedBranch(sourceBranch || matchingIntegration.defaultBranch || 'main');
        setRelativePath(sourcePath);
        setCommitMessage(`Update ${configuration.name} configuration`);
      } else {
        // Repo not found in integrations, set path but let user choose integration
        setRelativePath(sourcePath);
        setCommitMessage(`Update ${configuration.name} configuration`);
      }
    } else {
      // Set defaults
      setRelativePath(`${configuration.name.toLowerCase().replace(/\s+/g, '-')}.yml`);
      setCommitMessage(`Add ${configuration.name} configuration`);
    }
  }, [mappings, configuration, integrations]);

  useEffect(() => {
    if (selectedIntegration) {
      loadBranches();
    }
  }, [selectedIntegration]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [integrationsResponse, mappingsResponse] = await Promise.all([
        githubApi.getIntegrations(),
        githubApi.getConfigurationMappings(configuration.id),
      ]);

      setIntegrations(integrationsResponse.data);
      setMappings(mappingsResponse.data);
    } catch (error) {
      console.error('Error loading GitHub data:', error);
      toast.error('Failed to load GitHub integrations');
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    if (!selectedIntegration) return;

    try {
      setLoadingBranches(true);
      const integration = integrations.find(i => i.id === selectedIntegration);
      if (!integration) return;

      const [owner, repo] = integration.repositoryFullName.split('/');
      const response = await githubApi.getBranches(selectedIntegration, owner, repo);
      setBranches(response.data);
      
      // Set default branch if not already set
      if (!selectedBranch) {
        if (response.data.length === 0) {
          // No branches exist, default to 'main'
          setSelectedBranch('main');
        } else if (integration.defaultBranch) {
          setSelectedBranch(integration.defaultBranch);
        }
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load repository branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSync = async () => {
    if (!selectedIntegration || !selectedBranch || !relativePath.trim() || !commitMessage.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSyncing(true);
      
      await githubApi.syncConfiguration(selectedIntegration, {
        configurationId: configuration.id,
        relativePath: relativePath.trim(),
        branch: selectedBranch,
        content: configuration.content,
        commitMessage: commitMessage.trim(),
      });

      toast.success('Configuration synced to GitHub successfully');
      onSyncComplete();
      onClose();
    } catch (error: any) {
      console.error('Error syncing to GitHub:', error);
      toast.error(error.response?.data?.error || 'Failed to sync configuration to GitHub');
    } finally {
      setSyncing(false);
    }
  };

  const getFileExtension = () => {
    switch (configuration.type) {
      case 'playbook':
        return '.yml';
      case 'role':
        return '.yml';
      case 'task':
        return '.yml';
      default:
        return '.yml';
    }
  };

  const handlePathChange = (value: string) => {
    // Ensure proper file extension
    let path = value.trim();
    const extension = getFileExtension();
    
    if (path && !path.endsWith(extension)) {
      // Remove any existing extension and add the correct one
      path = path.replace(/\.[^/.]+$/, '') + extension;
    }
    
    setRelativePath(path);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading GitHub integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <LinkIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Sync to GitHub</h2>
              <p className="text-sm text-gray-600">Sync "{configuration.name}" to a GitHub repository</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {integrations.length === 0 ? (
            <div className="text-center py-8">
              <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No GitHub Integrations</h3>
              <p className="text-gray-600 mb-4">
                You need to set up a GitHub integration first to sync configurations.
              </p>
              <button
                onClick={() => {
                  onClose();
                  // Navigate to integrations page
                  window.location.href = '/settings/integrations';
                }}
                className="btn btn-primary"
              >
                Set up GitHub Integration
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Import Status - Show when configuration was imported from GitHub */}
              {configuration.metadata?.sourcePath && configuration.metadata?.sourceRepo && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-900 mb-2 flex items-center">
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Imported from GitHub
                  </h3>
                  <div className="text-sm">
                    <div className="text-green-700">
                      <strong>Repository:</strong> {configuration.metadata.sourceRepo}
                    </div>
                    <div className="text-green-700 mt-1">
                      <strong>Original Path:</strong> {configuration.metadata.sourcePath}
                    </div>
                    {configuration.metadata.sourceBranch && (
                      <div className="text-green-700 mt-1">
                        <strong>Branch:</strong> {configuration.metadata.sourceBranch}
                      </div>
                    )}
                    <div className="text-green-600 text-xs mt-2">
                      Imported on {new Date(configuration.metadata.importedAt || '').toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Current Sync Status */}
              {mappings.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Current Sync Status</h3>
                  {mappings.map((mapping) => (
                    <div key={mapping.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-blue-700">{mapping.repositoryFullName}</span>
                        <span className="text-blue-600 ml-2">({mapping.branch})</span>
                        <span className="text-gray-600 ml-2">→ {mapping.relativePath}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`flex items-center space-x-1 ${
                          mapping.syncStatus === 'synced' 
                            ? 'text-green-600'
                            : mapping.syncStatus === 'error'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}>
                          {mapping.syncStatus === 'synced' && <CheckCircleIcon className="h-4 w-4" />}
                          {mapping.syncStatus === 'error' && <ExclamationTriangleIcon className="h-4 w-4" />}
                          {mapping.syncStatus === 'pending' && <ArrowPathIcon className="h-4 w-4" />}
                          <span className="capitalize">{mapping.syncStatus}</span>
                        </div>
                        {mapping.lastSyncAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(mapping.lastSyncAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* GitHub Integration Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Integration *
                </label>
                <select
                  value={selectedIntegration}
                  onChange={(e) => setSelectedIntegration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select GitHub integration...</option>
                  {integrations.map((integration) => {
                    // Extract owner from repository full name
                    const [owner] = integration.repositoryFullName.split('/');
                    const isOrg = owner !== integration.githubUsername;
                    
                    return (
                      <option key={integration.id} value={integration.id}>
                        {integration.name} ({integration.repositoryFullName})
                        {isOrg && ` - Org: ${owner}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Branch Selection */}
              {selectedIntegration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Branch *
                  </label>
                  {branches.length === 0 && !loadingBranches ? (
                    <div>
                      <input
                        type="text"
                        value={selectedBranch || 'main'}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        placeholder="Enter branch name (e.g., main)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                      <p className="text-sm text-amber-600 mt-1">
                        ⚠️ No branches found. This will create a new branch 'main' with your configuration.
                      </p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        disabled={loadingBranches}
                        required
                      >
                        <option value="">Select branch...</option>
                        {branches.map((branch) => (
                          <option key={branch.name} value={branch.name}>
                            {branch.name} {branch.protected && '(protected)'}
                          </option>
                        ))}
                      </select>
                      {loadingBranches && (
                        <p className="text-sm text-gray-500 mt-1">Loading branches...</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* File Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Path *
                </label>
                <input
                  type="text"
                  value={relativePath}
                  onChange={(e) => handlePathChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder={`configs/${configuration.name.toLowerCase().replace(/\s+/g, '-')}${getFileExtension()}`}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Path where the configuration will be stored in the repository
                </p>
              </div>

              {/* Commit Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commit Message *
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Update configuration..."
                  required
                />
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Preview
                </label>
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-gray-800">
                    <code>{configuration.content}</code>
                  </pre>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This content will be synced to GitHub
                </p>
              </div>
            </div>
          )}
        </div>

        {integrations.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="btn btn-secondary"
              disabled={syncing}
            >
              Cancel
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || !selectedIntegration || !selectedBranch || !relativePath.trim() || !commitMessage.trim()}
              className="btn btn-primary"
            >
              {syncing ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <LinkIcon className="h-5 w-5 mr-2" />
                  Sync to GitHub
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}