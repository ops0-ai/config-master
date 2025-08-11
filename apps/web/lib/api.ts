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