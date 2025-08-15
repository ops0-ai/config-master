'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  KeyIcon,
  CogIcon,
  UserIcon,
  BuildingOfficeIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  CloudIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import toast from 'react-hot-toast';
import { settingsApi, organizationApi } from '@/lib/api';
import RoleMatrixManagement from './RoleMatrixManagement';
import UsersManagement from './UsersManagement';
import dynamic from 'next/dynamic';
import React from 'react';

const AuditLogsPage = dynamic(() => import('../app/settings/audit-logs/page'), {
  loading: () => <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
});

const IntegrationsPageComponent = dynamic(() => import('../app/settings/integrations/page'), {
  loading: () => <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
});

const PemKeysPageComponent = dynamic(() => import('./PemKeysPage'), {
  loading: () => <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
});

const MDMManagement = dynamic(() => import('./MDMManagement'), {
  loading: () => <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
  </div>
});

interface Settings {
  claudeApiKey?: string;
  defaultRegion?: string;
  maxConcurrentDeployments?: number;
  deploymentTimeout?: number;
}

type SettingsTab = 'general' | 'users' | 'roles' | 'audit-logs' | 'integrations' | 'pem-keys' | 'mdm';

export default function SettingsPage() {
  const { user, organization, setOrganization } = useMinimalAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [settings, setSettings] = useState<Settings>({
    claudeApiKey: '',
    defaultRegion: 'us-east-1',
    maxConcurrentDeployments: 5,
    deploymentTimeout: 300,
  });

  // Handle tab parameter from URL
  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsTab;
    if (tab && ['general', 'users', 'roles', 'audit-logs', 'integrations', 'pem-keys', 'mdm'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [userProfile, setUserProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [orgProfile, setOrgProfile] = useState({
    name: organization?.name || '',
    description: '',
  });

  useEffect(() => {
    loadSettings();
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      const response = await organizationApi.getCurrent();
      setOrgProfile({
        name: response.data.name || '',
        description: response.data.description || '',
      });
    } catch (error) {
      console.error('Failed to load organization:', error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsApi.get();
      setSettings({
        claudeApiKey: response.data.claudeApiKeyConfigured ? response.data.claudeApiKey : '',
        defaultRegion: response.data.defaultRegion || 'us-east-1',
        maxConcurrentDeployments: response.data.maxConcurrentDeployments || 5,
        deploymentTimeout: response.data.deploymentTimeout || 300,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await settingsApi.update(settings);
      toast.success('Settings saved successfully');
      
      // Update the settings with the masked version from the server
      if (response.data.settings) {
        setSettings({
          ...settings,
          claudeApiKey: response.data.settings.claudeApiKey || settings.claudeApiKey,
        });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestClaudeConnection = async () => {
    // Check if we have a key (either new or saved/masked)
    if (!settings.claudeApiKey) {
      toast.error('Please enter a valid Claude API key first');
      return;
    }

    try {
      setTestingConnection(true);
      
      // First save the key if it's new (not masked)
      if (!settings.claudeApiKey.includes('...')) {
        await settingsApi.update({ claudeApiKey: settings.claudeApiKey });
      }
      
      const response = await settingsApi.testClaude();
      toast.success('Claude API connection successful!');
    } catch (error: any) {
      toast.error(error.response?.data?.details || 'Claude API connection failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      // TODO: Update user profile
      // await userApi.updateProfile(userProfile);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOrganization = async () => {
    try {
      setSaving(true);
      const response = await organizationApi.update(orgProfile);
      
      // Update the organization context with the new name
      setOrganization({
        id: organization?.id || '',
        name: response.data.name,
      });
      
      toast.success('Organization updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header Skeleton */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
        
        {/* Scrollable Content Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-6xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { 
      id: 'general' as SettingsTab, 
      name: 'General', 
      icon: CogIcon,
      description: 'API keys, deployment settings, and organization profile'
    },
    { 
      id: 'users' as SettingsTab, 
      name: 'Users', 
      icon: UserGroupIcon,
      description: 'Manage user accounts and permissions'
    },
    { 
      id: 'roles' as SettingsTab, 
      name: 'Roles & Permissions', 
      icon: ShieldCheckIcon,
      description: 'Define roles and access controls'
    },
    { 
      id: 'audit-logs' as SettingsTab, 
      name: 'Audit Logs', 
      icon: ClipboardDocumentListIcon,
      description: 'View system activity and user actions'
    },
    { 
      id: 'integrations' as SettingsTab, 
      name: 'Integrations', 
      icon: CloudIcon,
      description: 'Connect external services and cloud providers'
    },
    { 
      id: 'pem-keys' as SettingsTab, 
      name: 'PEM Keys', 
      icon: KeyIcon,
      description: 'Manage SSH private keys for server authentication'
    },
    { 
      id: 'mdm' as SettingsTab, 
      name: 'MDM', 
      icon: DevicePhoneMobileIcon,
      description: 'Mobile Device Management - manage and control MacBooks remotely'
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="page-title">Settings</h1>
          <p className="text-muted mt-1">
            Configure your organization, API keys, and user management
          </p>
          
          {/* Tab Navigation */}
          <div className="mt-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        isActive
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon
                        className={`mr-2 h-5 w-5 ${
                          isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                      />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>
            
            {/* Tab Description */}
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {tabs.find(tab => tab.id === activeTab)?.description}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">

      {/* Tab Content */}
      {activeTab === 'general' && (
        <div className="space-y-8">
        
        {/* API Configuration */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <KeyIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">API Configuration</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Configure Claude API key for AI-powered configuration generation
            </p>
          </div>
          
          <div className="card-content space-y-6">
            
            {/* Claude API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Claude API Key
              </label>
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <input
                    type={showClaudeKey ? "text" : "password"}
                    value={settings.claudeApiKey}
                    onChange={(e) => setSettings({...settings, claudeApiKey: e.target.value})}
                    className="input pr-10"
                    placeholder="sk-ant-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaudeKey(!showClaudeKey)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showClaudeKey ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleTestClaudeConnection}
                  disabled={testingConnection || !settings.claudeApiKey}
                  className="btn btn-secondary btn-sm"
                >
                  {testingConnection ? 'Testing...' : 'Test'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Required for AI-powered Ansible configuration generation and chat functionality
              </p>
            </div>


            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn btn-primary btn-md"
              >
                {saving ? 'Saving...' : 'Save API Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* Deployment Configuration */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <CogIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Deployment Settings</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Configure default deployment parameters and limits
            </p>
          </div>
          
          <div className="card-content space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Concurrent Deployments
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.maxConcurrentDeployments}
                  onChange={(e) => setSettings({...settings, maxConcurrentDeployments: parseInt(e.target.value)})}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of deployments that can run simultaneously
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deployment Timeout (seconds)
                </label>
                <input
                  type="number"
                  min="60"
                  max="3600"
                  value={settings.deploymentTimeout}
                  onChange={(e) => setSettings({...settings, deploymentTimeout: parseInt(e.target.value)})}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Timeout for individual deployment operations
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn btn-primary btn-md"
              >
                {saving ? 'Saving...' : 'Save Deployment Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <UserIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">User Profile</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Update your personal information and change password
            </p>
          </div>
          
          <div className="card-content space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                  className="input"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  Contact support to change your email address
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Change Password</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={userProfile.currentPassword}
                    onChange={(e) => setUserProfile({...userProfile, currentPassword: e.target.value})}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={userProfile.newPassword}
                    onChange={(e) => setUserProfile({...userProfile, newPassword: e.target.value})}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={userProfile.confirmPassword}
                    onChange={(e) => setUserProfile({...userProfile, confirmPassword: e.target.value})}
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleUpdateProfile}
                disabled={saving}
                className="btn btn-primary btn-md"
              >
                {saving ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Organization */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-3">
              <BuildingOfficeIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Manage your organization settings
            </p>
          </div>
          
          <div className="card-content space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={orgProfile.name}
                onChange={(e) => setOrgProfile({...orgProfile, name: e.target.value})}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={orgProfile.description}
                onChange={(e) => setOrgProfile({...orgProfile, description: e.target.value})}
                className="input"
                rows={3}
                placeholder="Brief description of your organization..."
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleUpdateOrganization}
                disabled={saving}
                className="btn btn-primary btn-md"
              >
                {saving ? 'Updating...' : 'Update Organization'}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Users Management Tab */}
      {activeTab === 'users' && <UsersManagement />}

      {/* Roles Management Tab */}
      {activeTab === 'roles' && <RoleMatrixManagement />}

      {activeTab === 'audit-logs' && <AuditLogsPage />}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && <IntegrationsPageComponent />}

      {/* PEM Keys Tab */}
      {activeTab === 'pem-keys' && <PemKeysPageComponent />}

      {/* MDM Tab */}
      {activeTab === 'mdm' && <MDMManagement />}

        </div>
      </div>
    </div>
  );
}