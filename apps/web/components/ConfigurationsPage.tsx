'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  FolderIcon,
  PlayIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CloudArrowDownIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { configurationsApi } from '@/lib/api';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import ConfigurationApprovals from './ConfigurationApprovals';

interface Configuration {
  id: string;
  name: string;
  description?: string;
  type: 'playbook' | 'role' | 'task';
  content: string;
  variables?: any;
  tags?: string[];
  source: 'manual' | 'template' | 'conversation';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const ANSIBLE_TEMPLATES = {
  nginx: {
    name: 'NGINX Web Server',
    description: 'Install and configure NGINX web server',
    type: 'playbook' as const,
    content: `---
- name: Install and configure NGINX
  hosts: all
  become: yes
  vars:
    nginx_port: 80
    server_name: "{{ ansible_default_ipv4.address }}"
    
  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
      when: ansible_os_family == "Debian"
      
    - name: Install NGINX
      package:
        name: nginx
        state: present
        
    - name: Create NGINX configuration
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/sites-available/default
        backup: yes
      notify: reload nginx
      
    - name: Ensure NGINX is started and enabled
      service:
        name: nginx
        state: started
        enabled: yes
        
    - name: Open firewall for HTTP
      ufw:
        rule: allow
        port: "{{ nginx_port }}"
      when: ansible_os_family == "Debian"
      
  handlers:
    - name: reload nginx
      service:
        name: nginx
        state: reloaded`,
  },
  
  docker: {
    name: 'Docker Installation',
    description: 'Install Docker and Docker Compose',
    type: 'playbook' as const,
    content: `---
- name: Install Docker
  hosts: all
  become: yes
  vars:
    docker_users:
      - "{{ ansible_user }}"
      
  tasks:
    - name: Update apt cache
      apt:
        update_cache: yes
      when: ansible_os_family == "Debian"
      
    - name: Install required packages
      apt:
        name:
          - apt-transport-https
          - ca-certificates
          - curl
          - software-properties-common
        state: present
      when: ansible_os_family == "Debian"
      
    - name: Add Docker GPG key
      apt_key:
        url: https://download.docker.com/linux/ubuntu/gpg
        state: present
      when: ansible_os_family == "Debian"
      
    - name: Add Docker repository
      apt_repository:
        repo: "deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
        state: present
      when: ansible_os_family == "Debian"
      
    - name: Install Docker CE
      apt:
        name: docker-ce
        state: present
        update_cache: yes
      when: ansible_os_family == "Debian"
      
    - name: Install Docker Compose
      pip:
        name: docker-compose
        state: present
        
    - name: Add users to docker group
      user:
        name: "{{ item }}"
        groups: docker
        append: yes
      loop: "{{ docker_users }}"
      
    - name: Start and enable Docker service
      service:
        name: docker
        state: started
        enabled: yes`,
  },
  
  nodejs: {
    name: 'Node.js Application',
    description: 'Deploy Node.js application with PM2',
    type: 'playbook' as const,
    content: `---
- name: Deploy Node.js Application
  hosts: all
  become: yes
  vars:
    app_name: "my-app"
    app_port: 3000
    app_repo: "https://github.com/user/repo.git"
    app_branch: "main"
    node_version: "18"
    
  tasks:
    - name: Install Node.js
      shell: |
        curl -fsSL https://deb.nodesource.com/setup_{{ node_version }}.x | sudo -E bash -
        apt-get install -y nodejs
      when: ansible_os_family == "Debian"
      
    - name: Install PM2 globally
      npm:
        name: pm2
        global: yes
        
    - name: Create app directory
      file:
        path: "/opt/{{ app_name }}"
        state: directory
        owner: "{{ ansible_user }}"
        group: "{{ ansible_user }}"
        
    - name: Clone repository
      git:
        repo: "{{ app_repo }}"
        dest: "/opt/{{ app_name }}"
        version: "{{ app_branch }}"
        force: yes
      become_user: "{{ ansible_user }}"
      
    - name: Install dependencies
      npm:
        path: "/opt/{{ app_name }}"
      become_user: "{{ ansible_user }}"
      
    - name: Create PM2 ecosystem file
      template:
        src: ecosystem.config.js.j2
        dest: "/opt/{{ app_name }}/ecosystem.config.js"
        owner: "{{ ansible_user }}"
        
    - name: Start application with PM2
      shell: pm2 start ecosystem.config.js
      args:
        chdir: "/opt/{{ app_name }}"
      become_user: "{{ ansible_user }}"
      
    - name: Save PM2 configuration
      shell: pm2 save
      become_user: "{{ ansible_user }}"
      
    - name: Setup PM2 startup script
      shell: env PATH=$PATH:/usr/bin pm2 startup systemd -u {{ ansible_user }} --hp /home/{{ ansible_user }}`,
  },
  
  mysql: {
    name: 'MySQL Database',
    description: 'Install and configure MySQL database server',
    type: 'playbook' as const,
    content: `---
- name: Install and configure MySQL
  hosts: all
  become: yes
  vars:
    mysql_root_password: "secure_password_123"
    mysql_databases:
      - name: app_db
        encoding: utf8mb4
        collation: utf8mb4_unicode_ci
    mysql_users:
      - name: app_user
        password: "app_password_123"
        priv: "app_db.*:ALL"
        
  tasks:
    - name: Install MySQL server
      apt:
        name:
          - mysql-server
          - mysql-client
          - python3-pymysql
        state: present
        update_cache: yes
      when: ansible_os_family == "Debian"
      
    - name: Start and enable MySQL service
      service:
        name: mysql
        state: started
        enabled: yes
        
    - name: Set MySQL root password
      mysql_user:
        name: root
        password: "{{ mysql_root_password }}"
        login_unix_socket: /var/run/mysqld/mysqld.sock
        
    - name: Create MySQL databases
      mysql_db:
        name: "{{ item.name }}"
        encoding: "{{ item.encoding }}"
        collation: "{{ item.collation }}"
        state: present
        login_user: root
        login_password: "{{ mysql_root_password }}"
      loop: "{{ mysql_databases }}"
      
    - name: Create MySQL users
      mysql_user:
        name: "{{ item.name }}"
        password: "{{ item.password }}"
        priv: "{{ item.priv }}"
        state: present
        login_user: root
        login_password: "{{ mysql_root_password }}"
      loop: "{{ mysql_users }}"
      
    - name: Configure MySQL for remote connections
      lineinfile:
        path: /etc/mysql/mysql.conf.d/mysqld.cnf
        regexp: '^bind-address'
        line: 'bind-address = 0.0.0.0'
        backup: yes
      notify: restart mysql
      
  handlers:
    - name: restart mysql
      service:
        name: mysql
        state: restarted`,
  }
};

export default function ConfigurationsPage() {
  const { user } = useMinimalAuth();
  const [allConfigurations, setAllConfigurations] = useState<Configuration[]>([]);
  const [filteredConfigurations, setFilteredConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedConfigForReject, setSelectedConfigForReject] = useState<Configuration | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9); // 3x3 grid
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'playbook' | 'role' | 'task'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'template' | 'conversation'>('all');

  const [editorContent, setEditorContent] = useState('');
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    type: 'playbook' as 'playbook' | 'role' | 'task',
    tags: '',
  });

  useEffect(() => {
    loadConfigurations();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!showEditor && !showTemplates && !showApprovals) {
        loadConfigurations(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [showEditor, showTemplates, showApprovals]);

  // Filter and search effect
  useEffect(() => {
    let filtered = [...allConfigurations];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(config => 
        config.name.toLowerCase().includes(query) ||
        config.description?.toLowerCase().includes(query) ||
        config.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(config => config.approvalStatus === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(config => config.type === typeFilter);
    }

    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(config => config.source === sourceFilter);
    }

    setFilteredConfigurations(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allConfigurations, searchQuery, statusFilter, typeFilter, sourceFilter]);

  const loadConfigurations = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await configurationsApi.getAll();
      setAllConfigurations(response.data);
    } catch (error) {
      console.error('Failed to load configurations:', error);
      toast.error('Failed to load configurations');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleSaveConfiguration = async () => {
    try {
      const payload = {
        ...configForm,
        content: editorContent,
        tags: configForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        source: editingConfig?.source || 'manual', // Preserve source or default to manual
      };

      if (editingConfig) {
        // Update existing
        await configurationsApi.update(editingConfig.id, payload);
        toast.success('Configuration updated successfully');
      } else {
        // Create new
        await configurationsApi.create(payload);
        toast.success('Configuration created successfully');
      }

      await loadConfigurations();
      resetEditor();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save configuration');
    }
  };

  const handleEditConfiguration = (config: Configuration) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      description: config.description || '',
      type: config.type,
      tags: config.tags?.join(', ') || '',
    });
    setEditorContent(config.content);
    setShowEditor(true);
  };

  const handleDeleteConfiguration = async (id: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    try {
      await configurationsApi.delete(id);
      toast.success('Configuration deleted successfully');
      await loadConfigurations();
    } catch (error: any) {
      toast.error('Failed to delete configuration');
    }
  };

  const handleUseTemplate = async (template: typeof ANSIBLE_TEMPLATES.nginx) => {
    try {
      const payload = {
        name: template.name,
        description: template.description,
        type: template.type,
        content: template.content,
        tags: ['template', template.name.toLowerCase().replace(/\s+/g, '-')],
        source: 'template',
      };

      await configurationsApi.create(payload);
      toast.success('Template configuration created successfully');
      await loadConfigurations();
      setShowTemplates(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create template configuration');
    }
  };

  const resetEditor = () => {
    setShowEditor(false);
    setEditingConfig(null);
    setConfigForm({
      name: '',
      description: '',
      type: 'playbook',
      tags: '',
    });
    setEditorContent('');
  };

  // Inline approval functions
  const handleInlineApprove = async (configId: string) => {
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
      await loadConfigurations(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve configuration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleInlineReject = async () => {
    if (!selectedConfigForReject || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessingId(selectedConfigForReject.id);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/configurations/${selectedConfigForReject.id}/reject`, {
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
      setSelectedConfigForReject(null);
      await loadConfigurations(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject configuration');
    } finally {
      setProcessingId(null);
    }
  };

  const handleInlineResetApproval = async (configId: string) => {
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
      await loadConfigurations(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset approval status');
    } finally {
      setProcessingId(null);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredConfigurations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentConfigurations = filteredConfigurations.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
          <div className="flex items-center space-x-3">
            <h1 className="page-title">Configurations</h1>
            <button
              onClick={() => loadConfigurations(true)}
              disabled={refreshing}
              className="btn btn-ghost btn-sm"
              title="Refresh configurations"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-muted mt-1">
            Create and manage Ansible playbooks, roles, and tasks ({filteredConfigurations.length} of {allConfigurations.length})
          </p>
        </div>
        
        <div className="flex space-x-3">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowApprovals(true)}
              className="btn btn-secondary btn-md"
            >
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              Approvals
            </button>
          )}
          <button
            onClick={() => setShowTemplates(true)}
            className="btn btn-secondary btn-md"
          >
            <CloudArrowDownIcon className="h-5 w-5 mr-2" />
            Templates
          </button>
          <button
            onClick={() => setShowEditor(true)}
            className="btn btn-primary btn-md"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Configuration
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search configurations by name, description, or tags..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          
          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Types</option>
              <option value="playbook">Playbook</option>
              <option value="role">Role</option>
              <option value="task">Task</option>
            </select>
          </div>
          
          {/* Source Filter */}
          <div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="template">Template</option>
              <option value="conversation">Conversation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Configurations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentConfigurations.map((config) => (
          <div key={config.id} className="card hover:shadow-lg transition-shadow">
            <div className="card-content">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {config.type === 'playbook' && <DocumentTextIcon className="h-6 w-6 text-blue-600" />}
                    {config.type === 'role' && <FolderIcon className="h-6 w-6 text-blue-600" />}
                    {config.type === 'task' && <CodeBracketIcon className="h-6 w-6 text-blue-600" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                      {config.approvalStatus === 'approved' && (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" title="Approved" />
                      )}
                      {config.approvalStatus === 'rejected' && (
                        <XCircleIcon className="h-4 w-4 text-red-500" title="Rejected" />
                      )}
                      {config.approvalStatus === 'pending' && (
                        <ClockIcon className="h-4 w-4 text-yellow-500" title="Pending Approval" />
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {config.type}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                        config.approvalStatus === 'approved' 
                          ? 'bg-green-100 text-green-800'
                          : config.approvalStatus === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {config.approvalStatus}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                        config.source === 'manual'
                          ? 'bg-blue-100 text-blue-800'
                          : config.source === 'template'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {config.source}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEditConfiguration(config)}
                    className="btn btn-ghost btn-sm"
                    title="Edit Configuration"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  
                  {/* Admin approval actions */}
                  {user?.role === 'admin' && (
                    <>
                      {config.approvalStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleInlineApprove(config.id)}
                            disabled={processingId === config.id}
                            className="btn btn-ghost btn-sm text-green-600 hover:text-green-700"
                            title="Approve Configuration"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedConfigForReject(config);
                              setShowRejectModal(true);
                            }}
                            disabled={processingId === config.id}
                            className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                            title="Reject Configuration"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      
                      {(config.approvalStatus === 'approved' || config.approvalStatus === 'rejected') && (
                        <button
                          onClick={() => handleInlineResetApproval(config.id)}
                          disabled={processingId === config.id}
                          className="btn btn-ghost btn-sm text-yellow-600 hover:text-yellow-700"
                          title="Reset to Pending"
                        >
                          <ClockIcon className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDeleteConfiguration(config.id)}
                    className="btn btn-ghost btn-sm text-red-600 hover:text-red-700"
                    title="Delete Configuration"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {config.description && (
                <p className="text-sm text-gray-600 mb-4">{config.description}</p>
              )}

              {config.tags && config.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {config.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500">
                Created: {new Date(config.createdAt).toLocaleDateString()}
                {config.approvedAt && config.approvalStatus !== 'pending' && (
                  <span className="ml-2">
                    • {config.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}: {new Date(config.approvedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {config.rejectionReason && (
                <div className="text-xs text-red-600 mt-1">
                  <strong>Rejection reason:</strong> {config.rejectionReason}
                </div>
              )}
            </div>
          </div>
        ))}

        {currentConfigurations.length === 0 && filteredConfigurations.length === 0 && allConfigurations.length > 0 && (
          <div className="col-span-full text-center py-12">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No configurations match your filters</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search query or filters to find configurations.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
                setSourceFilter('all');
              }}
              className="btn btn-secondary btn-md"
            >
              Clear Filters
            </button>
          </div>
        )}

        {allConfigurations.length === 0 && (
          <div className="col-span-full text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No configurations yet</h3>
            <p className="text-gray-600 mb-6">Create your first Ansible configuration to get started.</p>
            <button
              onClick={() => setShowTemplates(true)}
              className="btn btn-secondary btn-md mr-3"
            >
              Browse Templates
            </button>
            <button
              onClick={() => setShowEditor(true)}
              className="btn btn-primary btn-md"
            >
              Create Configuration
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 mt-6">
          <div className="flex items-center text-sm text-gray-700">
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, filteredConfigurations.length)} of {filteredConfigurations.length} configurations
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 rounded text-sm ${
                        currentPage === page
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="text-gray-400 px-2">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="btn btn-ghost btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Ansible Templates</h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(ANSIBLE_TEMPLATES).map(([key, template]) => (
                  <div key={key} className="border border-gray-200 rounded-lg p-6 hover:border-primary-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        {template.type}
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 rounded-md p-3 mb-4">
                      <code className="text-xs text-gray-700">
                        {template.content.split('\n').slice(0, 3).join('\n')}...
                      </code>
                    </div>
                    
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="w-full btn btn-primary btn-sm"
                    >
                      Use This Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingConfig ? 'Edit Configuration' : 'New Configuration'}
              </h2>
              <button
                onClick={resetEditor}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="flex h-[80vh]">
              {/* Left Panel - Form */}
              <div className="w-1/3 p-6 border-r border-gray-200 overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Configuration Name
                    </label>
                    <input
                      type="text"
                      value={configForm.name}
                      onChange={(e) => setConfigForm({...configForm, name: e.target.value})}
                      className="input"
                      placeholder="e.g., NGINX Web Server"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={configForm.description}
                      onChange={(e) => setConfigForm({...configForm, description: e.target.value})}
                      className="input"
                      rows={3}
                      placeholder="Brief description of this configuration..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      value={configForm.type}
                      onChange={(e) => setConfigForm({...configForm, type: e.target.value as 'playbook' | 'role' | 'task'})}
                      className="input"
                    >
                      <option value="playbook">Playbook</option>
                      <option value="role">Role</option>
                      <option value="task">Task</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={configForm.tags}
                      onChange={(e) => setConfigForm({...configForm, tags: e.target.value})}
                      className="input"
                      placeholder="e.g., nginx, web-server, production"
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex space-x-3">
                      <button
                        onClick={handleSaveConfiguration}
                        className="btn btn-primary btn-md flex-1"
                      >
                        <ClipboardDocumentCheckIcon className="h-4 w-4 mr-2" />
                        {editingConfig ? 'Update' : 'Save'} Configuration
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel - Code Editor */}
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Ansible YAML Editor</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(editorContent);
                          toast.success('Copied to clipboard');
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 relative">
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    className="w-full h-full p-4 font-mono text-sm border-none resize-none focus:outline-none"
                    placeholder="---
- name: My Ansible Playbook
  hosts: all
  become: yes
  
  tasks:
    - name: Example task
      debug:
        msg: 'Hello, World!'"
                    style={{ minHeight: '500px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approvals Modal */}
      {showApprovals && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[95vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Configuration Approvals</h2>
              <button
                onClick={() => setShowApprovals(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <ConfigurationApprovals />
            </div>
          </div>
        </div>
      )}

      {/* Inline Rejection Modal */}
      {showRejectModal && selectedConfigForReject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Reject Configuration</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedConfigForReject(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Please provide a reason for rejecting "{selectedConfigForReject.name}"
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
                    setSelectedConfigForReject(null);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInlineReject}
                  disabled={!rejectReason.trim() || processingId === selectedConfigForReject.id}
                  className="btn btn-primary btn-sm bg-red-600 hover:bg-red-700"
                >
                  {processingId === selectedConfigForReject.id ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}