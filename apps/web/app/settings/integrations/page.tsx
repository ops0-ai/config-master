'use client';

import { useState, useEffect } from 'react';

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

export default function IntegrationsPage() {
  const [showAWSConfig, setShowAWSConfig] = useState(false);
  const [awsIntegrations, setAwsIntegrations] = useState<AWSIntegration[]>([]);
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

  useEffect(() => {
    if (showAWSConfig) {
      loadAWSData();
    }
  }, [showAWSConfig]);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {!showAWSConfig ? (
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
        </>
      ) : (
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
    </div>
  );
}