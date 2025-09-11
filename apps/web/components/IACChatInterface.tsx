'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatBubbleLeftRightIcon, 
  PlusIcon, 
  CodeBracketIcon,
  CloudIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface IACConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface IACMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  generatedTerraform?: string;
  prNumber?: number;
  prUrl?: string;
  prStatus?: 'open' | 'merged' | 'closed' | 'draft';
  deploymentStatus?: 'pending' | 'init' | 'validate' | 'plan' | 'deploy' | 'validated' | 'planned' | 'deployed' | 'failed';
  terraformPlan?: string;
  awsRegion?: string;
  createdAt: string;
}

interface GitHubIntegration {
  id: string;
  name: string;
  repositoryFullName: string;
  basePath: string;
}

export default function IACChatInterface() {
  const [conversations, setConversations] = useState<IACConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<IACMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [githubIntegrations, setGithubIntegrations] = useState<GitHubIntegration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadGitHubIntegrations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/iac/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        if (data.length > 0 && !selectedConversation) {
          setSelectedConversation(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/iac/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadGitHubIntegrations = async () => {
    try {
      const response = await fetch('/api/github/integrations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGithubIntegrations(data);
        if (data.length > 0) {
          setSelectedIntegration(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading GitHub integrations:', error);
    }
  };

  const createNewConversation = async () => {
    setShowNewConversationModal(true);
  };

  const handleCreateConversation = async () => {
    if (!newConversationTitle.trim()) {
      toast.error('Please enter a conversation title');
      return;
    }

    try {
      const response = await fetch('/api/iac/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          title: newConversationTitle.trim(),
        }),
      });
      if (response.ok) {
        const newConversation = await response.json();
        setConversations(prev => [newConversation, ...prev]);
        setSelectedConversation(newConversation.id);
        setMessages([]);
        setShowNewConversationModal(false);
        setNewConversationTitle('');
        toast.success('New conversation created!');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create new conversation');
    }
  };

  const cancelNewConversation = () => {
    setShowNewConversationModal(false);
    setNewConversationTitle('');
  };

  const startEditingTitle = (conversationId: string, currentTitle: string) => {
    setEditingConversationId(conversationId);
    setEditingTitle(currentTitle);
  };

  const saveTitleEdit = async () => {
    if (!editingConversationId || !editingTitle.trim()) {
      toast.error('Please enter a valid title');
      return;
    }

    try {
      const response = await fetch(`/api/iac/conversations/${editingConversationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          title: editingTitle.trim(),
        }),
      });

      if (response.ok) {
        setConversations(prev => prev.map(conv => 
          conv.id === editingConversationId 
            ? { ...conv, title: editingTitle.trim() }
            : conv
        ));
        setEditingConversationId(null);
        setEditingTitle('');
        toast.success('Title updated successfully!');
      } else {
        throw new Error('Failed to update title');
      }
    } catch (error) {
      console.error('Error updating title:', error);
      toast.error('Failed to update title');
    }
  };

  const cancelTitleEdit = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: IACMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/iac/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          message: currentInput,
          conversationId: selectedConversation,
          awsRegion,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();
      
      // Update conversation ID if new
      if (data.conversationId && data.conversationId !== selectedConversation) {
        setSelectedConversation(data.conversationId);
        loadConversations();
      }

      // Add AI response
      const aiMessage: IACMessage = {
        id: data.assistantMessage.id,
        role: 'assistant',
        content: data.assistantMessage.content,
        generatedTerraform: data.generatedTerraform,
        deploymentStatus: 'pending',
        awsRegion,
        createdAt: data.assistantMessage.createdAt,
      };

      setMessages(prev => [...prev, aiMessage]);
      loadConversations(); // Refresh conversations to update titles

    } catch (error) {
      console.error('IAC chat error:', error);
      toast.error('Failed to get AI response');
      
      const errorMessage: IACMessage = {
        id: Date.now().toString(),
        role: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const createPR = async (messageId: string) => {
    if (!selectedIntegration) {
      toast.error('Please select a GitHub integration first');
      return;
    }

    try {
      const response = await fetch('/api/iac/create-pr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          messageId,
          integrationId: selectedIntegration,
        }),
      });

      if (!response.ok) throw new Error('Failed to create PR');

      const data = await response.json();
      toast.success('Pull request created successfully!');
      
      // Update the message with PR info
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, prNumber: data.prNumber, prUrl: data.prUrl, prStatus: 'open' }
          : msg
      ));

    } catch (error) {
      console.error('Error creating PR:', error);
      toast.error('Failed to create pull request');
    }
  };

  const deployTerraform = async (messageId: string, action: 'init' | 'validate' | 'plan' | 'deploy') => {
    try {
      const response = await fetch('/api/iac/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          messageId,
          action,
          awsRegion,
        }),
      });

      if (!response.ok) throw new Error('Failed to deploy Terraform');

      const data = await response.json();
      toast.success(`Terraform ${action} completed successfully!`);
      
      // Map action to deployment status
      const statusMap: Record<string, string> = {
        'init': 'init',
        'validate': 'validated',
        'plan': 'planned',
        'deploy': 'deployed'
      };

      // Update the message with deployment status
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, deploymentStatus: statusMap[action] as any, terraformPlan: data.result }
          : msg
      ));

    } catch (error) {
      console.error('Error deploying Terraform:', error);
      toast.error(`Failed to ${action} Terraform`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'merged':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'closed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      case 'init':
        return <ArrowPathIcon className="h-4 w-4 text-blue-500" />;
      case 'validated':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'planned':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'deployed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'merged':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      case 'init':
        return 'bg-blue-100 text-blue-800';
      case 'validated':
        return 'bg-green-100 text-green-800';
      case 'planned':
        return 'bg-yellow-100 text-yellow-800';
      case 'deployed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar - Conversations */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">IAC Conversations</h2>
            <button
              onClick={createNewConversation}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* GitHub Integration Selector */}
          {githubIntegrations.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Integration
              </label>
              <select
                value={selectedIntegration}
                onChange={(e) => setSelectedIntegration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {githubIntegrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* AWS Region Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AWS Region
            </label>
            <select
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">Europe (Ireland)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation.id)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              {editingConversationId === conversation.id ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        saveTitleEdit();
                      } else if (e.key === 'Escape') {
                        cancelTitleEdit();
                      }
                    }}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={saveTitleEdit}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelTitleEdit}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 truncate flex-1">
                      {conversation.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingTitle(conversation.id, conversation.title);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">
                    {new Date(conversation.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : message.role === 'system'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    
                    {/* Generated Terraform Code */}
                    {message.generatedTerraform && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Generated Terraform Code</h4>
                          <button
                            onClick={() => copyToClipboard(message.generatedTerraform!)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <DocumentDuplicateIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto text-sm">
                          <code>{message.generatedTerraform}</code>
                        </pre>
                        
                        {/* Action Buttons */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => createPR(message.id)}
                            disabled={!selectedIntegration || !!message.prNumber}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            <ShareIcon className="h-4 w-4 inline mr-1" />
                            Create PR
                          </button>
                          
                          {message.prNumber && (
                            <a
                              href={message.prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                            >
                              View PR #{message.prNumber}
                            </a>
                          )}

                          <div className="flex gap-1">
                            <button
                              onClick={() => deployTerraform(message.id, 'init')}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              Init
                            </button>
                            <button
                              onClick={() => deployTerraform(message.id, 'validate')}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Validate
                            </button>
                            <button
                              onClick={() => deployTerraform(message.id, 'plan')}
                              className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                            >
                              Plan
                            </button>
                            <button
                              onClick={() => deployTerraform(message.id, 'deploy')}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            >
                              Deploy
                            </button>
                          </div>
                        </div>

                        {/* Status Indicators */}
                        <div className="mt-2 flex gap-2">
                          {message.prStatus && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.prStatus)}`}>
                              {getStatusIcon(message.prStatus)}
                              <span className="ml-1">PR: {message.prStatus}</span>
                            </span>
                          )}
                          {message.deploymentStatus && message.deploymentStatus !== 'pending' && (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.deploymentStatus)}`}>
                              {getStatusIcon(message.deploymentStatus)}
                              <span className="ml-1">Deploy: {message.deploymentStatus}</span>
                            </span>
                          )}
                        </div>

                        {/* Terraform Plan Output */}
                        {message.terraformPlan && (
                          <div className="mt-3">
                            <h5 className="font-medium text-gray-900 mb-1">Terraform Output</h5>
                            <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
                              {message.terraformPlan}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <ArrowPathIcon className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-gray-600">Generating Terraform code...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Describe the infrastructure you want to create..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
              <p className="text-gray-500 mb-4">Create a new conversation to start building infrastructure</p>
              <button
                onClick={createNewConversation}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5 inline mr-2" />
                New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Create New IAC Conversation
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversation Title
              </label>
              <input
                type="text"
                value={newConversationTitle}
                onChange={(e) => setNewConversationTitle(e.target.value)}
                placeholder="Enter a title for your conversation..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateConversation();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelNewConversation}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateConversation}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
