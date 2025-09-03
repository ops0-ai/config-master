'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChatBubbleOvalLeftEllipsisIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  BookmarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { useOrganizationFeatures } from '../contexts/OrganizationFeaturesContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: string;
    status: string;
    details: any;
  }>;
  analysis?: {
    issues?: Array<{
      severity: string;
      message: string;
      suggestion?: string;
    }>;
    recommendations?: string[];
  };
  generatedContent?: any;
}

interface Suggestion {
  type: 'info' | 'warning' | 'error';
  message: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [hasNotification, setHasNotification] = useState(false);
  const [contextData, setContextData] = useState<any>(null);
  
  const pathname = usePathname();
  const { isFeatureEnabled, loading } = useOrganizationFeatures();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get the current page context
  const getContextPage = () => {
    if (pathname.includes('/servers')) return 'servers';
    if (pathname.includes('/configurations')) return 'configurations';
    if (pathname.includes('/deployments')) return 'deployments';
    if (pathname.includes('/chat')) return 'chat';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/admin/organizations')) return 'organizations';
    if (pathname.includes('/assets')) return 'assets';
    if (pathname.includes('/mdm')) return 'mdm';
    if (pathname.includes('/server-groups')) return 'server-groups';
    if (pathname.includes('/pem-keys')) return 'pem-keys';
    if (pathname.includes('/training')) return 'training';
    if (pathname === '/') return 'dashboard';
    return 'dashboard';
  };

  // Gather page context
  const gatherPageContext = useCallback(() => {
    const context: any = {
      pageUrl: pathname,
      timestamp: new Date().toISOString(),
    };

    // Try to get visible data from the page
    // This would be enhanced to actually read from page state
    const tables = document.querySelectorAll('table');
    if (tables.length > 0) {
      context.visibleItemCount = tables[0].querySelectorAll('tbody tr').length;
    }

    // Get any selected items (checkboxes, etc.)
    const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    context.selectedItems = Array.from(selectedCheckboxes).map((cb: any) => cb.value).filter(Boolean);

    // Get any error messages on the page
    const errorElements = document.querySelectorAll('[class*="error"], [class*="alert"]');
    context.hasErrors = errorElements.length > 0;

    setContextData(context);
    return context;
  }, [pathname]);

  // Load suggestions when page changes
  useEffect(() => {
    loadSuggestions();
    gatherPageContext();
    
    // Reset session when changing pages
    setSessionId(null);
    setMessages([]);
  }, [pathname, gatherPageContext]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load AI suggestions for the current page
  const loadSuggestions = async () => {
    try {
      const response = await fetch(`/api/ai-assistant/suggestions?page=${getContextPage()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setSuggestions(data.map((s: any) => ({
            type: s.severity === 'critical' ? 'error' : s.severity === 'warning' ? 'warning' : 'info',
            message: s.title,
          })));
          setHasNotification(true);
        }
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  // Send message to AI
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setHasNotification(false);

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          message: input,
          contextPage: getContextPage(),
          contextData: gatherPageContext(),
          sessionId,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();

      // Update session ID if new
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      // Add AI response
      const aiMessage: Message = {
        id: data.messageId || Date.now().toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        actions: data.actions,
        analysis: data.analysis,
        generatedContent: data.generatedContent,
      };

      setMessages(prev => [...prev, aiMessage]);

      // Show any new suggestions
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }

    } catch (error) {
      console.error('AI chat error:', error);
      toast.error('Failed to get AI response');
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute an AI-suggested action
  const executeAction = async (messageId: string, actionIndex: number) => {
    const confirmed = window.confirm('Do you want to execute this AI-suggested action?');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/ai-assistant/execute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          messageId,
          actionIndex,
          confirmed: true,
        }),
      });

      if (response.ok) {
        toast.success('Action executed successfully');
        // Refresh the page or update UI as needed
        window.location.reload();
      } else {
        toast.error('Failed to execute action');
      }
    } catch (error) {
      console.error('Execute action error:', error);
      toast.error('Failed to execute action');
    }
  };

  // Save conversation to history
  const saveToHistory = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/ai-assistant/save-to-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        toast.success('Conversation saved to history');
        setMessages([]);
        setSessionId(null);
      } else {
        toast.error('Failed to save conversation');
      }
    } catch (error) {
      console.error('Save to history error:', error);
      toast.error('Failed to save conversation');
    }
  };

  // Copy code from generated content
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  // Render message content with formatting
  const renderMessageContent = (message: Message) => {
    const content = message.content;
    
    // Extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex),
      });
    }

    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <div key={index} className="relative">
                <div className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">{part.language}</span>
                    <button
                      onClick={() => copyCode(part.content)}
                      className="text-xs text-gray-400 hover:text-white flex items-center space-x-1"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="text-sm"><code>{part.content}</code></pre>
                </div>
              </div>
            );
          } else {
            return (
              <p key={index} className="whitespace-pre-wrap">{part.content}</p>
            );
          }
        })}

        {/* Show analysis results */}
        {message.analysis && message.analysis.issues && message.analysis.issues.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1 text-yellow-600" />
              Configuration Issues Found
            </h4>
            <ul className="space-y-1">
              {message.analysis.issues.map((issue, idx) => (
                <li key={idx} className="text-sm">
                  <span className={`font-medium ${
                    issue.severity === 'critical' ? 'text-red-600' :
                    issue.severity === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    [{issue.severity.toUpperCase()}]
                  </span>{' '}
                  {issue.message}
                  {issue.suggestion && (
                    <div className="text-xs text-gray-600 mt-1 ml-4">
                      💡 {issue.suggestion}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Show actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.actions.map((action, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center space-x-2">
                  <SparklesIcon className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">
                    {action.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                {(action.status === 'pending' || action.status === 'blocked') && (
                  <button
                    onClick={() => executeAction(message.id, idx)}
                    className={`px-3 py-1 text-xs rounded ${
                      action.status === 'blocked' 
                        ? 'bg-amber-600 text-white hover:bg-amber-700' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {action.status === 'blocked' ? 'Acknowledge' : 'Execute'}
                  </button>
                )}
                {action.status === 'executed' && (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Don't render if Pulse Assist is disabled or still loading
  if (loading || !isFeatureEnabled('pulseAssist')) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg transition-all transform hover:scale-110 z-50 ${
            hasNotification ? 'bg-gradient-to-r from-purple-600 to-blue-600 animate-pulse' : 'bg-blue-600'
          } text-white`}
        >
          <ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6" />
          {hasNotification && (
            <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full animate-ping"></span>
          )}
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <>
          {/* Modal backdrop for maximized mode */}
          {isMaximized && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsMaximized(false)} />
          )}
          
          <div className={`fixed bg-white rounded-lg shadow-2xl z-50 transition-all flex flex-col ${
            isMaximized 
              ? 'top-4 left-4 right-4 bottom-4 max-w-6xl mx-auto' 
              : isMinimized 
                ? 'bottom-6 right-6 w-80 h-14' 
                : 'bottom-6 right-6 w-96 h-[600px]'
          }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="h-5 w-5" />
              <span className="font-semibold">AI Assistant</span>
              <span className="text-xs opacity-75">• {getContextPage()}</span>
            </div>
            <div className="flex items-center space-x-2">
              {messages.length > 0 && !isMinimized && (
                <button
                  onClick={saveToHistory}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Save to history"
                >
                  <BookmarkIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1 hover:bg-white/20 rounded"
                title={isMaximized ? "Minimize to corner" : "Expand to modal"}
              >
                {isMaximized ? (
                  <ArrowsPointingInIcon className="h-4 w-4" />
                ) : (
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 hover:bg-white/20 rounded"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? '▲' : '▼'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded"
                title="Close"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Suggestions */}
              {suggestions.length > 0 && messages.length === 0 && (
                <div className="p-3 border-b bg-gray-50">
                  <div className="space-y-2">
                    {suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start space-x-2 p-2 rounded ${
                          suggestion.type === 'error' ? 'bg-red-50 text-red-700' :
                          suggestion.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {suggestion.type === 'error' ? (
                          <ExclamationTriangleIcon className="h-4 w-4 mt-0.5" />
                        ) : suggestion.type === 'warning' ? (
                          <ExclamationTriangleIcon className="h-4 w-4 mt-0.5" />
                        ) : (
                          <InformationCircleIcon className="h-4 w-4 mt-0.5" />
                        )}
                        <span className="text-sm">{suggestion.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && suggestions.length === 0 && (
                  <div className="text-center text-gray-500 mt-8">
                    <SparklesIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Hi! I'm your AI assistant.</p>
                    <p className="text-xs mt-2">I can help you with:</p>
                    <ul className="text-xs mt-2 space-y-1 text-left max-w-xs mx-auto">
                      <li>• Analyzing configurations for issues</li>
                      <li>• Creating new deployments</li>
                      <li>• Troubleshooting server problems</li>
                      <li>• Detecting configuration drift</li>
                      <li>• Suggesting optimizations</li>
                    </ul>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : message.role === 'system'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        renderMessageContent(message)
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                      <div className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask me anything..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={isMaximized ? 3 : 2}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
            </>
          )}
          </div>
        </>
      )}
    </>
  );
}