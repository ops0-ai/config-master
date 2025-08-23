'use client';

import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  FolderIcon, 
  DocumentIcon, 
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { githubApi } from '@/lib/api';

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  content?: string;
  sha?: string;
}

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: Array<{ name: string; content: string; path: string; type: string; metadata?: any }>) => void;
}

export default function GitHubImportModal({ isOpen, onClose, onImport }: GitHubImportModalProps) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirContents, setDirContents] = useState<Map<string, GitHubFile[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadIntegrations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedIntegration) {
      loadBranches();
    }
  }, [selectedIntegration]);

  useEffect(() => {
    if (selectedIntegration && selectedBranch) {
      loadRootFiles();
    }
  }, [selectedIntegration, selectedBranch]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await githubApi.getIntegrations();
      setIntegrations(response.data);
      if (response.data.length > 0) {
        setSelectedIntegration(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
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
      
      if (response.data.length > 0) {
        const defaultBranch = response.data.find((b: any) => b.name === integration.defaultBranch) || response.data[0];
        setSelectedBranch(defaultBranch.name);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load repository branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadRootFiles = async () => {
    if (!selectedIntegration || !selectedBranch) return;

    try {
      setLoadingFiles(true);
      const integration = integrations.find(i => i.id === selectedIntegration);
      if (!integration) return;

      const [owner, repo] = integration.repositoryFullName.split('/');
      const response = await githubApi.getRepositoryContents(
        selectedIntegration, 
        owner, 
        repo, 
        '', 
        selectedBranch
      );
      
      setFiles(response.data);
      setDirContents(new Map()); // Reset directory contents
      setExpandedDirs(new Set()); // Reset expanded directories
      setSelectedFiles(new Set()); // Reset selected files
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load repository contents');
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadDirectoryContents = async (dirPath: string) => {
    if (!selectedIntegration || !selectedBranch || dirContents.has(dirPath)) return;

    const newLoadingDirs = new Set(loadingDirs);
    newLoadingDirs.add(dirPath);
    setLoadingDirs(newLoadingDirs);

    try {
      const integration = integrations.find(i => i.id === selectedIntegration);
      if (!integration) return;

      const [owner, repo] = integration.repositoryFullName.split('/');
      const response = await githubApi.getRepositoryContents(
        selectedIntegration, 
        owner, 
        repo, 
        dirPath, 
        selectedBranch
      );
      
      const newDirContents = new Map(dirContents);
      newDirContents.set(dirPath, response.data);
      setDirContents(newDirContents);
    } catch (error) {
      console.error(`Error loading directory ${dirPath}:`, error);
      toast.error(`Failed to load directory contents: ${dirPath}`);
    } finally {
      const newLoadingDirs = new Set(loadingDirs);
      newLoadingDirs.delete(dirPath);
      setLoadingDirs(newLoadingDirs);
    }
  };

  const toggleDirectory = (dirPath: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
      loadDirectoryContents(dirPath);
    }
    setExpandedDirs(newExpanded);
  };

  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const detectFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'yml' || ext === 'yaml') {
      if (filename.includes('playbook')) return 'playbook';
      if (filename.includes('role')) return 'role';
      if (filename.includes('task')) return 'task';
      // For other YAML files like inventory, vars, etc., default to playbook
      return 'playbook'; // default for YAML files
    }
    // For all non-YAML files, treat as playbook (they can contain any configuration content)
    return 'playbook';
  };

  const handleImport = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Please select at least one file to import');
      return;
    }

    try {
      setImporting(true);
      const integration = integrations.find(i => i.id === selectedIntegration);
      if (!integration) return;

      const [owner, repo] = integration.repositoryFullName.split('/');
      const filesToImport = [];

      for (const filePath of Array.from(selectedFiles)) {
        try {
          const response = await githubApi.getFileContent(
            selectedIntegration,
            owner,
            repo,
            filePath,
            selectedBranch
          );
          
          const content = atob(response.data.content); // Decode base64
          const fileName = filePath.split('/').pop() || filePath;
          const type = detectFileType(fileName);
          
          filesToImport.push({
            name: fileName.replace(/\.(yml|yaml|ini|j2|sh|ps1|json)$/i, ''),
            content,
            path: filePath,
            type,
            metadata: { 
              sourcePath: filePath,
              sourceRepo: integration.repositoryFullName,
              sourceBranch: selectedBranch,
              originalFileName: fileName
            }
          });
        } catch (error) {
          console.error(`Error fetching file ${filePath}:`, error);
          toast.error(`Failed to fetch ${filePath}`);
        }
      }

      if (filesToImport.length > 0) {
        onImport(filesToImport);
        toast.success(`Imported ${filesToImport.length} configuration(s) from GitHub`);
        onClose();
      }
    } catch (error) {
      console.error('Error importing files:', error);
      toast.error('Failed to import configurations');
    } finally {
      setImporting(false);
    }
  };

  const renderFileTree = (items: GitHubFile[], depth: number = 0) => {
    return items.map((item) => {
      const fullPath = item.path;
      const isExpanded = expandedDirs.has(fullPath);
      const isSelected = selectedFiles.has(fullPath);
      const isLoading = loadingDirs.has(fullPath);
      const isYamlFile = item.type === 'file' && (item.name.endsWith('.yml') || item.name.endsWith('.yaml') || item.name.endsWith('.ini') || item.name.endsWith('.j2') || item.name.endsWith('.sh') || item.name.endsWith('.ps1') || item.name.endsWith('.json'));
      
      if (item.type === 'dir') {
        const dirContent = dirContents.get(fullPath) || [];
        
        return (
          <div key={fullPath} style={{ marginLeft: `${depth * 16}px` }}>
            <div
              className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
              onClick={() => toggleDirectory(fullPath)}
            >
              {isLoading ? (
                <ArrowPathIcon className="h-4 w-4 mr-1 text-gray-400 animate-spin" />
              ) : isExpanded ? (
                <ChevronDownIcon className="h-4 w-4 mr-1 text-gray-500" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 mr-1 text-gray-500" />
              )}
              <FolderIcon className="h-4 w-4 mr-2 text-yellow-600" />
              <span className="text-sm">{item.name}</span>
            </div>
            {isExpanded && dirContent.length > 0 && (
              <div>
                {renderFileTree(dirContent, depth + 1)}
              </div>
            )}
          </div>
        );
      }
      
      if (isYamlFile) {
        return (
          <div key={fullPath} style={{ marginLeft: `${(depth + 1) * 16}px` }}>
            <label className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleFileSelection(fullPath)}
                className="mr-2"
              />
              <DocumentIcon className="h-4 w-4 mr-2 text-blue-600" />
              <span className="text-sm">{item.name}</span>
              {item.size && (
                <span className="ml-2 text-xs text-gray-500">
                  ({(item.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </label>
          </div>
        );
      }
      
      return null;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Import from GitHub</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Repository Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repository
            </label>
            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={loading}
            >
              <option value="">Select repository...</option>
              {integrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.repositoryFullName}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Selection */}
          {selectedIntegration && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={loadingBranches}
              >
                <option value="">Select branch...</option>
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.protected && '(protected)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File Tree */}
          {selectedIntegration && selectedBranch && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Configuration Files (YAML/YML)
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
                {loadingFiles ? (
                  <div className="flex items-center justify-center py-8">
                    <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                    <span className="text-gray-500">Loading repository contents...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No files found in this repository
                  </div>
                ) : (
                  renderFileTree(files, 0)
                )}
              </div>
              {selectedFiles.size > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {selectedFiles.size} file(s) selected for import
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing || selectedFiles.size === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center"
          >
            {importing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Import Selected
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}