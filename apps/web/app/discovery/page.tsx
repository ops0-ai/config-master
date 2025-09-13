'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import DiscoveryGitHubSyncModal from '@/components/DiscoveryGitHubSyncModal';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { useOrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';
import { MagnifyingGlassCircleIcon } from '@heroicons/react/24/outline';

// Dynamically import Monaco Editor to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
});

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


interface DiscoveryResource {
  id: string;
  resourceType: string;
  resourceId: string;
  name: string;
  region: string;
  provider: string;
  tags: Record<string, string>;
  metadata: any;
  selected: boolean;
}

interface GeneratedCode {
  terraform: string;
  statefile: any;
  modular?: {
    files: Record<string, string>;
    structure: any;
  };
}

function DiscoveryContent() {
  const { isFeatureEnabled, loading: featuresLoading } = useOrganizationFeatures();
  const [step, setStep] = useState<'select-connection' | 'scanning' | 'resources' | 'code-view'>('select-connection');
  const [awsIntegrations, setAwsIntegrations] = useState<AWSIntegration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<DiscoveryResource[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string>('infrastructure.tf');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showGitHubSyncModal, setShowGitHubSyncModal] = useState(false);

  // Show loading state while checking feature access
  if (featuresLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if discovery feature is enabled
  if (!isFeatureEnabled('discovery')) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <MagnifyingGlassCircleIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Infrastructure Discovery Unavailable</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              The Infrastructure Discovery feature is not enabled for your organization.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your administrator to enable this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Resource type icons and colors
  const resourceTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
    'aws::ec2::instance': { icon: '🖥️', color: 'bg-blue-100 text-blue-800', label: 'EC2 Instance' },
    'aws::ec2::vpc': { icon: '🌐', color: 'bg-purple-100 text-purple-800', label: 'VPC' },
    'aws::ec2::subnet': { icon: '🔲', color: 'bg-green-100 text-green-800', label: 'Subnet' },
    'aws::ec2::security-group': { icon: '🔒', color: 'bg-yellow-100 text-yellow-800', label: 'Security Group' },
    'aws::s3::bucket': { icon: '🪣', color: 'bg-orange-100 text-orange-800', label: 'S3 Bucket' },
    'aws::rds::instance': { icon: '🗄️', color: 'bg-indigo-100 text-indigo-800', label: 'RDS Instance' },
    'aws::lambda::function': { icon: '⚡', color: 'bg-pink-100 text-pink-800', label: 'Lambda Function' },
    'aws::iam::role': { icon: '👤', color: 'bg-gray-100 text-gray-800', label: 'IAM Role' },
    'aws::elb::load-balancer': { icon: '⚖️', color: 'bg-teal-100 text-teal-800', label: 'Load Balancer' },
  };

  // Load AWS integrations, check for session URL
  useEffect(() => {
    loadAWSIntegrations();
    
    // Check for session parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    if (sessionParam) {
      loadSessionFromUrl(sessionParam);
    }
  }, []);


  const loadSessionFromUrl = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/discovery/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const sessionData = await response.json();
        setSessionId(sessionId);
        if (sessionData.generatedCode) {
          setGeneratedCode(sessionData.generatedCode);
          setStep('code-view');
          
          // Set initial file selection
          if (sessionData.generatedCode.modular && Object.keys(sessionData.generatedCode.modular.files).length > 0) {
            const firstFile = Object.keys(sessionData.generatedCode.modular.files).sort()[0];
            setSelectedFile(firstFile);
          }
        }
      }
    } catch (err) {
      console.error('Error loading session:', err);
    }
  };

  const loadAWSIntegrations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/aws', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const integrations = await response.json();
        setAwsIntegrations(integrations.filter((i: AWSIntegration) => i.isActive));
      }
    } catch (err) {
      console.error('Error loading AWS integrations:', err);
      setError('Failed to load cloud connections');
    } finally {
      setLoading(false);
    }
  };



  const startDiscovery = async () => {
    if (!selectedIntegration || selectedRegions.length === 0) {
      setError('Please select a cloud connection and at least one region');
      return;
    }

    setStep('scanning');
    setScanProgress(0);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      
      // Simulate progressive scanning
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/discovery/scan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          integrationId: selectedIntegration,
          regions: selectedRegions
        })
      });

      clearInterval(progressInterval);
      setScanProgress(100);

      if (!response.ok) {
        throw new Error('Discovery scan failed');
      }

      const data = await response.json();
      setResources(data.resources.map((r: any) => ({ ...r, selected: false })));
      
      // Auto-select all resources initially
      const allIds = new Set<string>(data.resources.map((r: any) => r.id));
      setSelectedResources(allIds);
      
      setTimeout(() => {
        setStep('resources');
      }, 500);
    } catch (err) {
      console.error('Discovery scan error:', err);
      setError('Failed to scan cloud resources. Please try again.');
      setStep('select-connection');
    }
  };

  const generateInfrastructureCode = async () => {
    const selectedResourcesList = resources.filter(r => selectedResources.has(r.id));
    
    if (selectedResourcesList.length === 0) {
      setError('Please select at least one resource to convert');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/discovery/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resources: selectedResourcesList,
          provider: 'opentofu'
        })
      });

      if (!response.ok) {
        throw new Error('Code generation failed');
      }

      const data = await response.json();
      setGeneratedCode(data);
      
      // Set session ID for URL construction
      if (data.sessionId) {
        setSessionId(data.sessionId);
        // Update URL without page reload
        const newUrl = `${window.location.pathname}?session=${data.sessionId}`;
        window.history.replaceState({}, '', newUrl);
      }
      
      // Set initial file selection based on available files
      if (data.modular && Object.keys(data.modular.files).length > 0) {
        const firstFile = Object.keys(data.modular.files).sort()[0];
        setSelectedFile(firstFile);
      } else {
        setSelectedFile('infrastructure.tf');
      }
      
      setStep('code-view');
    } catch (err) {
      console.error('Code generation error:', err);
      setError('Failed to generate infrastructure code. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const downloadCode = async (format: 'single' | 'modular' = 'single') => {
    if (format === 'single' && generatedCode) {
      // Legacy single-file download
      const tfBlob = new Blob([generatedCode.terraform], { type: 'text/plain' });
      const tfUrl = URL.createObjectURL(tfBlob);
      const tfLink = document.createElement('a');
      tfLink.href = tfUrl;
      tfLink.download = 'infrastructure.tf';
      tfLink.click();

      const stateBlob = new Blob([JSON.stringify(generatedCode.statefile, null, 2)], { type: 'application/json' });
      const stateUrl = URL.createObjectURL(stateBlob);
      const stateLink = document.createElement('a');
      stateLink.href = stateUrl;
      stateLink.download = 'terraform.tfstate';
      stateLink.click();
    } else {
      // Download modular project as ZIP
      await downloadModularProject(format);
    }
  };

  const downloadModularProject = async (format: 'modular' | 'single' = 'modular') => {
    const selectedResourcesList = resources.filter(r => selectedResources.has(r.id));
    
    if (selectedResourcesList.length === 0) {
      setError('Please select at least one resource to download');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/discovery/generate/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resources: selectedResourcesList,
          provider: 'opentofu',
          format: format
        })
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pulse-infrastructure-${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download infrastructure project. Please try again.');
    }
  };

  const toggleResourceSelection = (resourceId: string) => {
    const newSelected = new Set(selectedResources);
    if (newSelected.has(resourceId)) {
      newSelected.delete(resourceId);
    } else {
      newSelected.add(resourceId);
    }
    setSelectedResources(newSelected);
  };

  const toggleAllResources = () => {
    if (selectedResources.size === resources.length) {
      setSelectedResources(new Set());
    } else {
      setSelectedResources(new Set(resources.map(r => r.id)));
    }
  };

  const filteredResources = resources.filter(resource => {
    const matchesType = filterType === 'all' || resource.resourceType === filterType;
    const matchesSearch = resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          resource.resourceId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const integration = awsIntegrations.find(i => i.id === selectedIntegration);

  // Helper functions for file management
  const getFileExtension = (filename: string): string => {
    const ext = filename.split('.').pop();
    return ext ? ext.toLowerCase() : '';
  };

  const getLanguageForFile = (filename: string): string => {
    const ext = getFileExtension(filename);
    const languageMap: Record<string, string> = {
      'tf': 'hcl',
      'tfvars': 'hcl',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'shell',
      'py': 'python',
      'go': 'go',
      'js': 'javascript',
      'ts': 'typescript'
    };
    return languageMap[ext] || 'text';
  };

  const getFileContent = (filename: string): string => {
    if (!generatedCode) return '';
    
    if (generatedCode.modular && generatedCode.modular.files[filename]) {
      return generatedCode.modular.files[filename];
    }
    
    // Legacy single files
    if (filename === 'infrastructure.tf') {
      return generatedCode.terraform;
    } else if (filename === 'terraform.tfstate') {
      return JSON.stringify(generatedCode.statefile, null, 2);
    }
    
    return '';
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Infrastructure Discovery</h1>
              <p className="mt-1 text-sm text-gray-600">
                Discover cloud resources and convert them to Infrastructure as Code
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {/* Step indicator */}
              <div className="flex items-center space-x-2">
                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  step === 'select-connection' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  1. Select Cloud
                </div>
                <div className="text-gray-400">→</div>
                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  step === 'scanning' || step === 'resources' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  2. Discover Resources
                </div>
                <div className="text-gray-400">→</div>
                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  step === 'code-view' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  3. Generate IaC
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Select Cloud Connection */}
        {step === 'select-connection' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Cloud Connection</h2>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : awsIntegrations.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="mt-2 text-gray-600">No cloud connections available</p>
                  <p className="text-sm text-gray-500 mt-1">Please configure AWS integration in Settings → Integrations</p>
                  <a href="/settings/integrations" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    Configure Integration
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cloud Provider Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {awsIntegrations.map((integration) => (
                      <div
                        key={integration.id}
                        onClick={() => setSelectedIntegration(integration.id)}
                        className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                          selectedIntegration === integration.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18.75 11.35a4.32 4.32 0 0 0-.79-.26 4.18 4.18 0 0 0-.84-.09 4.34 4.34 0 0 0-3.47 1.69 4.19 4.19 0 0 0-.85 2.56v.3a4.17 4.17 0 0 0 .85 2.55 4.34 4.34 0 0 0 3.47 1.69 4.18 4.18 0 0 0 .84-.09c.28-.06.54-.15.79-.26v1.31H22V11.35zM10.32 5.1H8.54V3.32h1.78zm5.15 0h-1.78V3.32h1.78z"/>
                              </svg>
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <h3 className="text-sm font-medium text-gray-900">{integration.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">AWS Account</p>
                            <div className="mt-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                integration.syncStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {integration.syncStatus}
                              </span>
                            </div>
                          </div>
                          {selectedIntegration === integration.id && (
                            <div className="absolute top-2 right-2">
                              <svg className="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Region Selection */}
                  {selectedIntegration && (
                    <div className="mt-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Select Regions to Scan</h3>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                        {integration?.regions.map((region) => (
                          <label key={region} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedRegions.includes(region)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRegions([...selectedRegions, region]);
                                } else {
                                  setSelectedRegions(selectedRegions.filter(r => r !== region));
                                }
                              }}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">{region}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={startDiscovery}
                      disabled={!selectedIntegration || selectedRegions.length === 0}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start Discovery
                      <svg className="ml-2 -mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Scanning */}
        {step === 'scanning' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 mb-4">
                  <svg className="h-8 w-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Discovering Cloud Resources</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Scanning {selectedRegions.length} region{selectedRegions.length > 1 ? 's' : ''} for infrastructure...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">{scanProgress}% Complete</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Resource Selection */}
        {step === 'resources' && (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg">
              {/* Toolbar */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Discovered Resources ({resources.length})
                    </h2>
                    <button
                      onClick={toggleAllResources}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      {selectedResources.size === resources.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search resources..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    {/* Filter */}
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Types</option>
                      {Object.entries(resourceTypeConfig).map(([type, config]) => (
                        <option key={type} value={type}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Resource List */}
              <div className="max-h-[500px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Select
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Region
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tags
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredResources.map((resource) => {
                      const typeConfig = resourceTypeConfig[resource.resourceType] || {
                        icon: '📦',
                        color: 'bg-gray-100 text-gray-800',
                        label: resource.resourceType
                      };
                      return (
                        <tr key={resource.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedResources.has(resource.id)}
                              onChange={() => toggleResourceSelection(resource.id)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                              <span className="mr-1">{typeConfig.icon}</span>
                              {typeConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                              <div className="text-xs text-gray-500">{resource.resourceId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {resource.region}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(resource.tags).slice(0, 3).map(([key, value]) => (
                                <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {key}: {value}
                                </span>
                              ))}
                              {Object.keys(resource.tags).length > 3 && (
                                <span className="text-xs text-gray-400">+{Object.keys(resource.tags).length - 3} more</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {selectedResources.size} of {resources.length} resources selected
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setStep('select-connection')}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={generateInfrastructureCode}
                      disabled={selectedResources.size === 0 || loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Generating...' : 'Generate IaC'}
                      <svg className="ml-2 -mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Code View */}
        {step === 'code-view' && generatedCode && (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg">
              {/* Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Generated Infrastructure Code</h2>
                    <p className="text-sm text-gray-600 mt-1">OpenTofu/Terraform configuration and state file</p>
                    {sessionId && (
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="text-xs text-gray-500">Shareable URL:</span>
                        <div className="flex items-center space-x-1">
                          <input 
                            type="text" 
                            value={`${window.location.origin}/discovery?session=${sessionId}`}
                            readOnly
                            className="text-xs bg-gray-100 px-2 py-1 rounded border text-gray-700 w-80"
                          />
                          <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/discovery?session=${sessionId}`)}
                            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded border"
                            title="Copy URL"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setStep('resources')}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Back
                    </button>

                    {/* GitHub Sync Button */}
                    <button
                      onClick={() => setShowGitHubSyncModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="mr-2 -ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                      </svg>
                      Sync to GitHub
                    </button>
                    
                    {/* Dropdown for download options */}
                    <div className="relative inline-block text-left">
                      <div className="flex">
                        <button
                          onClick={() => downloadModularProject('modular')}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-l-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Download Modular Project
                        </button>
                        
                        <div className="relative">
                          <button
                            onClick={() => {
                              const dropdown = document.getElementById('download-dropdown');
                              dropdown?.classList.toggle('hidden');
                            }}
                            className="inline-flex items-center px-2 py-2 border-l border-indigo-500 text-sm font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          <div id="download-dropdown" className="hidden absolute right-0 z-10 mt-2 w-72 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  downloadModularProject('modular');
                                  document.getElementById('download-dropdown')?.classList.add('hidden');
                                }}
                                className="flex w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <div>
                                  <div className="font-medium">Modular Project (ZIP)</div>
                                  <div className="text-xs text-gray-500">Complete project with modules, variables, and scripts</div>
                                </div>
                              </button>
                              
                              <button
                                onClick={() => {
                                  downloadCode('single');
                                  document.getElementById('download-dropdown')?.classList.add('hidden');
                                }}
                                className="flex w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div>
                                  <div className="font-medium">Single Files</div>
                                  <div className="text-xs text-gray-500">Basic .tf and .tfstate files only</div>
                                </div>
                              </button>
                              
                              <button
                                onClick={() => {
                                  downloadModularProject('single');
                                  document.getElementById('download-dropdown')?.classList.add('hidden');
                                }}
                                className="flex w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div>
                                  <div className="font-medium">Simple Project (ZIP)</div>
                                  <div className="text-xs text-gray-500">Basic files with README and import scripts</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Editor Interface */}
              <div className="flex h-[600px] overflow-hidden">
                {/* File Explorer Sidebar */}
                <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-900">Generated Files</h3>
                    <p className="text-xs text-gray-500 mt-1">Project structure and configuration</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {generatedCode.modular && Object.keys(generatedCode.modular.files).length > 0 ? (
                      <FileTree 
                        files={generatedCode.modular.files}
                        selectedFile={selectedFile}
                        onFileSelect={setSelectedFile}
                      />
                    ) : (
                      // Legacy single files
                      <div className="space-y-1">
                        <FileButton
                          filePath="infrastructure.tf"
                          fileName="infrastructure.tf"
                          extension="tf"
                          selected={selectedFile === 'infrastructure.tf'}
                          onClick={() => setSelectedFile('infrastructure.tf')}
                        />
                        <FileButton
                          filePath="terraform.tfstate"
                          fileName="terraform.tfstate"  
                          extension="json"
                          selected={selectedFile === 'terraform.tfstate'}
                          onClick={() => setSelectedFile('terraform.tfstate')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 flex flex-col">
                  {/* File Tab Header */}
                  <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-900">{selectedFile}</span>
                    <div className="ml-auto flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {getLanguageForFile(selectedFile)}
                      </span>
                    </div>
                  </div>

                  {/* Code Editor */}
                  <div className="flex-1">
                    <Editor
                      language={getLanguageForFile(selectedFile)}
                      theme="vs-dark"
                      value={getFileContent(selectedFile)}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        folding: true,
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-6 bg-blue-50 border-t border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">How to use these files:</h4>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Download the project using the button above</li>
                  <li>Extract the ZIP file to your desired location</li>
                  <li>Navigate to the project directory in your terminal</li>
                  <li>Run <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">tofu init</code> to initialize the project</li>
                  <li>Run <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">tofu plan</code> to review the infrastructure</li>
                  <li>Run <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">tofu apply</code> to manage your infrastructure</li>
                </ol>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* GitHub Sync Modal */}
      {showGitHubSyncModal && generatedCode && (
        <DiscoveryGitHubSyncModal
          generatedCode={generatedCode}
          sessionId={sessionId}
          onClose={() => setShowGitHubSyncModal(false)}
          onSyncComplete={() => {
            setShowGitHubSyncModal(false);
            toast.success('Infrastructure synced to GitHub successfully!');
          }}
        />
      )}
    </div>
  );
}

// File selector component with icons
interface FileButtonProps {
  filePath: string;
  fileName: string;
  extension: string;
  selected: boolean;
  onClick: () => void;
  indent?: number;
}

function FileButton({ filePath, fileName, extension, selected, onClick, indent = 0 }: FileButtonProps) {
  const getFileIcon = (ext: string) => {
    const icons: Record<string, string> = {
      tf: "🏗️",
      tfvars: "⚙️", 
      md: "📄",
      json: "📋",
      yaml: "📝",
      yml: "📝",
      sh: "⚡",
    };
    return icons[ext] || "📄";
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${
        selected 
          ? "bg-indigo-100 text-indigo-900 border-l-2 border-indigo-500" 
          : "hover:bg-gray-100 text-gray-700"
      }`}
      style={{ paddingLeft: `${12 + (indent * 12)}px` }}
    >
      <span className="mr-2">{getFileIcon(extension)}</span>
      {fileName}
    </button>
  );
}

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex > 0 ? filename.slice(lastDotIndex + 1) : "";
}

// File tree component for modular structure
interface FileTreeProps {
  files: Record<string, string>;
  selectedFile: string;
  onFileSelect: (filePath: string) => void;
}

function FileTree({ files, selectedFile, onFileSelect }: FileTreeProps) {
  // Create proper nested directory structure
  interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children: Record<string, FileNode>;
  }
  
  const root: FileNode = { name: '', path: '', isDirectory: true, children: {} };
  
  // Build tree structure
  Object.keys(files).forEach(filePath => {
    const parts = filePath.split('/');
    let currentNode = root;
    let currentPath = '';
    
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLastPart = index === parts.length - 1;
      
      if (!currentNode.children[part]) {
        currentNode.children[part] = {
          name: part,
          path: currentPath,
          isDirectory: !isLastPart,
          children: {}
        };
      }
      currentNode = currentNode.children[part];
    });
  });
  
  // Render tree recursively
  const renderNode = (node: FileNode, depth: number = 0): React.ReactNode[] => {
    const entries = Object.entries(node.children).sort(([a, nodeA], [b, nodeB]) => {
      // Directories first, then files
      if (nodeA.isDirectory !== nodeB.isDirectory) {
        return nodeA.isDirectory ? -1 : 1;
      }
      return a.localeCompare(b);
    });
    
    return entries.map(([key, childNode]) => (
      <div key={childNode.path}>
        {childNode.isDirectory ? (
          <>
            <div 
              className="flex items-center px-3 py-1 text-xs font-medium text-gray-600"
              style={{ marginLeft: `${depth * 16}px` }}
            >
              <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
              </svg>
              📁 {childNode.name}/
            </div>
            {renderNode(childNode, depth + 1)}
          </>
        ) : (
          <FileButton
            key={childNode.path}
            filePath={childNode.path}
            fileName={childNode.name}
            extension={getFileExtension(childNode.name)}
            selected={selectedFile === childNode.path}
            onClick={() => onFileSelect(childNode.path)}
            indent={depth + 1}
          />
        )}
      </div>
    ));
  };

  return (
    <div className="space-y-1">
      {renderNode(root)}
    </div>
  );
}

export default function DiscoveryPage() {
  return (
    <Layout>
      <DiscoveryContent />
    </Layout>
  );
}
