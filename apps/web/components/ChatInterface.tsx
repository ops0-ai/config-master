'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  PaperAirplaneIcon,
  DocumentTextIcon,
  PlayIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  CpuChipIcon,
  PlusIcon,
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import Editor from '@monaco-editor/react';
import { conversationsApi, deploymentsApi, serversApi, serverGroupsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useOrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedConfiguration?: string;
  configurationId?: string;
  timestamp: string;
}

interface ConfigurationDetails {
  id: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  isActive: boolean;
}

interface Server {
  id: string;
  name: string;
  ipAddress: string;
  status: string;
}

interface ServerGroup {
  id: string;
  name: string;
  description?: string;
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [currentConfig, setCurrentConfig] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [targetType, setTargetType] = useState<'server' | 'serverGroup'>('server');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [configDetails, setConfigDetails] = useState<ConfigurationDetails | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [currentGeneratedConfig, setCurrentGeneratedConfig] = useState('');
  const [saveConfigName, setSaveConfigName] = useState('');
  const [refreshingConfigId, setRefreshingConfigId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isFeatureEnabled } = useOrganizationFeatures();

  useEffect(() => {
    loadConversations();
    // Only load servers if the servers feature is enabled
    if (isFeatureEnabled('servers') || isFeatureEnabled('serverGroups')) {
      loadServers();
    }
  }, [isFeatureEnabled]);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversation]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(null);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await conversationsApi.getAll();
      
      // Initialize conversations with empty messages arrays
      const conversationsWithMessages = response.data.map((conv: any) => ({
        ...conv,
        messages: []
      }));
      
      setConversations(conversationsWithMessages);
      
      // Set the first active conversation or create a new one
      const activeConv = conversationsWithMessages.find((conv: any) => conv.isActive);
      if (activeConv) {
        setActiveConversation(activeConv.id);
        // Load messages for the active conversation
        loadMessages(activeConv.id);
      } else if (conversationsWithMessages.length > 0) {
        setActiveConversation(conversationsWithMessages[0].id);
        loadMessages(conversationsWithMessages[0].id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await conversationsApi.getMessages(conversationId);
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, messages: response.data }
          : conv
      ));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadServers = async () => {
    try {
      const promises = [];
      
      // Only load servers if servers feature is enabled
      if (isFeatureEnabled('servers')) {
        promises.push(serversApi.getAll());
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }
      
      // Only load server groups if serverGroups feature is enabled
      if (isFeatureEnabled('serverGroups')) {
        promises.push(serverGroupsApi.getAll());
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }
      
      const [serversResponse, serverGroupsResponse] = await Promise.all(promises);
      setServers(serversResponse.data);
      setServerGroups(serverGroupsResponse.data);
    } catch (error) {
      console.error('Failed to load servers and server groups:', error);
      // Don't show error toast as this might be due to feature being disabled
      // toast.error('Failed to load servers and server groups');
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await conversationsApi.create();
      const newConversation = { ...response.data, messages: [] };
      setConversations([newConversation, ...conversations]);
      setActiveConversation(newConversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to create new conversation');
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await conversationsApi.delete(conversationId);
      
      // Remove from state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // If it was the active conversation, clear it
      if (activeConversation === conversationId) {
        setActiveConversation(null);
      }
      
      toast.success('Conversation deleted successfully');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const generateSmartTitle = (message: string): string => {
    const words = message.toLowerCase().trim().split(/\s+/);
    const firstWords = words.slice(0, 3).join(' ');
    
    // DevOps/Infrastructure related keywords for smart titles (shortened)
    if (message.toLowerCase().includes('deploy')) return 'Deployment';
    if (message.toLowerCase().includes('server') || message.toLowerCase().includes('infrastructure')) return 'Server Setup';
    if (message.toLowerCase().includes('docker') || message.toLowerCase().includes('container')) return 'Docker Config';
    if (message.toLowerCase().includes('kubernetes') || message.toLowerCase().includes('k8s')) return 'K8s Setup';
    if (message.toLowerCase().includes('ci/cd') || message.toLowerCase().includes('pipeline')) return 'CI/CD Pipeline';
    if (message.toLowerCase().includes('monitoring') || message.toLowerCase().includes('alert')) return 'Monitoring';
    if (message.toLowerCase().includes('security') || message.toLowerCase().includes('ssl')) return 'Security';
    if (message.toLowerCase().includes('database') || message.toLowerCase().includes('sql')) return 'Database';
    if (message.toLowerCase().includes('nginx') || message.toLowerCase().includes('apache')) return 'Web Server';
    if (message.toLowerCase().includes('backup') || message.toLowerCase().includes('restore')) return 'Backup';
    if (message.toLowerCase().includes('ansible') || message.toLowerCase().includes('terraform')) return 'IaC Setup';
    if (message.toLowerCase().includes('aws') || message.toLowerCase().includes('azure') || message.toLowerCase().includes('gcp')) return 'Cloud Config';
    
    // Fallback to first 3 words with proper capitalization, max 15 chars
    const title = firstWords.charAt(0).toUpperCase() + firstWords.slice(1);
    return title.length > 15 ? title.substring(0, 15) + '...' : title;
  };

  const renameConversation = async (conversationId: string, newTitle: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}/rename`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
      });
      
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, title: newTitle } : conv
      ));
      
      setEditingConversationId(null);
      setEditingTitle('');
      toast.success('Conversation renamed successfully');
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      toast.error('Failed to rename conversation');
    }
  };

  const startRenaming = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const cancelRenaming = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    // If no active conversation, create one
    if (!activeConversation) {
      await createNewConversation();
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const conversationId = activeConversation || conversations[0]?.id;
    if (!conversationId) {
      toast.error('Please create a conversation first');
      return;
    }

    const messageContent = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await conversationsApi.sendMessage(conversationId, {
        content: messageContent
      });
      
      // Update the conversation with the new messages
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          const updatedMessages = [...(conv.messages || [])];
          
          // Add user message
          if (response.data.userMessage) {
            updatedMessages.push(response.data.userMessage);
          }
          
          // Add assistant message
          if (response.data.assistantMessage) {
            updatedMessages.push(response.data.assistantMessage);
          }
          
          // Auto-generate smart title if this is the first message and title is generic
          let updatedTitle = conv.title;
          if (updatedMessages.length <= 2 && (conv.title === 'New Conversation' || conv.title?.startsWith('Conversation'))) {
            updatedTitle = generateSmartTitle(messageContent);
            // Update title on backend too
            fetch(`/api/conversations/${conversationId}/rename`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ title: updatedTitle })
            }).catch(console.error);
          }
          
          return { ...conv, messages: updatedMessages, title: updatedTitle };
        }
        return conv;
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showConfiguration = async (config: string, configId?: string) => {
    setCurrentConfig(config);
    setCurrentConfigId(configId || null);
    setConfigDetails(null);
    
    // Load configuration details if we have an ID
    if (configId) {
      try {
        const response = await fetch(`/api/configurations/${configId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setConfigDetails({
            id: data.id,
            approvalStatus: data.approvalStatus,
            approvedBy: data.approvedBy,
            approvedAt: data.approvedAt,
            rejectionReason: data.rejectionReason
          });
        }
      } catch (error) {
        console.error('Failed to load configuration details:', error);
      }
    }
    
    setShowConfigEditor(true);
  };

  const deployConfiguration = async () => {
    if (!selectedServer || !currentConfigId) {
      toast.error(`Please select a ${targetType === 'server' ? 'server' : 'server group'} for deployment`);
      return;
    }

    try {
      // First check if configuration is approved
      const configResponse = await fetch(`/api/configurations/${currentConfigId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!configResponse.ok) {
        throw new Error('Failed to fetch configuration details');
      }
      
      const configData = await configResponse.json();
      
      if (configData.approvalStatus !== 'approved') {
        toast.error(`Cannot deploy: Configuration must be approved first. Current status: ${configData.approvalStatus}`);
        setShowDeployModal(false);
        return;
      }

      // Get target name for deployment naming
      let targetName = '';
      if (targetType === 'server') {
        const server = servers.find(s => s.id === selectedServer);
        targetName = server?.name || 'Unknown Server';
      } else {
        const serverGroup = serverGroups.find(sg => sg.id === selectedServer);
        targetName = serverGroup?.name || 'Unknown Server Group';
      }

      // Create the deployment record
      const deploymentResponse = await deploymentsApi.create({
        configurationId: currentConfigId,
        targetType: targetType,
        targetId: selectedServer,
        name: `Chat Deploy - ${configData.name} (${targetName})`,
        description: `Deployment from chat conversation to ${targetType === 'server' ? 'server' : 'server group'}: ${targetName}`,
        scheduleType: 'immediate'
      });
      
      const deployment = deploymentResponse.data;
      
      // Immediately start the deployment
      await deploymentsApi.run(deployment.id);
      
      const deploymentUrl = `/deployments?id=${deployment.id}`;
      
      // Show success message with link to deployment
      const toastId = toast.success(
        <div>
          <p>Deployment started successfully!</p>
          <button 
            onClick={() => {
              window.open(deploymentUrl, '_blank');
              toast.dismiss(toastId);
            }}
            className="text-blue-600 hover:text-blue-700 underline text-sm mt-1"
          >
            View Deployment Console →
          </button>
        </div>,
        { 
          duration: 8000,
          style: {
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534'
          }
        }
      );
      
      setShowDeployModal(false);
    } catch (error) {
      console.error('Failed to deploy:', error);
      toast.error('Failed to start deployment');
    }
  };

  const getCurrentConversation = () => {
    return conversations.find(conv => conv.id === activeConversation);
  };

  const refreshConfigurationStatus = async (configId: string) => {
    try {
      const response = await fetch(`/api/configurations/${configId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const configData = await response.json();
        
        // Update the message with fresh configuration status
        setConversations(prev => prev.map(conv => {
          if (conv.id === activeConversation) {
            const updatedMessages = conv.messages.map(message => {
              if (message.configurationId === configId) {
                return {
                  ...message,
                  // Force a re-render to show updated status
                  timestamp: message.timestamp
                };
              }
              return message;
            });
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        }));
        
        // Clear refreshing state
        if (refreshingConfigId === configId) {
          setRefreshingConfigId(null);
        }
        
        // If still pending after initial save, continue polling for a few more times
        if (configData.approvalStatus === 'pending' && refreshingConfigId === configId) {
          setTimeout(() => {
            refreshConfigurationStatus(configId);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Failed to refresh configuration status:', error);
      if (refreshingConfigId === configId) {
        setRefreshingConfigId(null);
      }
    }
  };

  const getConfigurationStatus = async (configId: string): Promise<ConfigurationDetails | null> => {
    try {
      const response = await fetch(`/api/configurations/${configId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          id: data.id,
          approvalStatus: data.approvalStatus,
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt,
          rejectionReason: data.rejectionReason
        };
      }
    } catch (error) {
      console.error('Failed to get configuration status:', error);
    }
    return null;
  };

  const saveConfigurationToDatabase = async () => {
    if (!saveConfigName.trim() || !currentGeneratedConfig || !activeConversation) {
      toast.error('Please provide a configuration name');
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${activeConversation}/save-configuration`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configurationName: saveConfigName,
          generatedYaml: currentGeneratedConfig,
          description: `Configuration created from conversation`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save configuration');
      }

      const savedConfig = await response.json();
      
      // Update the message with the new configuration ID
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation) {
          const updatedMessages = conv.messages.map(message => {
            if (message.generatedConfiguration === currentGeneratedConfig) {
              return {
                ...message,
                configurationId: savedConfig.id
              };
            }
            return message;
          });
          return { ...conv, messages: updatedMessages };
        }
        return conv;
      }));

      // Also reload messages from server to ensure sync
      await loadMessages(activeConversation);
      
      // Set refreshing state to show status polling
      setRefreshingConfigId(savedConfig.id);
      
      // Poll for configuration status update
      setTimeout(() => {
        refreshConfigurationStatus(savedConfig.id);
      }, 500);

      toast.success('Configuration saved successfully! The status will update automatically.');
      setShowSaveModal(false);
      setSaveConfigName('');
      setCurrentGeneratedConfig('');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  const currentMessages = getCurrentConversation()?.messages || [];

  // Configuration Display Component
  const ConfigurationDisplay = ({ message, refreshingConfigId, onView, onSave, onDeploy }: {
    message: Message;
    refreshingConfigId: string | null;
    onView: (config: string, configId?: string) => void;
    onSave: () => void;
    onDeploy: (configId: string) => Promise<void>;
  }) => {
    const [configStatus, setConfigStatus] = useState<ConfigurationDetails | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (message.configurationId && !configStatus) {
        setLoading(true);
        getConfigurationStatus(message.configurationId)
          .then(setConfigStatus)
          .finally(() => setLoading(false));
      }
    }, [message.configurationId]);

    // Auto-refresh when this config is being refreshed
    useEffect(() => {
      if (message.configurationId && refreshingConfigId === message.configurationId) {
        const interval = setInterval(async () => {
          const status = await getConfigurationStatus(message.configurationId!);
          if (status) {
            setConfigStatus(status);
            if (status.approvalStatus !== 'pending') {
              // Stop auto-refresh once status is no longer pending
              clearInterval(interval);
            }
          }
        }, 1000);
        
        return () => clearInterval(interval);
      }
    }, [message.configurationId, refreshingConfigId]);

    const StatusIndicator = ({ status }: { status: string }) => {
      switch (status) {
        case 'approved':
          return (
            <span className="inline-flex items-center text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Approved
            </span>
          );
        case 'rejected':
          return (
            <span className="inline-flex items-center text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              <XCircleIcon className="h-3 w-3 mr-1" />
              Rejected
            </span>
          );
        case 'pending':
        default:
          return (
            <span className="inline-flex items-center text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              <ClockIcon className="h-3 w-3 mr-1" />
              {refreshingConfigId === message.configurationId ? 'Refreshing...' : 'Pending Approval'}
            </span>
          );
      }
    };

    return (
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-700">
              Generated Configuration
            </span>
            {message.configurationId && configStatus && (
              <StatusIndicator status={configStatus.approvalStatus} />
            )}
            {loading && (
              <span className="text-xs text-gray-500">Loading status...</span>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onView(message.generatedConfiguration!, message.configurationId)}
              className="text-xs text-indigo-600 hover:text-indigo-500 flex items-center"
            >
              <EyeIcon className="h-3 w-3 mr-1" />
              View
            </button>
            {message.configurationId ? (
              <button
                onClick={() => onDeploy(message.configurationId!)}
                disabled={
                  configStatus?.approvalStatus !== 'approved' || 
                  (!isFeatureEnabled('servers') && !isFeatureEnabled('serverGroups'))
                }
                className={`text-xs flex items-center ${
                  configStatus?.approvalStatus === 'approved' && (isFeatureEnabled('servers') || isFeatureEnabled('serverGroups'))
                    ? 'text-green-600 hover:text-green-500'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title={
                  configStatus?.approvalStatus !== 'approved' 
                    ? 'Configuration must be approved before deployment' 
                    : (!isFeatureEnabled('servers') && !isFeatureEnabled('serverGroups'))
                    ? 'Deployment features are not enabled for your organization'
                    : 'Deploy configuration'
                }
              >
                <PlayIcon className="h-3 w-3 mr-1" />
                Deploy
              </button>
            ) : (
              <button
                onClick={onSave}
                className="text-xs text-blue-600 hover:text-blue-500 flex items-center"
              >
                <PlusIcon className="h-3 w-3 mr-1" />
                Save to Configs
              </button>
            )}
          </div>
        </div>
        {configStatus?.rejectionReason && (
          <div className="text-xs text-red-600 mb-2 p-2 bg-red-50 rounded">
            <strong>Rejection reason:</strong> {configStatus.rejectionReason}
          </div>
        )}
        <pre className="text-xs bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
          {message.generatedConfiguration?.substring(0, 200)}
          {message.generatedConfiguration && message.generatedConfiguration.length > 200 && '...'}
        </pre>
      </div>
    );
  };

  return (
    <div className="h-screen max-h-screen flex bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Phoenix Sessions</h2>
              <p className="text-xs text-slate-300 mt-1">AI DevOps Conversations</p>
            </div>
            <button
              onClick={createNewConversation}
              className="inline-flex items-center p-2.5 border border-transparent rounded-xl shadow-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-8 mx-4">
                <ChatBubbleLeftIcon className="mx-auto h-16 w-16 text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold text-slate-800">Welcome to Phoenix</h3>
                <p className="mt-2 text-sm text-slate-600">Start your first AI DevOps conversation</p>
                <p className="text-xs text-slate-500 mt-1">Click + to begin</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`relative p-4 rounded-xl transition-all duration-200 group shadow-sm ${
                    activeConversation === conversation.id
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-md transform scale-[1.02]'
                      : 'hover:bg-white hover:shadow-md border-2 border-transparent hover:border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer pr-2"
                      onClick={() => {
                        setActiveConversation(conversation.id);
                        loadMessages(conversation.id);
                      }}
                    >
                      {editingConversationId === conversation.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => renameConversation(conversation.id, editingTitle)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameConversation(conversation.id, editingTitle);
                            } else if (e.key === 'Escape') {
                              cancelRenaming();
                            }
                          }}
                          className="w-full text-sm font-semibold bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3 className={`text-sm font-semibold truncate ${
                          activeConversation === conversation.id 
                            ? 'text-blue-900' 
                            : 'text-slate-800'
                        }`}>
                          {conversation.title}
                        </h3>
                      )}
                      {conversation.messages?.length > 0 && (
                        <p className={`text-xs truncate mt-1 ${
                          activeConversation === conversation.id 
                            ? 'text-blue-700' 
                            : 'text-slate-600'
                        }`}>
                          {conversation.messages[conversation.messages.length - 1]?.content}
                        </p>
                      )}
                    </div>
                    <div className="relative flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDropdown(showDropdown === conversation.id ? null : conversation.id);
                        }}
                        className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100"
                      >
                        <EllipsisVerticalIcon className="h-4 w-4 text-gray-400" />
                      </button>
                      {showDropdown === conversation.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-32">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRenaming(conversation);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center"
                          >
                            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conversation.id);
                              setShowDropdown(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${
                      activeConversation === conversation.id 
                        ? 'text-blue-600' 
                        : 'text-slate-500'
                    }`}>
                      {conversation.messages?.length || 0} messages
                    </span>
                    {conversation.isActive && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm">
                        Live
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src="/images/phoenix.svg"
                    alt="Phoenix AI DevOps Engineer"
                    className="w-12 h-12 rounded-full border-2 border-white shadow-xl"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {getCurrentConversation()?.title || 'Phoenix - AI DevOps Engineer'}
                  </h3>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm">
                      <div className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse"></div>
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-slate-50 to-white" style={{maxHeight: 'calc(100vh - 160px)'}}>
              {currentMessages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-slate-100 via-white to-slate-100 rounded-3xl p-12 mx-auto max-w-md shadow-xl border border-slate-200">
                    <div>
                      <ChatBubbleLeftIcon className="mx-auto h-16 w-16 text-slate-600" />
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-slate-900">Welcome to Phoenix</h3>
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                      Your enterprise AI DevOps engineer is ready to assist with infrastructure automation, deployment strategies, and system optimization.
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
                        <div className="font-semibold text-slate-800">Infrastructure</div>
                        <div className="text-slate-600 mt-1">Server configs & automation</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
                        <div className="font-semibold text-slate-800">Deployments</div>
                        <div className="text-slate-600 mt-1">CI/CD & orchestration</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                currentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl p-5 rounded-2xl shadow-lg border ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white border-blue-200 shadow-blue-200/50'
                          : 'bg-white text-slate-900 border-slate-200 shadow-slate-200/50'
                      }`}
                    >
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                        message.role === 'user' ? 'font-medium' : ''
                      }`}>{message.content}</p>
                      
                      {message.generatedConfiguration && (
                        <ConfigurationDisplay
                          message={message}
                          refreshingConfigId={refreshingConfigId}
                          onView={showConfiguration}
                          onSave={() => {
                            setCurrentGeneratedConfig(message.generatedConfiguration!);
                            setShowSaveModal(true);
                          }}
                          onDeploy={async (configId: string) => {
                            setCurrentConfigId(configId);
                            const status = await getConfigurationStatus(configId);
                            if (status && status.approvalStatus !== 'approved') {
                              toast.error(`Cannot deploy: Configuration must be approved first. Current status: ${status.approvalStatus}`);
                              return;
                            }
                            setShowDeployModal(true);
                          }}
                        />
                      )}
                      
                      <div className="mt-2 text-xs opacity-75">
                        {message.timestamp && new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-2xl p-6 max-w-md shadow-lg border border-slate-200">
                    <div className="flex items-center space-x-3">
                      <div>
                        <img
                          src="/images/phoenix.svg"
                          alt="Phoenix AI"
                          className="w-8 h-8 rounded-full"
                        />
                      </div>
                      <div>
                        <div className="flex space-x-1 mb-2">
                          <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">Phoenix is analyzing...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-gradient-to-r from-white via-slate-50 to-white">
              <div className="max-w-4xl mx-auto">
                <div className="flex space-x-4">
                  <div className="flex-1 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-xl"></div>
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Describe your infrastructure needs, deployment challenges, or system requirements..."
                      className="relative block w-full border-2 border-slate-200 rounded-xl shadow-sm px-4 py-3 text-sm placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm transition-all duration-200 hover:border-slate-300"
                      rows={3}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl shadow-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:transform-none"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Phoenix AI • Enterprise DevOps Assistant</span>
                  <span>Press Enter + Shift for new line</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <div className="text-center max-w-4xl mx-auto p-8">
              <div className="bg-gradient-to-br from-white via-slate-50 to-white rounded-3xl p-8 shadow-2xl border border-slate-200">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                  <ChatBubbleLeftIcon className="relative mx-auto h-20 w-20 text-slate-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Phoenix Enterprise AI</h3>
                <p className="text-slate-600 leading-relaxed mb-8">
                  Select an existing conversation or create a new session to begin working with your AI DevOps engineer.
                </p>
                {/* Animated Workflow */}
                <div className="overflow-visible py-8">
                  <div className="flex items-center justify-center space-x-4 sm:space-x-6 lg:space-x-8">
                    {/* Create Stage */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="relative mb-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                          <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div className="absolute -inset-1 sm:-inset-2 bg-blue-400 rounded-full opacity-20 animate-ping"></div>
                      </div>
                      <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-900 mb-1">Create</h4>
                      <p className="text-xs sm:text-sm text-slate-600 text-center whitespace-nowrap">Provision</p>
                    </div>

                    {/* Arrow 1 */}
                    <div className="flex items-center flex-shrink-0">
                      <div className="w-6 sm:w-8 lg:w-12 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 relative">
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-2 sm:border-l-3 lg:border-l-4 border-l-purple-400 border-t-1 sm:border-t-1.5 lg:border-t-2 border-t-transparent border-b-1 sm:border-b-1.5 lg:border-b-2 border-b-transparent animate-pulse"></div>
                      </div>
                    </div>

                    {/* Manage/Configure Stage */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="relative mb-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse" style={{animationDelay: '0.5s'}}>
                          <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="absolute -inset-1 sm:-inset-2 bg-purple-400 rounded-full opacity-20 animate-ping" style={{animationDelay: '0.5s'}}></div>
                      </div>
                      <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-900 mb-1">Manage</h4>
                      <p className="text-xs sm:text-sm text-slate-600 text-center whitespace-nowrap">Configure</p>
                    </div>

                    {/* Arrow 2 */}
                    <div className="flex items-center flex-shrink-0">
                      <div className="w-6 sm:w-8 lg:w-12 h-0.5 bg-gradient-to-r from-purple-400 to-green-400 relative">
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-2 sm:border-l-3 lg:border-l-4 border-l-green-400 border-t-1 sm:border-t-1.5 lg:border-t-2 border-t-transparent border-b-1 sm:border-b-1.5 lg:border-b-2 border-b-transparent animate-pulse" style={{animationDelay: '1s'}}></div>
                      </div>
                    </div>

                    {/* Operate Stage */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="relative mb-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-pulse" style={{animationDelay: '1s'}}>
                          <svg className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="absolute -inset-1 sm:-inset-2 bg-green-400 rounded-full opacity-20 animate-ping" style={{animationDelay: '1s'}}></div>
                      </div>
                      <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-slate-900 mb-1">Operate</h4>
                      <p className="text-xs sm:text-sm text-slate-600 text-center whitespace-nowrap">Monitor</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {showConfigEditor && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Generated Configuration</h3>
                {configDetails && (
                  <div className="flex items-center mt-2 space-x-2">
                    {configDetails.approvalStatus === 'approved' && (
                      <>
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-700">Approved</span>
                      </>
                    )}
                    {configDetails.approvalStatus === 'pending' && (
                      <>
                        <ClockIcon className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm text-yellow-700">Pending Approval</span>
                      </>
                    )}
                    {configDetails.approvalStatus === 'rejected' && (
                      <>
                        <XCircleIcon className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-700">Rejected</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowConfigEditor(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
            </div>
            <div className="mb-4">
              <Editor
                height="400px"
                language="yaml"
                value={currentConfig}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfigEditor(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Close
              </button>
              {currentConfigId && (
                <button
                  onClick={() => {
                    if (configDetails?.approvalStatus !== 'approved') {
                      toast.error(`Cannot deploy: Configuration must be approved first. Current status: ${configDetails?.approvalStatus || 'unknown'}`);
                      return;
                    }
                    setShowConfigEditor(false);
                    setShowDeployModal(true);
                  }}
                  disabled={configDetails?.approvalStatus !== 'approved'}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium ${
                    configDetails?.approvalStatus === 'approved'
                      ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                      : 'text-gray-500 bg-gray-200 cursor-not-allowed'
                  }`}
                  title={configDetails?.approvalStatus !== 'approved' ? 'Configuration must be approved before deployment' : 'Deploy Configuration'}
                >
                  {configDetails?.approvalStatus === 'approved' ? 'Deploy Configuration' : 'Approval Required'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Deploy Configuration</h3>
              {(!isFeatureEnabled('servers') && !isFeatureEnabled('serverGroups')) ? (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Deployment Features Not Available
                      </h3>
                      <p className="mt-1 text-sm text-yellow-700">
                        Server and Server Group features are not enabled for your organization. 
                        Please reach out to the support team to enable deployment features.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mt-1">Select a deployment target for this configuration</p>
              )}
            </div>
            
            {/* Only show deployment form if server features are available */}
            {(isFeatureEnabled('servers') || isFeatureEnabled('serverGroups')) && (
              <>
                {/* Target Type Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Type</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="server"
                    checked={targetType === 'server'}
                    onChange={(e) => {
                      setTargetType(e.target.value as 'server');
                      setSelectedServer('');
                    }}
                    className="mr-2 text-indigo-600 focus:ring-indigo-500"
                  />
                  <ServerIcon className="h-4 w-4 mr-1 text-blue-500" />
                  Single Server
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="serverGroup"
                    checked={targetType === 'serverGroup'}
                    onChange={(e) => {
                      setTargetType(e.target.value as 'serverGroup');
                      setSelectedServer('');
                    }}
                    className="mr-2 text-indigo-600 focus:ring-indigo-500"
                  />
                  <CpuChipIcon className="h-4 w-4 mr-1 text-purple-500" />
                  Server Group
                </label>
              </div>
            </div>
            
            {/* Target Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {targetType === 'server' ? 'Target Server' : 'Target Server Group'}
              </label>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">
                  Select {targetType === 'server' ? 'a server' : 'a server group'}...
                </option>
                {targetType === 'server' 
                  ? servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name} ({server.ipAddress}) {server.status === 'online' ? '🟢' : '🔴'}
                      </option>
                    ))
                  : serverGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} {group.description ? `- ${group.description}` : ''}
                      </option>
                    ))
                }
              </select>
              {targetType === 'server' && selectedServer && (
                <div className="mt-2">
                  {(() => {
                    const server = servers.find(s => s.id === selectedServer);
                    return server ? (
                      <div className="text-xs text-gray-600 flex items-center">
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          server.status === 'online' ? 'bg-green-400' : 'bg-red-400'
                        }`}></span>
                        Status: {server.status}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowDeployModal(false);
                      setTargetType('server');
                      setSelectedServer('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deployConfiguration}
                    disabled={!selectedServer}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Deploy to {targetType === 'server' ? 'Server' : 'Server Group'}
                  </button>
                </div>
              </>
            )}
            
            {/* Show only cancel button if deployment features are disabled */}
            {(!isFeatureEnabled('servers') && !isFeatureEnabled('serverGroups')) && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Configuration Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Save Configuration</h3>
              <p className="text-sm text-gray-600 mt-1">Give your configuration a name to save it for later use</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Configuration Name</label>
              <input
                type="text"
                value={saveConfigName}
                onChange={(e) => setSaveConfigName(e.target.value)}
                placeholder="e.g., nginx-setup, database-config"
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Full name will be: <code>{activeConversation}-{saveConfigName || 'your-name'}</code>
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveConfigName('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveConfigurationToDatabase}
                disabled={!saveConfigName.trim()}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}