'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import toast from 'react-hot-toast';

interface Configuration {
  id: string;
  name: string;
  type: string;
  description?: string;
  content: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ConfigurationApprovalsProps {
  onClose?: () => void;
}

export default function ConfigurationApprovals({ onClose }: ConfigurationApprovalsProps) {
  const { user } = useMinimalAuth();
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/configurations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load configurations');
      }

      const data = await response.json();
      setConfigurations(data);
    } catch (error) {
      console.error('Error loading configurations:', error);
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (configId: string) => {
    try {
      setProcessingId(configId);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/configurations/${configId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve configuration');
      }

      toast.success('Configuration approved successfully');
      await loadConfigurations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve configuration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedConfig || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessingId(selectedConfig.id);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/configurations/${selectedConfig.id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject configuration');
      }

      toast.success('Configuration rejected');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedConfig(null);
      await loadConfigurations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject configuration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetApproval = async (configId: string) => {
    try {
      setProcessingId(configId);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/configurations/${configId}/reset-approval`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset approval status');
      }

      toast.success('Approval status reset to pending');
      await loadConfigurations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset approval status');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuration Approvals</h2>
          <p className="mt-1 text-sm text-gray-600">
            {user?.role === 'admin' ? 'Approve or reject configurations for deployment use' : 'View configuration approval status'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <ClockIcon className="h-6 w-6 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {configurations.filter(c => c.approvalStatus === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">
                {configurations.filter(c => c.approvalStatus === 'approved').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center">
            <XCircleIcon className="h-6 w-6 text-red-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-gray-900">
                {configurations.filter(c => c.approvalStatus === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">All Configurations</h3>
        </div>
        
        {configurations.length === 0 ? (
          <div className="p-8 text-center">
            <PlusIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No configurations found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {configurations.map((config) => (
              <div key={config.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(config.approvalStatus)}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">{config.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(config.approvalStatus)}`}>
                          {config.approvalStatus}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {config.type}
                        </span>
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-600">
                        {config.description && <p>{config.description}</p>}
                        <p className="mt-1">
                          Created: {new Date(config.createdAt).toLocaleDateString()}
                          {config.approvedAt && ` • ${config.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}: ${new Date(config.approvedAt).toLocaleDateString()}`}
                        </p>
                        {config.rejectionReason && (
                          <p className="mt-1 text-red-600">
                            <strong>Rejection reason:</strong> {config.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedConfig(config);
                        setShowPreview(true);
                      }}
                      className="btn btn-ghost btn-sm"
                      title="Preview Configuration"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>

                    {user?.role === 'admin' && (
                      <>
                        {config.approvalStatus === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(config.id)}
                              disabled={processingId === config.id}
                              className="btn btn-secondary btn-sm text-green-600 hover:text-green-700"
                              title="Approve Configuration"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              <span className="ml-1">Approve</span>
                            </button>
                            
                            <button
                              onClick={() => {
                                setSelectedConfig(config);
                                setShowRejectModal(true);
                              }}
                              disabled={processingId === config.id}
                              className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                              title="Reject Configuration"
                            >
                              <XCircleIcon className="h-4 w-4" />
                              <span className="ml-1">Reject</span>
                            </button>
                          </>
                        )}

                        {(config.approvalStatus === 'approved' || config.approvalStatus === 'rejected') && (
                          <button
                            onClick={() => handleResetApproval(config.id)}
                            disabled={processingId === config.id}
                            className="btn btn-ghost btn-sm"
                            title="Reset to Pending"
                          >
                            <ClockIcon className="h-4 w-4" />
                            <span className="ml-1">Reset</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Configuration Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700">Name</h4>
                <p className="text-sm text-gray-900">{selectedConfig.name}</p>
              </div>
              
              {selectedConfig.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Description</h4>
                  <p className="text-sm text-gray-900">{selectedConfig.description}</p>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-gray-700">Content</h4>
                <pre className="mt-1 text-xs text-gray-900 bg-gray-50 p-4 rounded-md overflow-x-auto">
                  {selectedConfig.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Reject Configuration</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedConfig(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Please provide a reason for rejecting "{selectedConfig.name}"
              </p>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={4}
              />
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setSelectedConfig(null);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || processingId === selectedConfig.id}
                  className="btn btn-primary btn-sm bg-red-600 hover:bg-red-700"
                >
                  {processingId === selectedConfig.id ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}