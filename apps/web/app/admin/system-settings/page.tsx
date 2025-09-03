'use client';

import React, { useState, useEffect } from 'react';
import { 
  CogIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description?: string;
  category: string;
  isReadonly: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Check if user is super admin
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      if (!parsedUser.isSuperAdmin) {
        toast.error('Super admin access required');
        window.location.href = '/';
        return;
      }
    } else {
      window.location.href = '/login';
      return;
    }
  }, []);

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/system-settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      setUpdating(key);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/system-settings/${key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      const updatedSetting = await response.json();
      
      setSettings(prev => prev.map(setting => 
        setting.key === key ? updatedSetting : setting
      ));

      toast.success(`Setting '${key}' updated successfully`);
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error(`Failed to update setting '${key}'`);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggle = async (setting: SystemSetting) => {
    if (setting.isReadonly) {
      toast.error('This setting is read-only');
      return;
    }

    const currentValue = setting.value === true || setting.value === 'true';
    await updateSetting(setting.key, !currentValue);
  };

  const renderSettingValue = (setting: SystemSetting) => {
    if (setting.isReadonly) {
      return (
        <span className="text-gray-600 text-sm">
          {typeof setting.value === 'string' ? setting.value.replace(/"/g, '') : String(setting.value)}
          <span className="ml-2 text-xs text-gray-400">(Read-only)</span>
        </span>
      );
    }

    // Boolean toggles
    if (typeof setting.value === 'boolean' || setting.value === 'true' || setting.value === 'false') {
      const isEnabled = setting.value === true || setting.value === 'true';
      return (
        <button
          onClick={() => handleToggle(setting)}
          disabled={updating === setting.key}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isEnabled ? 'bg-green-600' : 'bg-gray-200'
          } ${updating === setting.key ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      );
    }

    // String values
    return (
      <span className="text-gray-900 text-sm">
        {typeof setting.value === 'string' ? setting.value.replace(/"/g, '') : String(setting.value)}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return ShieldCheckIcon;
      case 'system':
        return ExclamationTriangleIcon;
      default:
        return CogIcon;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security':
        return 'text-red-600 bg-red-100';
      case 'system':
        return 'text-yellow-600 bg-yellow-100';
      case 'limits':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading system settings...</p>
        </div>
      </div>
    );
  }

  const settingsByCategory = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure global platform settings and features.
          </p>
        </div>

        <div className="space-y-8">
          {Object.entries(settingsByCategory).map(([category, categorySettings]) => {
            const IconComponent = getCategoryIcon(category);
            return (
              <div key={category} className="bg-white shadow-sm rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${getCategoryColor(category)}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <h2 className="ml-3 text-lg font-medium text-gray-900 capitalize">
                      {category} Settings
                    </h2>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {categorySettings.map((setting) => (
                    <div key={setting.key} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900">
                              {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h3>
                            {setting.isReadonly && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                Read-only
                              </span>
                            )}
                          </div>
                          {setting.description && (
                            <p className="mt-1 text-sm text-gray-500">
                              {setting.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {renderSettingValue(setting)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {settings.length === 0 && (
          <div className="text-center py-12">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No settings found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No system settings are currently configured.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}