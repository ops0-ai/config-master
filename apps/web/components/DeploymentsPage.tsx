'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ServerIcon,
  CpuChipIcon,
  ChartBarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { deploymentsApi, configurationsApi, serversApi, serverGroupsApi } from '@/lib/api';
import DeploymentScheduler from './DeploymentScheduler';

interface Deployment {
  id: string;
  name: string;
  description?: string;
  section?: string;
  version: number;
  parentDeploymentId?: string;
  configurationId: string;
  targetType: 'server' | 'serverGroup';
  targetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  logs?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  scheduleType?: 'immediate' | 'scheduled' | 'recurring';
  scheduledFor?: string;
  cronExpression?: string;
  timezone?: string;
  isActive?: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  configuration?: {
    id: string;
    name: string;
    type: string;
  };
  target?: {
    id: string;
    name: string;
    type: 'server' | 'serverGroup';
  };
}

interface DeploymentGroup {
  name: string;
  configurationId: string;
  targetId: string;
  targetType: 'server' | 'serverGroup';
  section: string;
  versions: Deployment[];
  latestVersion: Deployment;
}

interface Configuration {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface Server {
  id: string;
  name: string;
  ipAddress: string;
  status: string;
  groupId?: string;
}

interface ServerGroup {
  id: string;
  name: string;
  description?: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [runningDeployments, setRunningDeployments] = useState<Set<string>>(new Set());
  const [selectedVersions, setSelectedVersions] = useState<Record<string, number>>({});

  const [deploymentForm, setDeploymentForm] = useState({
    name: '',
    description: '',
    section: 'production',
    configurationIds: [] as string[],
    targetType: 'server' as 'server' | 'serverGroup',
    targetId: '',
    scheduleType: 'immediate' as 'immediate' | 'scheduled' | 'recurring',
    scheduledFor: '',
    cronExpression: '',
    timezone: 'UTC',
  });

  // Define the schedule change handler outside of conditional rendering
  const handleScheduleChange = useCallback((schedule: {
    scheduleType: 'immediate' | 'scheduled' | 'recurring';
    scheduledFor?: string;
    cronExpression?: string;
    timezone?: string;
  }) => {
    setDeploymentForm(prev => ({
      ...prev,
      scheduleType: schedule.scheduleType,
      scheduledFor: schedule.scheduledFor || '',
      cronExpression: schedule.cronExpression || '',
      timezone: schedule.timezone || 'UTC',
    }));
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Poll for running deployments and update modal if needed
  useEffect(() => {
    if (runningDeployments.size > 0 || (selectedDeployment?.status === 'running')) {
      const interval = setInterval(async () => {
        await loadDeployments();
        
        // Update selected deployment logs if modal is open and deployment is running
        if (showLogsModal && selectedDeployment?.status === 'running') {
          try {
            const response = await deploymentsApi.getById(selectedDeployment.id);
            setSelectedDeployment(response.data);
          } catch (error) {
            console.error('Error refreshing deployment logs:', error);
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [runningDeployments, showLogsModal, selectedDeployment]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deploymentsRes, configsRes, serversRes, groupsRes] = await Promise.all([
        deploymentsApi.getAll(),
        configurationsApi.getAll(),
        serversApi.getAll(),
        serverGroupsApi.getAll(),
      ]);

      const deploymentData = deploymentsRes.data;
      setDeployments(deploymentData);
      setConfigurations(configsRes.data);
      setServers(serversRes.data);
      setServerGroups(groupsRes.data);

      // Track running deployments
      const running = new Set<string>(
        deploymentData
          .filter((d: Deployment) => d.status === 'pending' || d.status === 'running')
          .map((d: Deployment) => d.id)
      );
      setRunningDeployments(running);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadDeployments = async () => {
    try {
      const response = await deploymentsApi.getAll();
      const deploymentData = response.data;
      setDeployments(deploymentData);

      // Update running deployments
      const running = new Set<string>(
        deploymentData
          .filter((d: Deployment) => d.status === 'pending' || d.status === 'running')
          .map((d: Deployment) => d.id)
      );
      setRunningDeployments(running);
    } catch (error) {
      console.error('Failed to refresh deployments:', error);
    }
  };

  const handleCreateDeployment = async () => {
    try {
      if (deploymentForm.configurationIds.length === 0 || !deploymentForm.targetId) {
        toast.error('Please select at least one configuration and a target');
        return;
      }

      const createdDeployments: string[] = [];
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create deployments for each selected configuration
      for (let i = 0; i < deploymentForm.configurationIds.length; i++) {
        const configId = deploymentForm.configurationIds[i];
        const config = configurations.find(c => c.id === configId);
        
        // Prepare deployment data with scheduling
        const deploymentData: any = {
          name: deploymentForm.configurationIds.length === 1 
            ? deploymentForm.name 
            : `${deploymentForm.name} - ${config?.name}`,
          description: deploymentForm.configurationIds.length > 1 
            ? `${deploymentForm.description}\n\nBatch: ${i + 1} of ${deploymentForm.configurationIds.length}` 
            : deploymentForm.description,
          section: deploymentForm.section,
          configurationId: configId,
          targetType: deploymentForm.targetType,
          targetId: deploymentForm.targetId,
          scheduleType: deploymentForm.scheduleType,
        };
        
        // Only add scheduling fields based on type
        if (deploymentForm.scheduleType === 'scheduled') {
          deploymentData.scheduledFor = deploymentForm.scheduledFor;
          deploymentData.timezone = deploymentForm.timezone;
        } else if (deploymentForm.scheduleType === 'recurring') {
          deploymentData.cronExpression = deploymentForm.cronExpression;
          deploymentData.timezone = deploymentForm.timezone;
        }
        
        const response = await deploymentsApi.create(deploymentData);
        createdDeployments.push(response.data.name || `Deployment ${i + 1}`);
      }
      
      const scheduleMessage = deploymentForm.scheduleType === 'immediate' 
        ? `${createdDeployments.length} deployment(s) created successfully` 
        : deploymentForm.scheduleType === 'scheduled'
        ? `${createdDeployments.length} scheduled deployment(s) created successfully`
        : `${createdDeployments.length} recurring deployment(s) created successfully`;
      
      toast.success(scheduleMessage);
      
      await loadData();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create deployment(s)');
    }
  };

  const handleRunDeployment = async (id: string) => {
    try {
      const deployment = deployments.find(d => d.id === id);
      
      // Check if this is part of a batch by looking for similar deployments
      const potentialBatch = deployments.filter(d => 
        d.name.includes(' - ') &&
        d.name.split(' - ')[0] === deployment?.name?.split(' - ')[0] &&
        d.targetId === deployment?.targetId &&
        d.section === deployment?.section &&
        (d.status === 'pending' || d.id === id)
      );
      
      if (potentialBatch.length > 1) {
        const confirmBatch = confirm(
          `This appears to be part of a batch of ${potentialBatch.length} deployments. ` +
          `Would you like to run all ${potentialBatch.length} deployments sequentially?`
        );
        
        if (confirmBatch) {
          await handleRunBatch(deployment!);
          return;
        }
      }
      
      await deploymentsApi.run(id);
      toast.success('Deployment started');
      
      // Add to running deployments immediately
      setRunningDeployments(prev => new Set(prev).add(id));
      await loadDeployments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start deployment');
    }
  };

  const handleRunBatch = async (firstDeployment: Deployment) => {
    try {
      // Find all deployments in the same batch
      const batchDeployments = deployments
        .filter(d => 
          d.name.includes(' - ') &&
          d.name.split(' - ')[0] === firstDeployment.name.split(' - ')[0] &&
          d.targetId === firstDeployment.targetId &&
          d.section === firstDeployment.section &&
          d.status === 'pending'
        )
        .sort((a, b) => {
          // Sort by creation time to maintain order
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      if (batchDeployments.length <= 1) {
        // Not a batch, run single deployment
        await deploymentsApi.run(firstDeployment.id);
        toast.success('Deployment started');
        setRunningDeployments(prev => new Set(prev).add(firstDeployment.id));
        await loadDeployments();
        return;
      }

      toast.success(`Starting batch deployment of ${batchDeployments.length} configurations...`);
      
      // Run deployments sequentially
      for (let i = 0; i < batchDeployments.length; i++) {
        const deployment = batchDeployments[i];
        
        try {
          // Add to running deployments
          setRunningDeployments(prev => new Set(prev).add(deployment.id));
          
          // Start the deployment
          await deploymentsApi.run(deployment.id);
          
          toast.success(`Started deployment ${i + 1} of ${batchDeployments.length}: ${deployment.configuration?.name || deployment.name}`);
          
          // Wait for this deployment to complete before starting the next
          await waitForDeploymentCompletion(deployment.id);
          
        } catch (error) {
          console.error(`Failed to run deployment ${deployment.name}:`, error);
          toast.error(`Failed to run deployment ${i + 1}: ${deployment.configuration?.name || deployment.name}`);
          // Continue with next deployment even if one fails
        }
      }
      
      await loadDeployments();
      toast.success(`Batch deployment completed!`);
      
    } catch (error: any) {
      toast.error('Failed to start batch deployment');
    }
  };

  const waitForDeploymentCompletion = async (deploymentId: string): Promise<void> => {
    return new Promise((resolve) => {
      const checkStatus = async () => {
        try {
          const response = await deploymentsApi.getById(deploymentId);
          const deployment = response.data;
          
          if (deployment.status === 'completed' || deployment.status === 'failed' || deployment.status === 'cancelled') {
            setRunningDeployments(prev => {
              const newSet = new Set(prev);
              newSet.delete(deploymentId);
              return newSet;
            });
            resolve();
          } else {
            // Check again in 2 seconds
            setTimeout(checkStatus, 2000);
          }
        } catch (error) {
          console.error('Error checking deployment status:', error);
          resolve(); // Resolve anyway to avoid hanging
        }
      };
      
      checkStatus();
    });
  };

  const handleCancelDeployment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this deployment?')) return;

    try {
      await deploymentsApi.cancel(id);
      toast.success('Deployment cancelled');
      
      setRunningDeployments(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      await loadDeployments();
    } catch (error: any) {
      toast.error('Failed to cancel deployment');
    }
  };

  const handleViewLogs = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setShowLogsModal(true);
  };

  const resetForm = () => {
    setDeploymentForm({
      name: '',
      description: '',
      section: 'production',
      configurationIds: [],
      targetType: 'server',
      targetId: '',
      scheduleType: 'immediate',
      scheduledFor: '',
      cronExpression: '',
      timezone: 'UTC',
    });
    setShowCreateModal(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'running':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'running':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'cancelled':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return null;
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  const getServerCountForGroup = (groupId: string) => {
    return servers.filter(server => server.groupId === groupId).length;
  };

  const getVersionCount = (deployment: Deployment) => {
    const parentId = deployment.parentDeploymentId || deployment.id;
    return deployments.filter(d => 
      (d.parentDeploymentId === parentId || d.id === parentId)
    ).length;
  };

  const deploymentSections = ['production', 'staging', 'development', 'testing', 'general'];
  
  // Group deployments by their parent/root deployment
  const groupDeploymentsByParent = (): Record<string, DeploymentGroup[]> => {
    const deploymentMap = new Map<string, Deployment[]>();
    
    // Group all versions together
    deployments.forEach(deployment => {
      const key = `${deployment.name}-${deployment.configurationId}-${deployment.targetId}`;
      if (!deploymentMap.has(key)) {
        deploymentMap.set(key, []);
      }
      deploymentMap.get(key)!.push(deployment);
    });
    
    // Convert to DeploymentGroup structure
    const groups: DeploymentGroup[] = [];
    deploymentMap.forEach((versions, key) => {
      // Sort versions by version number (descending)
      const sortedVersions = versions.sort((a, b) => b.version - a.version);
      const latestVersion = sortedVersions[0];
      
      groups.push({
        name: latestVersion.name,
        configurationId: latestVersion.configurationId,
        targetId: latestVersion.targetId,
        targetType: latestVersion.targetType,
        section: latestVersion.section || 'general',
        versions: sortedVersions,
        latestVersion
      });
    });
    
    // Group by section
    return deploymentSections.reduce((sectionGroups, section) => {
      sectionGroups[section] = groups.filter(g => g.section === section);
      return sectionGroups;
    }, {} as Record<string, DeploymentGroup[]>);
  };
  
  const groupedDeployments = groupDeploymentsByParent();
  
  // Get selected version for a deployment group
  const getSelectedVersion = (group: DeploymentGroup): Deployment => {
    const key = `${group.name}-${group.configurationId}-${group.targetId}`;
    const selectedVersion = selectedVersions[key];
    if (selectedVersion) {
      const version = group.versions.find(v => v.version === selectedVersion);
      if (version) return version;
    }
    return group.latestVersion;
  };
  
  // Set selected version for a deployment group
  const setSelectedVersion = (group: DeploymentGroup, version: number) => {
    const key = `${group.name}-${group.configurationId}-${group.targetId}`;
    setSelectedVersions(prev => ({ ...prev, [key]: version }));
  };

  const handleDeleteDeployment = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the deployment "${name}"?`)) return;

    try {
      await deploymentsApi.delete(id);
      toast.success('Deployment deleted successfully');
      await loadData();
    } catch (error: any) {
      toast.error('Failed to delete deployment');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="page-title">Deployments</h1>
          <p className="text-muted mt-1">
            Deploy configurations to servers and monitor execution
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-md"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Deployment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <ChartBarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deployments</p>
                <p className="text-2xl font-bold text-gray-900">{Object.values(groupedDeployments).flat().length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(groupedDeployments).flat().filter(g => g.latestVersion.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <ArrowPathIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Running</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(groupedDeployments).flat().filter(g => g.latestVersion.status === 'running' || g.latestVersion.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg mr-3">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.values(groupedDeployments).flat().filter(g => g.latestVersion.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deployments by Section */}
      {Object.values(groupedDeployments).flat().length === 0 ? (
        <div className="card">
          <div className="card-content">
            <div className="text-center py-12">
              <PlayIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No deployments yet</h3>
              <p className="text-gray-600 mb-6">Create your first deployment to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary btn-md"
              >
                Create Deployment
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {deploymentSections.map((section) => {
            const sectionDeployments = groupedDeployments[section];
            if (sectionDeployments.length === 0) return null;

            return (
              <div key={section} className="card">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 capitalize flex items-center space-x-2">
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        section === 'production' ? 'bg-red-500' :
                        section === 'staging' ? 'bg-yellow-500' :
                        section === 'development' ? 'bg-green-500' :
                        section === 'testing' ? 'bg-blue-500' : 'bg-gray-500'
                      }`}></span>
                      <span>{section} Deployments</span>
                    </h2>
                    <span className="text-sm text-gray-500">
                      {sectionDeployments.length} deployment{sectionDeployments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                <div className="card-content p-0">
                  <div className="divide-y divide-gray-200">
                    {sectionDeployments.map((group) => {
                      const deployment = getSelectedVersion(group);
                      const groupKey = `${group.name}-${group.configurationId}-${group.targetId}`;
                      return (
                <div key={groupKey} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(deployment.status)}
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {deployment.name}
                            {deployment.name.includes(' - ') && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full" title="Part of a batch deployment">
                                Batch
                              </span>
                            )}
                          </h3>
                          {/* Version Selector */}
                          <div className="flex items-center space-x-2">
                            {group.versions.length > 1 ? (
                              <>
                                <select
                                  value={deployment.version}
                                  onChange={(e) => setSelectedVersion(group, parseInt(e.target.value))}
                                  className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded border-0 focus:ring-1 focus:ring-blue-500"
                                  title="Select version to view"
                                >
                                  {group.versions.map((version) => (
                                    <option key={version.id} value={version.version}>
                                      v{version.version} - {version.status} ({new Date(version.createdAt).toLocaleDateString()})
                                    </option>
                                  ))}
                                </select>
                                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full" title={`${group.versions.length} versions total`}>
                                  {group.versions.length} versions
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                v{deployment.version}
                              </span>
                            )}
                          </div>
                          <span className={getStatusBadge(deployment.status)}>
                            {deployment.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <DocumentTextIcon className="h-4 w-4" />
                            <span>{deployment.configuration?.name || 'Configuration'}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            {deployment.targetType === 'server' ? (
                              <ServerIcon className="h-4 w-4" />
                            ) : (
                              <CpuChipIcon className="h-4 w-4" />
                            )}
                            <span>{deployment.target?.name || 'Target'}</span>
                          </div>
                          
                          {deployment.startedAt && (
                            <span>
                              Duration: {formatDuration(deployment.startedAt, deployment.completedAt)}
                            </span>
                          )}
                          
                          <span>
                            Created: {new Date(deployment.createdAt).toLocaleDateString()}
                          </span>
                          
                          {/* Scheduling Information */}
                          {deployment.scheduleType && deployment.scheduleType !== 'immediate' && (
                            <>
                              {deployment.scheduleType === 'scheduled' && deployment.scheduledFor && (
                                <span className="text-blue-600">
                                  Scheduled: {new Date(deployment.scheduledFor).toLocaleString()}
                                </span>
                              )}
                              {deployment.scheduleType === 'recurring' && deployment.cronExpression && (
                                <div className="flex flex-col">
                                  <span className="text-purple-600">
                                    Recurring: {deployment.cronExpression}
                                  </span>
                                  {deployment.nextRunAt && (
                                    <span className="text-xs text-gray-500">
                                      Next: {new Date(deployment.nextRunAt).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        {deployment.description && (
                          <p className="text-sm text-gray-600 mt-1">{deployment.description}</p>
                        )}
                        
                        {/* Inventory Preview */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-700">Target Inventory</span>
                            <span className="text-xs text-gray-500">
                              {deployment.targetType === 'server' ? 'Single Server' : 'Server Group'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900">
                            {deployment.targetType === 'server' ? (
                              <div className="flex items-center space-x-2">
                                <ServerIcon className="h-4 w-4 text-blue-500" />
                                <span>{deployment.target?.name || 'Unknown Server'}</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <CpuChipIcon className="h-4 w-4 text-purple-500" />
                                <span>{deployment.target?.name || 'Unknown Server Group'}</span>
                                {getServerCountForGroup(deployment.targetId) > 0 && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                    {getServerCountForGroup(deployment.targetId)} servers
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {deployment.logs && (
                        <button
                          onClick={() => handleViewLogs(deployment)}
                          className="btn btn-ghost btn-sm"
                          title={`View Console Logs for v${deployment.version}`}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          <span className="text-xs">Console</span>
                        </button>
                      )}
                      
                      {(deployment.status === 'pending' || deployment.status === 'failed' || deployment.status === 'completed') && (
                        <>
                          <button
                            onClick={() => handleRunDeployment(deployment.id)}
                            className="btn btn-secondary btn-sm"
                            title={
                              deployment.name.includes(' - ')
                                ? "Run this deployment (or entire batch if confirmed)"
                                : deployment.status === 'pending' 
                                  ? "Run Deployment" 
                                  : "Redeploy"
                            }
                          >
                            <PlayIcon className="h-4 w-4" />
                            <span className="ml-1">
                              {deployment.name.includes(' - ') && deployment.status === 'pending' 
                                ? 'Run Batch' 
                                : deployment.status === 'pending' 
                                  ? 'Run' 
                                  : 'Redeploy'
                              }
                            </span>
                          </button>
                        </>
                      )}
                      
                      {(deployment.status === 'running' || deployment.status === 'pending') && (
                        <button
                          onClick={() => handleCancelDeployment(deployment.id)}
                          className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                          title="Cancel Deployment"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      )}

                      {deployment.status !== 'running' && (
                        <button
                          onClick={() => handleDeleteDeployment(deployment.id, deployment.name)}
                          className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                          title="Delete This Version"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Deployment Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetForm();
            }
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">New Deployment</h2>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateDeployment(); }} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deployment Name
                </label>
                <input
                  type="text"
                  value={deploymentForm.name}
                  onChange={(e) => setDeploymentForm({...deploymentForm, name: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                  placeholder="e.g., Deploy NGINX to Production"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={deploymentForm.description}
                  onChange={(e) => setDeploymentForm({...deploymentForm, description: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 resize-y"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Environment Section
                </label>
                <select
                  value={deploymentForm.section}
                  onChange={(e) => setDeploymentForm({...deploymentForm, section: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6"
                  required
                >
                  <option value="production">🔴 Production</option>
                  <option value="staging">🟡 Staging</option>
                  <option value="development">🟢 Development</option>
                  <option value="testing">🔵 Testing</option>
                  <option value="general">⚪ General</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Configurations <span className="text-sm font-normal text-gray-500">(Select one or more)</span>
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setDeploymentForm(prev => ({
                        ...prev,
                        configurationIds: configurations.map(c => c.id)
                      }))}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setDeploymentForm(prev => ({
                        ...prev,
                        configurationIds: []
                      }))}
                      className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md">
                  {configurations.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No configurations available</div>
                  ) : (
                    configurations.map((config) => (
                      <div key={config.id} className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                        <input
                          type="checkbox"
                          id={`config-${config.id}`}
                          checked={deploymentForm.configurationIds.includes(config.id)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setDeploymentForm(prev => ({
                              ...prev,
                              configurationIds: isChecked
                                ? [...prev.configurationIds, config.id]
                                : prev.configurationIds.filter(id => id !== config.id)
                            }));
                          }}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`config-${config.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="text-sm font-medium text-gray-900">{config.name}</div>
                          <div className="text-xs text-gray-500">{config.type}{config.description && ` - ${config.description}`}</div>
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {deploymentForm.configurationIds.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    Selected: {deploymentForm.configurationIds.length} configuration(s)
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="server"
                      checked={deploymentForm.targetType === 'server'}
                      onChange={(e) => setDeploymentForm({...deploymentForm, targetType: e.target.value as 'server', targetId: ''})}
                      className="mr-2"
                    />
                    Single Server
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="serverGroup"
                      checked={deploymentForm.targetType === 'serverGroup'}
                      onChange={(e) => setDeploymentForm({...deploymentForm, targetType: e.target.value as 'serverGroup', targetId: ''})}
                      className="mr-2"
                    />
                    Server Group
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {deploymentForm.targetType === 'server' ? 'Server' : 'Server Group'}
                </label>
                <select
                  value={deploymentForm.targetId}
                  onChange={(e) => setDeploymentForm({...deploymentForm, targetId: e.target.value})}
                  className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6"
                  required
                >
                  <option value="">Select {deploymentForm.targetType === 'server' ? 'a server' : 'a server group'}...</option>
                  {deploymentForm.targetType === 'server' 
                    ? servers.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name} ({server.ipAddress})
                        </option>
                      ))
                    : serverGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))
                  }
                </select>
              </div>

              {/* Deployment Scheduling */}
              <DeploymentScheduler
                onScheduleChange={handleScheduleChange}
                initialSchedule={{
                  scheduleType: deploymentForm.scheduleType,
                  scheduledFor: deploymentForm.scheduledFor,
                  cronExpression: deploymentForm.cronExpression,
                  timezone: deploymentForm.timezone,
                }}
              />

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-secondary btn-md flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-md flex-1"
                >
                  Create Deployment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogsModal && selectedDeployment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Deployment Logs - {selectedDeployment.name}
                </h2>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    v{selectedDeployment.version}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(selectedDeployment.createdAt).toLocaleDateString()} {new Date(selectedDeployment.createdAt).toLocaleTimeString()}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    selectedDeployment.status === 'completed' ? 'bg-green-100 text-green-800' :
                    selectedDeployment.status === 'failed' ? 'bg-red-100 text-red-800' :
                    selectedDeployment.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    selectedDeployment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedDeployment.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLogsModal(false);
                  setSelectedDeployment(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Progress Bar for Running Deployments */}
              {selectedDeployment.status === 'running' && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">Deployment in progress...</span>
                    <ArrowPathIcon className="h-4 w-4 text-blue-600 animate-spin" />
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              )}
              
              {selectedDeployment.logs ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                    <span>📋 Console output for deployment v{selectedDeployment.version}</span>
                    <span>Deployment ID: {selectedDeployment.id.substring(0, 8)}...</span>
                  </div>
                  <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">
                    {selectedDeployment.logs}
                    {selectedDeployment.status === 'running' && (
                      <div className="mt-2 text-yellow-400 animate-pulse">
                        ▊ Deployment is still running...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No logs available yet for v{selectedDeployment.version}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex space-x-2">
                {selectedDeployment.status === 'running' && (
                  <button
                    onClick={() => {
                      handleCancelDeployment(selectedDeployment.id);
                      setShowLogsModal(false);
                      setSelectedDeployment(null);
                    }}
                    className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                  >
                    Cancel Deployment
                  </button>
                )}
                {(selectedDeployment.status === 'completed' || selectedDeployment.status === 'failed') && (
                  <button
                    onClick={() => {
                      handleRunDeployment(selectedDeployment.id);
                      setShowLogsModal(false);
                      setSelectedDeployment(null);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Redeploy
                  </button>
                )}
                </div>
                <button
                  onClick={() => {
                    setShowLogsModal(false);
                    setSelectedDeployment(null);
                  }}
                  className="btn btn-primary btn-md"
                >
                  Close
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex items-center">
                <span>💡 Each deployment version has its own isolated console stream</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}