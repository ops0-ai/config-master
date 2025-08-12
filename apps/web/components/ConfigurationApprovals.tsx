'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PlusIcon,
  XMarkIcon,
  DocumentTextIcon,
  FolderIcon,
  CodeBracketIcon,
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
  onClose: () => void;
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'playbook':
        return <DocumentTextIcon className="h-5 w-5 text-blue-600" />;
      case 'role':
        return <FolderIcon className="h-5 w-5 text-blue-600" />;
      case 'task':
        return <CodeBracketIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <DocumentTextIcon className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Configuration Approvals</h2>
            <p className="text-gray-600 mt-1">
              {user?.role === 'admin' ? 'Approve or reject configurations for deployment use' : 'View configuration approval status'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
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

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
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

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
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

              {/* Configuration Grid */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">All Configurations</h3>
                
                {configurations.length === 0 ? (
                  <div className="text-center py-12">
                    <PlusIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No configurations found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configurations.map((config) => (
                      <div key={config.id} className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                {getTypeIcon(config.type)}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                                  {getStatusIcon(config.approvalStatus)}
                                </div>
                                <div className="flex items-center flex-wrap gap-2">
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                    {config.type}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusColor(config.approvalStatus)}`}>
                                    {config.approvalStatus}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {config.description && (
                            <p className="text-sm text-gray-600 mb-4">{config.description}</p>
                          )}

                          <div className="text-xs text-gray-500 mb-4">
                            Created: {new Date(config.createdAt).toLocaleDateString()}
                            {config.approvedAt && (
                              <span className="ml-2">
                                • {config.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}: {new Date(config.approvedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {config.rejectionReason && (
                            <div className="text-xs text-red-600 mb-4 p-2 bg-red-50 rounded">
                              <strong>Rejection reason:</strong> {config.rejectionReason}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <button
                              onClick={() => {
                                setSelectedConfig(config);
                                setShowPreview(true);
                              }}
                              className="btn btn-secondary btn-sm"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View
                            </button>

                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                              <div className="flex gap-2">
                                {config.approvalStatus === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(config.id)}
                                      disabled={processingId === config.id}
                                      className="btn btn-success btn-sm"
                                    >
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      Approve
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        setSelectedConfig(config);
                                        setShowRejectModal(true);
                                      }}
                                      disabled={processingId === config.id}
                                      className="btn btn-danger btn-sm"
                                    >
                                      <XCircleIcon className="h-4 w-4 mr-1" />
                                      Reject
                                    </button>
                                  </>
                                )}

                                {(config.approvalStatus === 'approved' || config.approvalStatus === 'rejected') && (
                                  <button
                                    onClick={() => handleResetApproval(config.id)}
                                    disabled={processingId === config.id}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    <ClockIcon className="h-4 w-4 mr-1" />
                                    Reset
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
            ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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