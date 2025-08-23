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
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { githubApi } from '@/lib/api';

interface Asset {
  id: string;
  assetTag: string;
  serialNumber?: string;
  assetType: string;
  brand?: string;
  model?: string;
  status: string;
  condition: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currency?: string;
  supplier?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyProvider?: string;
  location?: string;
  costCenter?: string;
  department?: string;
  category?: string;
  subcategory?: string;
  specifications?: any;
  notes?: string;
  barcode?: string;
  qrCode?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedUserEmail?: string;
  assignedAt?: string;
  assignmentType?: string;
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

interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface AssetGitHubSyncModalProps {
  assets: Asset[];
  onClose: () => void;
  onSyncComplete: () => void;
}

export default function AssetGitHubSyncModal({ assets, onClose, onSyncComplete }: AssetGitHubSyncModalProps) {
  const [integrations, setIntegrations] = useState<GitHubIntegration[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Form state
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [relativePath, setRelativePath] = useState<string>('assets/asset-inventory.csv');
  const [commitMessage, setCommitMessage] = useState<string>('Update asset inventory');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');

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
      
      // Set default values
      if (response.data.length > 0) {
        const firstIntegration = response.data[0];
        setSelectedIntegration(firstIntegration.id);
        setSelectedBranch(firstIntegration.defaultBranch || 'main');
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
      if (!selectedBranch) {
        if (response.data.length === 0) {
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

  const generateAssetContent = () => {
    if (format === 'json') {
      return JSON.stringify(assets, null, 2);
    } else {
      // CSV format
      if (assets.length === 0) return '';
      
      const headers = [
        'Asset Tag',
        'Serial Number',
        'Asset Type',
        'Brand',
        'Model',
        'Status',
        'Condition',
        'Purchase Date',
        'Purchase Price',
        'Currency',
        'Supplier',
        'Warranty Start',
        'Warranty End',
        'Warranty Provider',
        'Location',
        'Cost Center',
        'Department',
        'Category',
        'Assigned User',
        'Assigned Email',
        'Assignment Type',
        'Notes'
      ];
      
      const csvContent = [
        headers.join(','),
        ...assets.map(asset => [
          `"${asset.assetTag || ''}"`,
          `"${asset.serialNumber || ''}"`,
          `"${asset.assetType || ''}"`,
          `"${asset.brand || ''}"`,
          `"${asset.model || ''}"`,
          `"${asset.status || ''}"`,
          `"${asset.condition || ''}"`,
          `"${asset.purchaseDate || ''}"`,
          `"${asset.purchasePrice || ''}"`,
          `"${asset.currency || ''}"`,
          `"${asset.supplier || ''}"`,
          `"${asset.warrantyStartDate || ''}"`,
          `"${asset.warrantyEndDate || ''}"`,
          `"${asset.warrantyProvider || ''}"`,
          `"${asset.location || ''}"`,
          `"${asset.costCenter || ''}"`,
          `"${asset.department || ''}"`,
          `"${asset.category || ''}"`,
          `"${asset.assignedUserName || ''}"`,
          `"${asset.assignedUserEmail || ''}"`,
          `"${asset.assignmentType || ''}"`,
          `"${asset.notes || ''}"`
        ].join(','))
      ].join('\n');
      
      return csvContent;
    }
  };

  const handleSync = async () => {
    if (!selectedIntegration || !selectedBranch || !relativePath.trim() || !commitMessage.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSyncing(true);
      
      const content = generateAssetContent();
      
      // Use the dedicated asset inventory sync endpoint
      await githubApi.syncAssetInventory(selectedIntegration, {
        relativePath: relativePath.trim(),
        branch: selectedBranch,
        content: content,
        commitMessage: commitMessage.trim(),
        format: format,
      });

      toast.success('Asset inventory synced to GitHub successfully');
      onSyncComplete();
      onClose();
    } catch (error: any) {
      console.error('Error syncing assets to GitHub:', error);
      toast.error(error.response?.data?.error || 'Failed to sync asset inventory to GitHub');
    } finally {
      setSyncing(false);
    }
  };

  const handlePathChange = (value: string) => {
    let path = value.trim();
    const extension = format === 'json' ? '.json' : '.csv';
    
    if (path && !path.endsWith(extension)) {
      // Remove any existing extension and add the correct one
      path = path.replace(/\.[^/.]+$/, '') + extension;
    }
    
    setRelativePath(path);
  };

  const handleFormatChange = (newFormat: 'csv' | 'json') => {
    setFormat(newFormat);
    
    // Update file path extension
    if (relativePath) {
      const pathWithoutExtension = relativePath.replace(/\.[^/.]+$/, '');
      const extension = newFormat === 'json' ? '.json' : '.csv';
      setRelativePath(pathWithoutExtension + extension);
    }
    
    // Update commit message
    setCommitMessage(`Update asset inventory (${newFormat.toUpperCase()})`);
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
              <h2 className="text-xl font-semibold text-gray-900">Sync Assets to GitHub</h2>
              <p className="text-sm text-gray-600">Export {assets.length} assets to a GitHub repository</p>
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
                You need to set up a GitHub integration first to sync assets.
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
              {/* Asset Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                  <ComputerDesktopIcon className="h-4 w-4 mr-2" />
                  Asset Summary
                </h3>
                <div className="text-sm text-blue-700">
                  <div><strong>Total Assets:</strong> {assets.length}</div>
                  <div className="mt-1">
                    <strong>Asset Types:</strong> {
                      Array.from(new Set(assets.map(a => a.assetType))).join(', ')
                    }
                  </div>
                  <div className="mt-1">
                    <strong>Export Format:</strong> {format.toUpperCase()}
                  </div>
                </div>
              </div>

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
                        ⚠️ No branches found. This will create a new branch with your assets.
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

              {/* Export Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="csv"
                      checked={format === 'csv'}
                      onChange={(e) => handleFormatChange(e.target.value as 'csv')}
                      className="mr-2"
                    />
                    CSV (Spreadsheet)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="json"
                      checked={format === 'json'}
                      onChange={(e) => handleFormatChange(e.target.value as 'json')}
                      className="mr-2"
                    />
                    JSON (Database)
                  </label>
                </div>
              </div>

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
                  placeholder={`assets/asset-inventory.${format}`}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Path where the asset inventory will be stored in the repository
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
                  placeholder="Update asset inventory..."
                  required
                />
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Preview
                </label>
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-gray-800">
                    <code>{generateAssetContent().substring(0, 500)}{generateAssetContent().length > 500 ? '...' : ''}</code>
                  </pre>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This content will be synced to GitHub ({format.toUpperCase()} format)
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