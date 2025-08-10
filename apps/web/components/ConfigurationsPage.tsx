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
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { configurationsApi } from '@/lib/api';

interface Configuration {
  id: string;
  name: string;
  description?: string;
  type: 'playbook' | 'role' | 'task';
  content: string;
  variables?: any;
  tags?: string[];
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
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);

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

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await configurationsApi.getAll();
      setConfigurations(response.data);
    } catch (error) {
      console.error('Failed to load configurations:', error);
      toast.error('Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfiguration = async () => {
    try {
      const payload = {
        ...configForm,
        content: editorContent,
        tags: configForm.tags.split(',').map(t => t.trim()).filter(Boolean),
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

  const handleUseTemplate = (template: typeof ANSIBLE_TEMPLATES.nginx) => {
    setConfigForm({
      name: template.name,
      description: template.description,
      type: template.type,
      tags: 'template, ' + template.name.toLowerCase().replace(/\s+/g, '-'),
    });
    setEditorContent(template.content);
    setShowTemplates(false);
    setShowEditor(true);
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
          <h1 className="page-title">Configurations</h1>
          <p className="text-muted mt-1">
            Create and manage Ansible playbooks, roles, and tasks
          </p>
        </div>
        
        <div className="flex space-x-3">
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

      {/* Configurations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {configurations.map((config) => (
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
                    <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {config.type}
                    </span>
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
              </div>
            </div>
          </div>
        ))}

        {configurations.length === 0 && (
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
    </div>
  );
}