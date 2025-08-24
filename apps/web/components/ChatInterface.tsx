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
          
          return { ...conv, messages: updatedMessages };
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
    <div className="h-full flex bg-white">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <button
              onClick={createNewConversation}
              className="inline-flex items-center p-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center">
              <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No conversations yet</p>
              <p className="text-xs text-gray-400">Click + to start a new conversation</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setActiveConversation(conversation.id);
                    loadMessages(conversation.id);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors group ${
                    activeConversation === conversation.id
                      ? 'bg-indigo-50 border-indigo-200 border'
                      : 'hover:bg-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium truncate ${
                        activeConversation === conversation.id 
                          ? 'text-indigo-900' 
                          : 'text-gray-900'
                      }`}>
                        {conversation.title}
                      </h3>
                      {conversation.messages?.length > 0 && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {conversation.messages[conversation.messages.length - 1]?.content}
                        </p>
                      )}
                    </div>
                    <div className="relative">
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
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-24">
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
                    <span className="text-xs text-gray-400">
                      {conversation.messages?.length || 0} messages
                    </span>
                    {conversation.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                </button>
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
            <div className="p-4 border-b border-gray-200 bg-white">
              <h3 className="text-lg font-medium text-gray-900">
                {getCurrentConversation()?.title || 'Configuration Chat'}
              </h3>
              <p className="text-sm text-gray-500">
                Ask me anything about infrastructure configuration, deployment, or management
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.length === 0 ? (
                <div className="text-center py-12">
                  <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Start a conversation</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                    Ask questions about server configuration, deployment strategies, or infrastructure management.
                  </p>
                </div>
              ) : (
                currentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
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
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-4 max-w-xs">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask about server configurations, deployments, or infrastructure..."
                    className="block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No conversation selected</h3>
              <p className="mt-2 text-sm text-gray-500">
                Select a conversation from the sidebar or create a new one to get started.
              </p>
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