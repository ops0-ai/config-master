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
  FunnelIcon,
  XMarkIcon,
  LinkIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { configurationsApi, githubApi } from '@/lib/api';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import ConfigurationApprovals from './ConfigurationApprovals';
import ConfigurationEditor from './ConfigurationEditor';
import GitHubSyncModal from './GitHubSyncModal';
import GitHubImportModal from './GitHubImportModal';

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
  metadata?: {
    sourcePath?: string;
    sourceRepo?: string;
    sourceBranch?: string;
    importedAt?: string;
    [key: string]: any;
  };
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
  },

  // Windows Templates
  windows_iis: {
    name: 'Windows IIS Web Server',
    description: 'Install and configure IIS web server on Windows',
    type: 'playbook' as const,
    content: `---
- name: Install and configure IIS on Windows
  hosts: windows
  gather_facts: no
  vars:
    iis_features:
      - IIS-WebServerRole
      - IIS-WebServer
      - IIS-CommonHttpFeatures
      - IIS-HttpErrors
      - IIS-HttpRedirect
      - IIS-ApplicationDevelopment
      - IIS-NetFxExtensibility45
      - IIS-HealthAndDiagnostics
      - IIS-HttpLogging
      - IIS-Security
      - IIS-RequestFiltering
      - IIS-Performance
      - IIS-WebServerManagementTools
      - IIS-ManagementConsole
      - IIS-ASPNET45

  tasks:
    - name: Enable IIS features
      win_feature:
        name: "{{ item }}"
        state: present
        restart: yes
      loop: "{{ iis_features }}"
      
    - name: Create website directory
      win_file:
        path: "C:\\inetpub\\wwwroot\\{{ site_name | default('myapp') }}"
        state: directory
      
    - name: Create sample HTML file
      win_copy:
        content: |
          <!DOCTYPE html>
          <html>
          <head>
              <title>{{ site_name | default('My Application') }}</title>
          </head>
          <body>
              <h1>Welcome to {{ site_name | default('My Application') }}</h1>
              <p>IIS is running successfully!</p>
          </body>
          </html>
        dest: "C:\\inetpub\\wwwroot\\{{ site_name | default('myapp') }}\\index.html"
      
    - name: Create IIS website
      win_iis_website:
        name: "{{ site_name | default('MyApp') }}"
        state: started
        port: "{{ site_port | default('80') }}"
        physical_path: "C:\\inetpub\\wwwroot\\{{ site_name | default('myapp') }}"
      
    - name: Ensure IIS service is running
      win_service:
        name: W3SVC
        state: started
        start_mode: auto`,
  },

  windows_dotnet: {
    name: 'Windows .NET Application',
    description: 'Deploy .NET application on Windows with IIS',
    type: 'playbook' as const,
    content: `---
- name: Deploy .NET application on Windows
  hosts: windows
  gather_facts: no
  vars:
    app_name: "{{ app_name | default('MyDotNetApp') }}"
    app_pool_name: "{{ app_pool_name | default('MyAppPool') }}"
    app_path: "C:\\inetpub\\wwwroot\\{{ app_name }}"
    dotnet_version: "{{ dotnet_version | default('6.0') }}"

  tasks:
    - name: Install .NET Runtime
      win_chocolatey:
        name: "dotnet-{{ dotnet_version }}-runtime"
        state: present
      
    - name: Install ASP.NET Core Runtime
      win_chocolatey:
        name: "dotnet-{{ dotnet_version }}-aspnetcore-runtime"
        state: present
      
    - name: Create application directory
      win_file:
        path: "{{ app_path }}"
        state: directory
      
    - name: Create IIS Application Pool
      win_iis_webapppool:
        name: "{{ app_pool_name }}"
        state: started
        attributes:
          processModel.identityType: ApplicationPoolIdentity
          managedRuntimeVersion: ""
      
    - name: Create IIS Website
      win_iis_website:
        name: "{{ app_name }}"
        state: started
        port: "{{ app_port | default('80') }}"
        physical_path: "{{ app_path }}"
        application_pool: "{{ app_pool_name }}"
      
    - name: Copy application files
      win_copy:
        src: "{{ source_path }}/"
        dest: "{{ app_path }}"
        remote_src: no
      when: source_path is defined
      
    - name: Set application permissions
      win_file:
        path: "{{ app_path }}"
        state: directory
        owner: "IIS_IUSRS"
        rights: full_control`,
  },

  windows_sql_server: {
    name: 'Windows SQL Server',
    description: 'Install and configure SQL Server on Windows',
    type: 'playbook' as const,
    content: `---
- name: Install and configure SQL Server
  hosts: windows
  gather_facts: no
  vars:
    sql_instance_name: "{{ sql_instance_name | default('MSSQLSERVER') }}"
    sql_sa_password: "{{ sql_sa_password | default('SecurePassword123!') }}"
    sql_port: "{{ sql_port | default('1433') }}"
    
  tasks:
    - name: Download SQL Server Developer Edition
      win_get_url:
        url: https://go.microsoft.com/fwlink/?linkid=866662
        dest: C:\\temp\\SQL2019-SSEI-Dev.exe
        
    - name: Install SQL Server
      win_command: >
        C:\\temp\\SQL2019-SSEI-Dev.exe /QUIET /ACTION=Install
        /FEATURES=SQLENGINE /INSTANCENAME={{ sql_instance_name }}
        /SQLSVCACCOUNT="NT AUTHORITY\\SYSTEM" 
        /SQLSYSADMINACCOUNTS="BUILTIN\\Administrators"
        /SAPWD="{{ sql_sa_password }}"
        /SECURITYMODE=SQL
        /TCPENABLED=1
      args:
        creates: "C:\\Program Files\\Microsoft SQL Server"
        
    - name: Enable SQL Server service
      win_service:
        name: "MSSQL\\$\\{\\{ sql_instance_name \\}\\}"
        state: started
        start_mode: auto
      when: sql_instance_name != "MSSQLSERVER"
      
    - name: Enable SQL Server service (default instance)
      win_service:
        name: MSSQLSERVER
        state: started
        start_mode: auto
      when: sql_instance_name == "MSSQLSERVER"
      
    - name: Configure SQL Server port
      win_regedit:
        path: "HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\MSSQL15.{{ sql_instance_name }}\\MSSQLServer\\SuperSocketNetLib\\Tcp\\IPAll"
        name: TcpPort
        data: "{{ sql_port }}"
        type: string
        
    - name: Enable SQL Browser service
      win_service:
        name: SQLBrowser
        state: started
        start_mode: auto
        
    - name: Configure Windows Firewall for SQL Server
      win_firewall_rule:
        name: SQL Server
        localport: "{{ sql_port }}"
        action: allow
        direction: in
        protocol: tcp
        state: present`,
  },

  windows_powershell_dsc: {
    name: 'Windows PowerShell DSC',
    description: 'Configure Windows using PowerShell Desired State Configuration',
    type: 'playbook' as const,
    content: `---
- name: Configure Windows with PowerShell DSC
  hosts: windows
  gather_facts: no
  vars:
    features_to_install:
      - Telnet-Client
      - RSAT-AD-Tools
    services_to_configure:
      - name: Spooler
        state: running
        startup: automatic
      
  tasks:
    - name: Ensure PowerShell DSC modules are present
      win_psmodule:
        name: "{{ item }}"
        state: present
      loop:
        - PSDscResources
        - ComputerManagementDsc
        
    - name: Create DSC configuration
      win_copy:
        content: |
          Configuration WindowsConfig {
              Import-DscResource -ModuleName PSDscResources
              Import-DscResource -ModuleName ComputerManagementDsc
              
              Node localhost {
                  {% for feature in features_to_install %}
                  WindowsFeature {{ feature | replace('-', '') }} {
                      Name = '{{ feature }}'
                      Ensure = 'Present'
                  }
                  {% endfor %}
                  
                  {% for service in services_to_configure %}
                  Service {{ service.name }} {
                      Name = '{{ service.name }}'
                      State = '{{ service.state | capitalize }}'
                      StartupType = '{{ service.startup | capitalize }}'
                  }
                  {% endfor %}
                  
                  Registry DisableIEESC {
                      Key = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Active Setup\\Installed Components\\{A509B1A7-37EF-4b3f-8CFC-4F3A74704073}'
                      ValueName = 'IsInstalled'
                      ValueData = '0'
                      ValueType = 'Dword'
                  }
              }
          }
        dest: C:\\temp\\WindowsConfig.ps1
        
    - name: Apply DSC Configuration
      win_shell: |
        . C:\\temp\\WindowsConfig.ps1
        WindowsConfig -OutputPath C:\\temp\\WindowsConfig
        Start-DscConfiguration -Path C:\\temp\\WindowsConfig -Wait -Verbose -Force
      register: dsc_result
      
    - name: Display DSC results
      debug:
        var: dsc_result.stdout_lines`,
  },

  windows_chocolatey: {
    name: 'Windows Chocolatey Package Manager',
    description: 'Install and manage software on Windows using Chocolatey',
    type: 'playbook' as const,
    content: `---
- name: Manage Windows software with Chocolatey
  hosts: windows
  gather_facts: no
  vars:
    chocolatey_packages:
      - name: googlechrome
        state: present
      - name: firefox
        state: present  
      - name: 7zip
        state: present
      - name: notepadplusplus
        state: present
      - name: git
        state: present
      - name: nodejs
        state: present
      - name: python3
        state: present
      - name: vscode
        state: present
        
  tasks:
    - name: Install Chocolatey
      win_chocolatey:
        name: chocolatey
        state: present
        
    - name: Update Chocolatey
      win_chocolatey:
        name: chocolatey
        state: latest
        
    - name: Install/Update packages with Chocolatey
      win_chocolatey:
        name: "{{ item.name }}"
        state: "{{ item.state | default('present') }}"
        version: "{{ item.version | default(omit) }}"
      loop: "{{ chocolatey_packages }}"
      
    - name: Install Windows Updates
      win_updates:
        category_names:
          - SecurityUpdates
          - CriticalUpdates
        reboot: yes
        reboot_timeout: 3600
      register: update_result
      
    - name: Display update results
      debug:
        msg: "{{ update_result.reboot_required | ternary('Reboot required', 'No reboot needed') }}"`
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedConfigForReject, setSelectedConfigForReject] = useState<Configuration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showGitHubSync, setShowGitHubSync] = useState(false);
  const [selectedConfigForSync, setSelectedConfigForSync] = useState<Configuration | null>(null);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9); // 3x3 grid
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'playbook' | 'role' | 'task'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'template' | 'conversation'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'linux' | 'windows'>('all');
  const [templatePlatformFilter, setTemplatePlatformFilter] = useState<'all' | 'linux' | 'windows'>('all');

  const [editorContent, setEditorContent] = useState('');
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    type: 'playbook' as 'playbook' | 'role' | 'task',
    tags: '',
  });

  // Modal states
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof ANSIBLE_TEMPLATES.nginx | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    type: 'playbook' as 'playbook' | 'role' | 'task',
    content: '',
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

    // Apply platform filter (based on content keywords)
    if (platformFilter !== 'all') {
      filtered = filtered.filter(config => {
        const content = config.content?.toLowerCase() || '';
        const name = config.name.toLowerCase();
        const description = config.description?.toLowerCase() || '';
        
        if (platformFilter === 'windows') {
          return content.includes('windows') || 
                 content.includes('win32') || 
                 content.includes('powershell') || 
                 content.includes('msi') || 
                 content.includes('registry') ||
                 content.includes('chocolatey') ||
                 content.includes('iis') ||
                 name.includes('windows') ||
                 description.includes('windows');
        } else if (platformFilter === 'linux') {
          return content.includes('apt') || 
                 content.includes('yum') || 
                 content.includes('systemctl') || 
                 content.includes('service') ||
                 content.includes('ubuntu') ||
                 content.includes('centos') ||
                 content.includes('rhel') ||
                 content.includes('debian') ||
                 name.includes('linux') ||
                 description.includes('linux') ||
                 // Default to Linux if no Windows-specific keywords found
                 (!content.includes('windows') && !content.includes('powershell') && !content.includes('msi'));
        }
        return true;
      });
    }

    setFilteredConfigurations(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allConfigurations, searchQuery, statusFilter, typeFilter, sourceFilter, platformFilter]);

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

  const handleUseTemplate = (template: typeof ANSIBLE_TEMPLATES.nginx) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description,
      type: template.type as 'playbook' | 'role' | 'task',
      content: template.content,
    });
    setShowTemplatePreview(true);
  };

  const handleConfirmTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      toast.error('Name and content are required');
      return;
    }
    
    try {
      const payload = {
        name: templateForm.name,
        description: templateForm.description,
        type: templateForm.type,
        content: templateForm.content,
        tags: ['template', templateForm.name.toLowerCase().replace(/\s+/g, '-')],
        source: 'template',
      };

      await configurationsApi.create(payload);
      toast.success('Configuration created successfully from template');
      await loadConfigurations();
      setShowTemplates(false);
      setShowTemplatePreview(false);
      setSelectedTemplate(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create configuration');
    }
  };

  const handleViewConfiguration = (config: Configuration) => {
    setSelectedConfig(config);
    setShowConfigDetails(true);
  };

  const handleApprove = async (configId: string) => {
    try {
      await configurationsApi.approve(configId);
      toast.success('Configuration approved successfully');
      await loadConfigurations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve configuration');
    }
  };

  const handleReject = async (configId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
      await configurationsApi.reject(configId, reason);
      toast.success('Configuration rejected');
      await loadConfigurations();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject configuration');
    }
  };

  const handleImportFromGitHub = async (files: Array<{ name: string; content: string; path: string; type: string; metadata?: any }>) => {
    try {
      setLoading(true);
      let successCount = 0;
      
      for (const file of files) {
        try {
          await configurationsApi.create({
            name: file.name,
            description: `Imported from GitHub: ${file.path}`,
            type: file.type,
            content: file.content,
            tags: ['imported', 'github'],
            metadata: {
              sourcePath: file.path,
              sourceRepo: file.metadata?.sourceRepo,
              sourceBranch: file.metadata?.sourceBranch,
              originalFileName: file.metadata?.originalFileName,
              importedAt: new Date().toISOString()
            }
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to import ${file.name}:`, error);
          toast.error(`Failed to import ${file.name}`);
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} configuration(s)`);
        await loadConfigurations();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import configurations');
    } finally {
      setLoading(false);
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
      <div className="flex flex-col h-full">
        {/* Fixed Header Skeleton */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
        
        {/* Scrollable Content Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showApprovals) {
    return <ConfigurationApprovals onClose={() => setShowApprovals(false)} />;
  }

  if (showEditor) {
    return (
      <ConfigurationEditor
        config={editingConfig}
        onClose={() => {
          setShowEditor(false);
          setEditingConfig(null);
        }}
        onSave={async (configData) => {
          try {
            if (editingConfig) {
              await configurationsApi.update(editingConfig.id, configData);
              toast.success('Configuration updated successfully');
              
              // Auto-sync to GitHub if configuration was previously synced
              try {
                const mappings = await githubApi.getConfigurationMappings(editingConfig.id);
                if (mappings.data.length > 0) {
                  // Configuration has GitHub mappings, sync automatically
                  const mapping = mappings.data[0]; // Use first mapping
                  await githubApi.syncConfiguration(mapping.githubIntegrationId, {
                    configurationId: editingConfig.id,
                    relativePath: mapping.relativePath,
                    branch: mapping.branch,
                    content: configData.content,
                    commitMessage: `Update ${configData.name} configuration`,
                  });
                  toast.success('Configuration automatically synced to GitHub');
                }
              } catch (syncError) {
                console.warn('Auto-sync to GitHub failed:', syncError);
                // Don't show error to user, auto-sync is optional
              }
            } else {
              await configurationsApi.create(configData);
              toast.success('Configuration created successfully');
            }
            await loadConfigurations();
            setShowEditor(false);
            setEditingConfig(null);
          } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save configuration');
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-6 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-6">
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
                onClick={() => setShowImportModal(true)}
                className="btn btn-secondary btn-md"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Import
              </button>
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

          {/* Search and Filter Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Search configurations by name, description, or tags..."
              />
              {searchQuery && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex items-center flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Filter:</span>
              </div>

              {/* Platform Filter */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setPlatformFilter('all')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    platformFilter === 'all'
                      ? 'bg-primary-100 text-primary-800 border border-primary-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setPlatformFilter('linux')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center ${
                    platformFilter === 'linux'
                      ? 'bg-primary-100 text-primary-800 border border-primary-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  🐧 Linux
                </button>
                <button
                  onClick={() => setPlatformFilter('windows')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center ${
                    platformFilter === 'windows'
                      ? 'bg-primary-100 text-primary-800 border border-primary-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  🪟 Windows
                </button>
              </div>

              {/* Other Filters */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="playbook">Playbook</option>
                <option value="role">Role</option>
                <option value="task">Task</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="manual">Manual</option>
                <option value="template">Template</option>
                <option value="conversation">Conversation</option>
              </select>
            </div>
          </div>

          {/* Results Summary */}
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || sourceFilter !== 'all' || platformFilter !== 'all') && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredConfigurations.length} of {allConfigurations.length} configurations
              {searchQuery && <span> matching "{searchQuery}"</span>}
              {platformFilter !== 'all' && <span> • {platformFilter} only</span>}
              {statusFilter !== 'all' && <span> • {statusFilter} status</span>}
              {typeFilter !== 'all' && <span> • {typeFilter} type</span>}
              {sourceFilter !== 'all' && <span> • {sourceFilter} source</span>}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setSourceFilter('all');
                  setPlatformFilter('all');
                }}
                className="ml-2 text-primary-600 hover:text-primary-800 underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Middle Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Configurations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentConfigurations.map((config) => (
              <div 
                key={config.id} 
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewConfiguration(config)}
              >
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

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {/* GitHub Sync Button - always visible for approved configs */}
                    {config.approvalStatus === 'approved' && (
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConfigForSync(config);
                            setShowGitHubSync(true);
                          }}
                          className="flex-1 btn btn-primary btn-sm"
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Sync to GitHub
                        </button>
                      </div>
                    )}
                    
                    {/* Approval Buttons - only for pending configs */}
                    {config.approvalStatus === 'pending' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(config.id);
                          }}
                          className="flex-1 btn btn-success btn-sm"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(config.id);
                          }}
                          className="flex-1 btn btn-danger btn-sm"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty States */}
          {currentConfigurations.length === 0 && filteredConfigurations.length === 0 && allConfigurations.length > 0 && (
            <div className="text-center py-12">
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
            <div className="text-center py-12">
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
      </div>

      {/* Fixed Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
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
              {/* Template Filter */}
              <div className="mb-6">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">Filter by platform:</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setTemplatePlatformFilter('all')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        templatePlatformFilter === 'all'
                          ? 'bg-primary-100 text-primary-800 border border-primary-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                    >
                      All Templates
                    </button>
                    <button
                      onClick={() => setTemplatePlatformFilter('linux')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center ${
                        templatePlatformFilter === 'linux'
                          ? 'bg-primary-100 text-primary-800 border border-primary-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                    >
                      🐧 Linux
                    </button>
                    <button
                      onClick={() => setTemplatePlatformFilter('windows')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center ${
                        templatePlatformFilter === 'windows'
                          ? 'bg-primary-100 text-primary-800 border border-primary-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                      }`}
                    >
                      🪟 Windows
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(ANSIBLE_TEMPLATES)
                  .filter(([key, template]) => {
                    if (templatePlatformFilter === 'all') return true;
                    
                    const templateName = template.name.toLowerCase();
                    const templateDescription = template.description.toLowerCase();
                    const templateContent = template.content.toLowerCase();
                    
                    if (templatePlatformFilter === 'windows') {
                      return key.startsWith('windows_') || 
                             templateName.includes('windows') ||
                             templateDescription.includes('windows') ||
                             templateContent.includes('windows') ||
                             templateContent.includes('win32') ||
                             templateContent.includes('powershell') ||
                             templateContent.includes('chocolatey') ||
                             templateContent.includes('iis');
                    } else if (templatePlatformFilter === 'linux') {
                      return !key.startsWith('windows_') &&
                             !templateName.includes('windows') &&
                             !templateDescription.includes('windows') &&
                             (!templateContent.includes('windows') || 
                              templateContent.includes('apt') ||
                              templateContent.includes('yum') ||
                              templateContent.includes('systemctl'));
                    }
                    return true;
                  })
                  .map(([key, template]) => (
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

      {/* Configuration Details Modal */}
      {showConfigDetails && selectedConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedConfig.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {selectedConfig.type}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    selectedConfig.approvalStatus === 'approved' 
                      ? 'bg-green-100 text-green-800'
                      : selectedConfig.approvalStatus === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedConfig.approvalStatus}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowConfigDetails(false);
                  setSelectedConfig(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedConfig.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
                  <p className="text-gray-600">{selectedConfig.description}</p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Configuration Content</h3>
                <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-800">
                    <code>{selectedConfig.content}</code>
                  </pre>
                </div>
              </div>

              {selectedConfig.tags && selectedConfig.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedConfig.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedConfig.rejectionReason && (
                <div className="mb-6 p-4 bg-red-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-red-700 mb-2">Rejection Reason</h3>
                  <p className="text-red-600">{selectedConfig.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500">
                  Created: {new Date(selectedConfig.createdAt).toLocaleString()}
                  {selectedConfig.approvedAt && (
                    <span className="ml-4">
                      {selectedConfig.approvalStatus === 'approved' ? 'Approved' : 'Rejected'}: {new Date(selectedConfig.approvedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  {selectedConfig.approvalStatus === 'approved' && (
                    <button
                      onClick={() => {
                        setSelectedConfigForSync(selectedConfig);
                        setShowConfigDetails(false);
                        setShowGitHubSync(true);
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <LinkIcon className="h-4 w-4 mr-1" />
                      Sync to GitHub
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingConfig(selectedConfig);
                      setShowConfigDetails(false);
                      setShowEditor(true);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                </div>
              </div>
              
              {selectedConfig.approvalStatus === 'pending' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleApprove(selectedConfig.id);
                      setShowConfigDetails(false);
                      setSelectedConfig(null);
                    }}
                    className="btn btn-success btn-sm"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      handleReject(selectedConfig.id);
                      setShowConfigDetails(false);
                      setSelectedConfig(null);
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {showTemplatePreview && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Customize Template</h2>
                <p className="text-gray-600 mt-1">Review and customize the template before adding it as a configuration</p>
              </div>
              <button
                onClick={() => {
                  setShowTemplatePreview(false);
                  setSelectedTemplate(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Configuration Details</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter configuration name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Describe what this configuration does"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['playbook', 'role', 'task'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setTemplateForm({ ...templateForm, type })}
                          className={`flex flex-col items-center p-3 border rounded-lg transition-colors ${
                            templateForm.type === type
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className={`mb-1 ${templateForm.type === type ? 'text-primary-600' : 'text-gray-500'}`}>
                            {type === 'playbook' && <DocumentTextIcon className="h-5 w-5" />}
                            {type === 'role' && <FolderIcon className="h-5 w-5" />}
                            {type === 'task' && <CodeBracketIcon className="h-5 w-5" />}
                          </div>
                          <span className="text-sm font-medium capitalize">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* YAML Content Editor */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">YAML Content</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Configuration Content *
                    </label>
                    <textarea
                      value={templateForm.content}
                      onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                      rows={20}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter your Ansible configuration here..."
                      style={{ minHeight: '400px' }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        Customize the YAML content before creating the configuration
                      </p>
                      <span className="text-xs text-gray-400">
                        {templateForm.content.split('\n').length} lines
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplatePreview(false);
                  setSelectedTemplate(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTemplate}
                className="btn btn-primary"
                disabled={!templateForm.name.trim() || !templateForm.content.trim()}
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Sync Modal */}
      {showGitHubSync && selectedConfigForSync && (
        <GitHubSyncModal
          configuration={selectedConfigForSync}
          onClose={() => {
            setShowGitHubSync(false);
            setSelectedConfigForSync(null);
          }}
          onSyncComplete={() => {
            loadConfigurations();
          }}
        />
      )}

      {/* GitHub Import Modal */}
      <GitHubImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportFromGitHub}
      />
    </div>
  );
}