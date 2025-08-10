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
  CpuChipIcon
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

export default function ConversationalInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [currentConfig, setCurrentConfig] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedTargetSystem, setSelectedTargetSystem] = useState('ubuntu');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations]);

  useEffect(() => {
    loadConversations();
    loadServers();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await conversationsApi.getAll();
      // Initialize conversations with empty messages array
      const conversationsWithMessages = response.data.map((conv: any) => ({
        ...conv,
        messages: []
      }));
      setConversations(conversationsWithMessages);
      if (response.data.length > 0) {
        setActiveConversation(response.data[0].id);
        loadMessages(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
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

  const startNewConversation = async () => {
    try {
      const response = await conversationsApi.create();
      const newConversation = {
        ...response.data,
        messages: [],
      };

      setConversations([newConversation, ...conversations]);
      setActiveConversation(newConversation.id);
    } catch (error) {
      toast.error('Failed to create new conversation');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    let conversationId = activeConversation;
    if (!conversationId) {
      await startNewConversation();
      conversationId = conversations[0]?.id;
    }

    if (!conversationId) return;

    setIsLoading(true);
    const messageContent = inputMessage;
    setInputMessage('');

    try {
      const response = await conversationsApi.sendMessage(conversationId, {
        content: messageContent,
        targetSystem: selectedTargetSystem,
        requirements: [],
      });

      // Update conversation with both user and assistant messages
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, response.data.userMessage, response.data.assistantMessage],
              title: response.data.userMessage.content.length > 50 
                ? response.data.userMessage.content.substring(0, 50) + '...' 
                : response.data.userMessage.content
            }
          : conv
      ));

      if (response.data.configuration) {
        toast.success('Ansible configuration generated successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send message');
      
      // Add error message to conversation
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again or check your connection.',
        timestamp: new Date().toLocaleTimeString(),
      };

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, errorMessage] }
          : conv
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockAnsibleConfig = (request: string): string => {
    const lowerRequest = request.toLowerCase();
    
    if (lowerRequest.includes('nginx') || lowerRequest.includes('web server')) {
      return `---
- name: Install and configure NGINX
  hosts: all
  become: yes
  vars:
    nginx_port: 80
    document_root: /var/www/html

  tasks:
    - name: Install NGINX
      package:
        name: nginx
        state: present

    - name: Start and enable NGINX service
      service:
        name: nginx
        state: started
        enabled: yes

    - name: Configure NGINX default site
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/sites-available/default
      notify: restart nginx

    - name: Create document root
      file:
        path: "{{ document_root }}"
        state: directory
        owner: www-data
        group: www-data
        mode: '0755'

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted`;
    }

    if (lowerRequest.includes('docker') || lowerRequest.includes('container')) {
      return `---
- name: Install and configure Docker
  hosts: all
  become: yes
  vars:
    docker_users:
      - "{{ ansible_user }}"

  tasks:
    - name: Install required packages
      package:
        name:
          - apt-transport-https
          - ca-certificates
          - curl
          - software-properties-common
        state: present

    - name: Add Docker GPG key
      apt_key:
        url: https://download.docker.com/linux/ubuntu/gpg
        state: present

    - name: Add Docker repository
      apt_repository:
        repo: "deb [arch=amd64] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
        state: present

    - name: Install Docker
      package:
        name: docker-ce
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
        enabled: yes`;
    }

    return `---
- name: Custom configuration
  hosts: all
  become: yes
  
  tasks:
    - name: Execute custom configuration
      shell: echo "Configuring {{ ansible_hostname }} based on: ${request}"
      register: config_result
      
    - name: Display configuration result
      debug:
        var: config_result.stdout`;
  };

  const viewConfiguration = (config: string, configId?: string) => {
    setCurrentConfig(config);
    setCurrentConfigId(configId || null);
    setShowConfigEditor(true);
  };

  const deployConfiguration = (configId: string) => {
    setCurrentConfigId(configId);
    setShowDeployModal(true);
  };

  const handleDeploy = async (serverId: string) => {
    if (!currentConfigId) return;

    try {
      await deploymentsApi.create({
        name: `Deploy ${new Date().toLocaleString()}`,
        configurationId: currentConfigId,
        targetType: 'server',
        targetId: serverId,
      });

      toast.success('Deployment started successfully!');
      setShowDeployModal(false);
      setCurrentConfigId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start deployment');
    }
  };

  const activeConversationData = conversations.find(c => c.id === activeConversation);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Conversations */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={startNewConversation}
            className="btn btn-primary w-full"
          >
            New Configuration Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setActiveConversation(conversation.id)}
                className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                  activeConversation === conversation.id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <h3 className="font-medium text-sm text-gray-900 truncate">
                  {conversation.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {conversation.messages?.length || 0} messages
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversationData ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <h1 className="text-lg font-semibold text-gray-900">
                {activeConversationData.title}
              </h1>
              <p className="text-sm text-gray-500">
                AI-powered Ansible configuration assistant
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeConversationData.messages?.map((message) => (
                <div key={message.id} className="animate-in">
                  <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-3xl ${message.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                      <div
                        className={`message-bubble ${
                          message.role === 'user' ? 'message-user' : 'message-assistant'
                        }`}
                      >
                        <div className="mb-2">
                          <p className="text-sm">{message.content}</p>
                        </div>
                        
                        {message.generatedConfiguration && (
                          <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600">
                                Generated Ansible Configuration
                              </span>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => viewConfiguration(message.generatedConfiguration!, message.configurationId)}
                                  className="btn btn-ghost btn-sm"
                                  title="View full configuration"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deployConfiguration(message.configurationId!)}
                                  className="btn btn-primary btn-sm"
                                  title="Deploy configuration"
                                >
                                  <PlayIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                              <code>{message.generatedConfiguration.substring(0, 200)}...</code>
                            </pre>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 px-2">
                        {message.timestamp}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="message-bubble message-assistant">
                    <div className="flex items-center space-x-2">
                      <div className="loading-spinner w-4 h-4"></div>
                      <span>Generating Ansible configuration...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-3 mb-3">
                <label className="text-sm font-medium text-gray-700">Target OS:</label>
                <select
                  value={selectedTargetSystem}
                  onChange={(e) => setSelectedTargetSystem(e.target.value)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="ubuntu">Ubuntu</option>
                  <option value="centos">CentOS</option>
                  <option value="debian">Debian</option>
                  <option value="rhel">RHEL</option>
                  <option value="generic">Generic</option>
                </select>
              </div>
              
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Describe what you want to configure... (e.g., 'Install NGINX with SSL', 'Set up Docker environment')"
                  className="input flex-1"
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="btn btn-primary btn-md"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Ask for any server configuration, software installation, or system setup</span>
                <span>Press Enter to send</span>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Start a Configuration Chat
              </h2>
              <p className="text-gray-600 mb-6 max-w-md">
                Use our AI-powered assistant to generate Ansible configurations through natural conversation.
              </p>
              <button
                onClick={startNewConversation}
                className="btn btn-primary btn-lg"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Editor Modal */}
      {showConfigEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-5/6 h-5/6 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Ansible Configuration
              </h2>
              <button
                onClick={() => setShowConfigEditor(false)}
                className="btn btn-ghost btn-sm"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 p-6">
              <Editor
                height="100%"
                defaultLanguage="yaml"
                value={currentConfig}
                theme="vs-dark"
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                }}
              />
            </div>
            
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-600">Configuration validated</span>
              </div>
              <div className="flex space-x-3">
                <button className="btn btn-secondary btn-md">
                  Save as Template
                </button>
                <button className="btn btn-primary btn-md">
                  Deploy Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Deploy Configuration
              </h2>
              <button
                onClick={() => setShowDeployModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Select a server to deploy this configuration:
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {servers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => handleDeploy(server.id)}
                    className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <ServerIcon className="h-5 w-5 text-gray-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{server.name}</h3>
                        <p className="text-sm text-gray-500">{server.ipAddress}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        server.status === 'online' ? 'bg-green-400' : 
                        server.status === 'offline' ? 'bg-red-400' : 
                        'bg-gray-400'
                      }`}></div>
                    </div>
                  </div>
                ))}
                
                {servers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <ServerIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No servers available</p>
                    <p className="text-sm mt-1">Add servers first to deploy configurations</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}