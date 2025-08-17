import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    } else if (error.response?.status === 403 && error.response?.data?.code === 'ORGANIZATION_DISABLED') {
      // Organization has been disabled, logout and redirect with message
      localStorage.removeItem('authToken');
      localStorage.setItem('disabledOrgMessage', 'Your organization has been disabled. Please contact your global administrator for assistance.');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
  }) => api.post('/auth/register', data),
  
  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => api.post('/auth/change-password', data),
};

// Servers API
export const serversApi = {
  getAll: () => api.get('/servers'),
  
  getById: (id: string) => api.get(`/servers/${id}`),
  
  create: (data: {
    name: string;
    hostname: string;
    ipAddress: string;
    port?: number;
    username?: string;
    operatingSystem?: string;
    osVersion?: string;
    groupId?: string;
    pemKeyId?: string;
    metadata?: any;
  }) => api.post('/servers', data),
  
  update: (id: string, data: any) => api.put(`/servers/${id}`, data),
  
  delete: (id: string) => api.delete(`/servers/${id}`),
  
  testConnection: (id: string) => api.post(`/servers/${id}/test-connection`),
};

// PEM Keys API
export const pemKeysApi = {
  getAll: () => api.get('/pem-keys'),
  
  getById: (id: string) => api.get(`/pem-keys/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    privateKey: string;
  }) => api.post('/pem-keys', data),
  
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/pem-keys/${id}`, data),
  
  delete: (id: string) => api.delete(`/pem-keys/${id}`),
};

// Server Groups API
export const serverGroupsApi = {
  getAll: () => api.get('/server-groups'),
  
  create: (data: {
    name: string;
    description?: string;
    defaultPemKeyId?: string;
  }) => api.post('/server-groups', data),
  
  update: (id: string, data: {
    name?: string;
    description?: string;
    defaultPemKeyId?: string;
  }) => api.put(`/server-groups/${id}`, data),
  
  delete: (id: string) => api.delete(`/server-groups/${id}`),
};

// Configurations API
export const configurationsApi = {
  getAll: () => api.get('/configurations'),
  
  getById: (id: string) => api.get(`/configurations/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    type: string;
    content: string;
    variables?: any;
    tags?: string[];
  }) => api.post('/configurations', data),
  
  update: (id: string, data: {
    name?: string;
    description?: string;
    type?: string;
    content?: string;
    variables?: any;
    tags?: string[];
  }) => api.put(`/configurations/${id}`, data),
  
  delete: (id: string) => api.delete(`/configurations/${id}`),
  
  approve: (id: string) => api.post(`/configurations/${id}/approve`),
  
  reject: (id: string, reason: string) => api.post(`/configurations/${id}/reject`, { reason }),
};

// Conversations API
export const conversationsApi = {
  getAll: () => api.get('/conversations'),
  
  create: () => api.post('/conversations'),
  
  getMessages: (id: string) => api.get(`/conversations/${id}/messages`),
  
  sendMessage: (id: string, data: {
    content: string;
    targetSystem?: string;
    requirements?: string[];
  }) => api.post(`/conversations/${id}/messages`, data),
  
  delete: (id: string) => api.delete(`/conversations/${id}`),
};

// Deployments API
export const deploymentsApi = {
  getAll: () => api.get('/deployments'),
  
  getById: (id: string) => api.get(`/deployments/${id}`),
  
  create: (data: {
    name: string;
    description?: string;
    configurationId: string;
    targetType: 'server' | 'serverGroup';
    targetId: string;
    // Scheduling options
    scheduleType?: 'immediate' | 'scheduled' | 'recurring';
    scheduledFor?: string; // ISO date string
    cronExpression?: string;
    timezone?: string;
  }) => api.post('/deployments', data),
  
  run: (id: string) => api.post(`/deployments/${id}/run`),
  
  cancel: (id: string) => api.post(`/deployments/${id}/cancel`),
  
  pause: (id: string) => api.post(`/deployments/${id}/pause`),
  
  resume: (id: string) => api.post(`/deployments/${id}/resume`),
  
  delete: (id: string) => api.delete(`/deployments/${id}`),
  
  approve: (id: string) => api.post(`/deployments/${id}/approve`),
  
  reject: (id: string, data: { reason: string }) => api.post(`/deployments/${id}/reject`, data),
};

// Audit Logs API
export const auditApi = {
  getAll: () => api.get('/audit'),
};

// Settings API
export const settingsApi = {
  get: () => api.get('/settings'),
  
  update: (data: {
    claudeApiKey?: string;
    defaultRegion?: string;
    maxConcurrentDeployments?: number;
    deploymentTimeout?: number;
  }) => api.put('/settings', data),
  
  testClaude: () => api.post('/settings/test-claude'),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  
  getActivity: (limit?: number) => api.get('/dashboard/activity', { params: { limit } }),
  
  getHealth: () => api.get('/dashboard/health'),
};

// Organization API
export const organizationApi = {
  getCurrent: () => api.get('/organizations/current'),
  
  update: (data: { name: string; description?: string | null }) => 
    api.put('/organizations/current', data),
  
  getUserOrganizations: () => api.get('/organizations/user-organizations'),
  
  switchOrganization: (organizationId: string) => 
    api.post('/organizations/switch', { organizationId }),
  
  // Super Admin endpoints
  getAllOrganizations: () => api.get('/organizations/admin/all'),
  
  getOrganizationStats: () => api.get('/organizations/admin/stats'),
  
  createOrganization: (data: {
    name: string;
    description: string;
    adminEmail: string;
    adminName: string;
    adminPassword: string;
  }) => api.post('/organizations/admin/create', data),
  
  updateOrganization: (orgId: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) => api.patch(`/organizations/admin/${orgId}`, data),
  
  deleteOrganization: (orgId: string) => api.delete(`/organizations/admin/${orgId}`),
};

// MDM API
export const mdmApi = {
  // Profiles
  getProfiles: () => api.get('/mdm/profiles'),
  
  createProfile: (data: {
    name: string;
    description?: string;
    profileType?: 'macos' | 'windows' | 'ios' | 'android';
    allowRemoteCommands?: boolean;
    allowLockDevice?: boolean;
    allowShutdown?: boolean;
    allowRestart?: boolean;
    allowWakeOnLan?: boolean;
    requireAuthentication?: boolean;
    maxSessionDuration?: number;
    allowedIpRanges?: string[];
    enrollmentExpiresAt?: string;
  }) => api.post('/mdm/profiles', data),
  
  updateProfile: (id: string, data: any) => api.put(`/mdm/profiles/${id}`, data),
  
  deleteProfile: (id: string) => api.delete(`/mdm/profiles/${id}`),
  
  // Devices
  getDevices: () => api.get('/mdm/devices'),
  
  deleteDevice: (deviceId: string) => api.delete(`/mdm/devices/${deviceId}`),
  
  enrollDevice: (data: {
    enrollmentKey: string;
    deviceName: string;
    deviceId: string;
    serialNumber?: string;
    model?: string;
    osVersion?: string;
    architecture?: string;
    macAddress?: string;
    hostname?: string;
    agentVersion?: string;
    agentInstallPath?: string;
    metadata?: any;
  }) => api.post('/mdm/enroll', data),
  
  sendHeartbeat: (deviceId: string, data: {
    batteryLevel?: number;
    isCharging?: boolean;
    ipAddress?: string;
    status?: string;
  }) => api.post(`/mdm/devices/${deviceId}/heartbeat`, data),
  
  // Commands
  sendCommand: (deviceId: string, data: {
    commandType: 'lock' | 'unlock' | 'shutdown' | 'restart' | 'wake' | 'custom';
    command?: string;
    parameters?: any;
    timeout?: number;
  }) => api.post(`/mdm/devices/${deviceId}/commands`, data),
  
  getPendingCommands: (deviceId: string) => api.get(`/mdm/devices/${deviceId}/commands/pending`),
  
  updateCommandStatus: (commandId: string, data: {
    status: 'executing' | 'completed' | 'failed' | 'timeout';
    output?: string;
    errorMessage?: string;
    exitCode?: number;
  }) => api.put(`/mdm/commands/${commandId}/status`, data),
  
  getDeviceCommands: (deviceId: string) => api.get(`/mdm/devices/${deviceId}/commands`),
  
  // Download endpoints
  generateDownloadToken: (profileId: string, type: 'profile' | 'installer' | 'instructions' = 'profile') => 
    api.post(`/mdm/profiles/${profileId}/download-token`, { type }),
  
  // Get enrollment key
  getEnrollmentKey: () => api.get('/mdm/enrollment-key'),
  
  // Download installer
  downloadInstaller: () => api.get('/mdm/download/agent-installer', { responseType: 'text' }),
};