'use client';

import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  FolderIcon,
  CodeBracketIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Configuration {
  id: string;
  name: string;
  description?: string;
  type: 'playbook' | 'role' | 'task';
  content: string;
  tags?: string[];
  source?: string;
}

interface ConfigurationEditorProps {
  config?: Configuration | null;
  onClose: () => void;
  onSave: (configData: {
    name: string;
    description?: string;
    type: string;
    content: string;
    tags?: string[];
    source?: string;
  }) => Promise<void>;
}

export default function ConfigurationEditor({ config, onClose, onSave }: ConfigurationEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'playbook' as 'playbook' | 'role' | 'task',
    content: '',
    tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name || '',
        description: config.description || '',
        type: config.type || 'playbook',
        content: config.content || '',
        tags: config.tags?.join(', ') || '',
      });
    } else {
      // Default template for new configurations
      setFormData({
        name: '',
        description: '',
        type: 'playbook',
        content: `---
- name: Sample Configuration
  hosts: all
  become: yes
  tasks:
    - name: Update package cache
      apt:
        update_cache: yes
      when: ansible_os_family == "Debian"
    
    - name: Install package
      package:
        name: "{{ package_name | default('vim') }}"
        state: present`,
        tags: '',
      });
    }
  }, [config]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Configuration content is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      
      const configData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: formData.type,
        content: formData.content.trim(),
        tags: formData.tags
          ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          : undefined,
        source: config?.source || 'manual',
      };

      await onSave(configData);
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'playbook':
        return <DocumentTextIcon className="h-5 w-5" />;
      case 'role':
        return <FolderIcon className="h-5 w-5" />;
      case 'task':
        return <CodeBracketIcon className="h-5 w-5" />;
      default:
        return <DocumentTextIcon className="h-5 w-5" />;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'playbook':
        return 'A complete Ansible playbook with plays, tasks, and variables';
      case 'role':
        return 'A reusable Ansible role with organized tasks, handlers, and files';
      case 'task':
        return 'Individual Ansible tasks that can be included in playbooks';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {config ? 'Edit Configuration' : 'New Configuration'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {config ? 'Update your Ansible configuration' : 'Create a new Ansible configuration'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter configuration name"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['playbook', 'role', 'task'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, type })}
                      className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                        formData.type === type
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className={`mb-1 ${formData.type === type ? 'text-primary-600' : 'text-gray-500'}`}>
                        {getTypeIcon(type)}
                      </div>
                      <span className="text-sm font-medium capitalize">{type}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {getTypeDescription(formData.type)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe what this configuration does"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter tags separated by commas (e.g., web, nginx, production)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tags help organize and filter configurations
              </p>
            </div>
          </div>

          {/* Configuration Content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Configuration Content</h3>
              <div className="flex items-center text-sm text-gray-500">
                <span>YAML/Ansible Format</span>
              </div>
            </div>
            
            <div>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={20}
                className={`w-full px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.content ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your Ansible configuration here..."
                style={{ minHeight: '400px' }}
              />
              {errors.content && (
                <p className="text-red-600 text-sm mt-1">{errors.content}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  Write your Ansible YAML configuration. Use proper indentation and syntax.
                </p>
                <span className="text-xs text-gray-400">
                  {formData.content.split('\n').length} lines
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4 mr-2" />
                {config ? 'Update Configuration' : 'Create Configuration'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}