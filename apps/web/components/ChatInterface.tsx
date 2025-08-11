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
  TrashIcon
} from '@heroicons/react/24/outline';
import Editor from '@monaco-editor/react';
import { conversationsApi, deploymentsApi, serversApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generatedConfiguration?: string;
  configurationId?: string;
  timestamp: string;
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
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    loadServers();
  }, []);

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
      const conversationsWithMessages = response.data.map(conv => ({
        ...conv,
        messages: []
      }));
      
      setConversations(conversationsWithMessages);
      
      // Set the first active conversation or create a new one
      const activeConv = conversationsWithMessages.find(conv => conv.isActive);
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
      const response = await serversApi.getAll();
      setServers(response.data);
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await conversationsApi.create({
        title: 'New Conversation'
      });
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

  const showConfiguration = (config: string, configId?: string) => {
    setCurrentConfig(config);
    setCurrentConfigId(configId || null);
    setShowConfigEditor(true);
  };

  const deployConfiguration = async () => {
    if (!selectedServer || !currentConfigId) {
      toast.error('Please select a server for deployment');
      return;
    }

    try {
      await deploymentsApi.create({
        configurationId: currentConfigId,
        targetType: 'server',
        targetId: selectedServer,
        name: `Deployment ${new Date().toLocaleString()}`
      });
      
      toast.success('Deployment started successfully');
      setShowDeployModal(false);
    } catch (error) {
      console.error('Failed to deploy:', error);
      toast.error('Failed to start deployment');
    }
  };

  const getCurrentConversation = () => {
    return conversations.find(conv => conv.id === activeConversation);
  };

  const currentMessages = getCurrentConversation()?.messages || [];

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
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-700">
                              Generated Configuration
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => showConfiguration(message.generatedConfiguration!, message.configurationId)}
                                className="text-xs text-indigo-600 hover:text-indigo-500 flex items-center"
                              >
                                <EyeIcon className="h-3 w-3 mr-1" />
                                View
                              </button>
                              {message.configurationId && (
                                <button
                                  onClick={() => setShowDeployModal(true)}
                                  className="text-xs text-green-600 hover:text-green-500 flex items-center"
                                >
                                  <PlayIcon className="h-3 w-3 mr-1" />
                                  Deploy
                                </button>
                              )}
                            </div>
                          </div>
                          <pre className="text-xs bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
                            {message.generatedConfiguration.substring(0, 200)}
                            {message.generatedConfiguration.length > 200 && '...'}
                          </pre>
                        </div>
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
              <h3 className="text-lg font-medium text-gray-900">Generated Configuration</h3>
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
                    setShowConfigEditor(false);
                    setShowDeployModal(true);
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Deploy Configuration
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
              <p className="text-sm text-gray-600 mt-1">Select a server to deploy this configuration to</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Server</label>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">Select a server...</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.ipAddress})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={deployConfiguration}
                disabled={!selectedServer}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                Deploy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}