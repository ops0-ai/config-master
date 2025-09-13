'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { githubApi } from '@/lib/api';

interface GitHubIntegration {
  id: string;
  name: string;
  repositoryName: string;
  repositoryFullName: string;
  defaultBranch: string;
  basePath: string;
  githubUsername?: string;
}

interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface GeneratedCode {
  terraform: string;
  statefile: any;
  modular?: {
    files: Record<string, string>;
    structure: any;
  };
}

interface DiscoveryGitHubSyncModalProps {
  generatedCode: GeneratedCode;
  sessionId: string | null;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export default function DiscoveryGitHubSyncModal({ 
  generatedCode, 
  sessionId,
  onClose, 
  onSyncComplete 
}: DiscoveryGitHubSyncModalProps) {
  const [integrations, setIntegrations] = useState<GitHubIntegration[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pullRequestUrl?: string; branch?: string; filesUploaded?: number } | null>(null);

  // Form state
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [folderPath, setFolderPath] = useState<string>('pulse-infrastructure');
  const [commitMessage, setCommitMessage] = useState<string>('Add Pulse discovered infrastructure');
  const [createPR, setCreatePR] = useState<boolean>(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  useEffect(() => {
    if (selectedIntegration) {
      loadBranches();
    }
  }, [selectedIntegration]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await githubApi.getIntegrations();
      setIntegrations(response.data);
      
      // Pre-select first integration if only one exists
      if (response.data.length === 1) {
        setSelectedIntegration(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading GitHub integrations:', error);
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
      if (!selectedBranch && response.data.length > 0) {
        const defaultBranch = response.data.find((b: GitHubBranch) => b.name === integration.defaultBranch) 
          || response.data.find((b: GitHubBranch) => b.name === 'main')
          || response.data[0];
        setSelectedBranch(defaultBranch.name);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load repository branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSync = async () => {
    if (!selectedIntegration || !selectedBranch || !folderPath.trim() || !commitMessage.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSyncing(true);
      
      const integration = integrations.find(i => i.id === selectedIntegration);
      if (!integration) {
        throw new Error('Integration not found');
      }

      // Prepare files to sync
      const filesToSync: Record<string, string> = {};
      
      if (generatedCode.modular && generatedCode.modular.files) {
        // Use modular project structure
        Object.entries(generatedCode.modular.files).forEach(([filePath, content]) => {
          const fullPath = `${folderPath}/${filePath}`;
          filesToSync[fullPath] = content;
        });
      } else {
        // Use single file structure
        filesToSync[`${folderPath}/infrastructure.tf`] = generatedCode.terraform;
        filesToSync[`${folderPath}/terraform.tfstate`] = JSON.stringify(generatedCode.statefile, null, 2);
      }

      // Call the discovery sync endpoint
      const response = await fetch('/api/discovery/github-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          integrationId: selectedIntegration,
          branch: selectedBranch,
          folderPath: folderPath.trim(),
          files: filesToSync,
          commitMessage: commitMessage.trim(),
          createPR,
          sessionId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync to GitHub');
      }

      const result = await response.json();
      
      setSyncResult(result);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error syncing to GitHub:', error);
      toast.error(error.message || 'Failed to sync to GitHub');
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
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
              <h2 className="text-xl font-semibold text-gray-900">Sync Infrastructure to GitHub</h2>
              <p className="text-sm text-gray-600">Push your discovered infrastructure as code to a GitHub repository</p>
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
                You need to set up a GitHub integration first to sync your infrastructure code.
              </p>
              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/settings/integrations';
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Set up GitHub Integration
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* GitHub Integration Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GitHub Repository *
                </label>
                <select
                  value={selectedIntegration}
                  onChange={(e) => setSelectedIntegration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select GitHub repository...</option>
                  {integrations.map((integration) => {
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      />
                      <p className="text-sm text-amber-600 mt-1">
                        No branches found. This will create a new branch with your infrastructure code.
                      </p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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

              {/* Folder Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Path *
                </label>
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="infrastructure/discovered"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Folder where the infrastructure code will be stored in the repository
                </p>
              </div>

              {/* Commit Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commit Message *
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Add discovered infrastructure from Pulse"
                  rows={3}
                  required
                />
              </div>

              {/* Create PR Option */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="createPR"
                  checked={createPR}
                  onChange={(e) => setCreatePR(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="createPR" className="ml-2 block text-sm text-gray-700">
                  Create a pull request instead of committing directly
                </label>
              </div>

              {/* Files Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Files to Sync
                </label>
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  {generatedCode.modular && generatedCode.modular.files ? (
                    <ul className="text-xs text-gray-600 space-y-1">
                      {Object.keys(generatedCode.modular.files).map(file => (
                        <li key={file} className="flex items-center">
                          <CheckCircleIcon className="h-3 w-3 text-green-500 mr-2" />
                          {folderPath}/{file}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="text-xs text-gray-600 space-y-1">
                      <li className="flex items-center">
                        <CheckCircleIcon className="h-3 w-3 text-green-500 mr-2" />
                        {folderPath}/infrastructure.tf
                      </li>
                      <li className="flex items-center">
                        <CheckCircleIcon className="h-3 w-3 text-green-500 mr-2" />
                        {folderPath}/terraform.tfstate
                      </li>
                    </ul>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  These files will be synced to your GitHub repository
                </p>
              </div>
            </div>
          )}
        </div>

        {integrations.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={syncing}
            >
              Cancel
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || !selectedIntegration || !selectedBranch || !folderPath.trim() || !commitMessage.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Success Modal */}
      {showSuccessModal && syncResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {syncResult.pullRequestUrl ? 'Pull Request Created!' : 'Sync Successful!'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  onSyncComplete?.();
                  onClose();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {syncResult.pullRequestUrl ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Important: Review Required</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Please carefully review the generated infrastructure code before merging:
                        </p>
                        <ul className="text-sm text-blue-700 mt-2 space-y-1">
                          <li>• Check for any sensitive information</li>
                          <li>• Verify resource configurations</li>
                          <li>• Ensure naming conventions are correct</li>
                          <li>• Test the code locally if possible</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Your Pull Request is Ready:</p>
                    <div className="flex items-center space-x-2">
                      <LinkIcon className="h-4 w-4 text-gray-500" />
                      <a
                        href={syncResult.pullRequestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-800 underline flex items-center"
                      >
                        View Pull Request on GitHub
                        <ArrowTopRightOnSquareIcon className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>{syncResult.filesUploaded || 0} files</strong> have been successfully synced to branch <strong>{syncResult.branch}</strong>.
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      The infrastructure code has been committed directly to your repository. You can view the changes on GitHub.
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                {syncResult.pullRequestUrl && (
                  <a
                    href={syncResult.pullRequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                    Open Pull Request
                  </a>
                )}
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    onSyncComplete?.();
                    onClose();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}