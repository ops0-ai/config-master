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
import Image from 'next/image';
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
          className={`fixed bottom-6 right-6 p-3 rounded-full shadow-lg transition-all transform hover:scale-110 z-50 ${
            hasNotification ? 'bg-gradient-to-r from-purple-600 to-blue-600 animate-pulse' : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600'
          }`}
        >
          <Image
            src="/images/phoenix.svg"
            alt="Phoenix AI"
            width={32}
            height={32}
            className="rounded-lg brightness-110 contrast-125"
          />
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
              <Image
                src="/images/phoenix.svg"
                alt="Phoenix"
                width={20}
                height={20}
                className="rounded"
              />
              <span className="font-semibold">Phoenix</span>
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
                  <div className="text-center text-gray-500 mt-4">
                    <div className="flex justify-center mb-4">
                      <Image
                        src="/images/phoenix.svg"
                        alt="Phoenix"
                        width={48}
                        height={48}
                        className="opacity-50"
                      />
                    </div>
                    {/* Animated Workflow - Responsive to popup size */}
                    <div className={`overflow-visible ${isMaximized ? 'py-8' : 'py-4'}`}>
                      <div className={`flex items-center justify-center ${isMaximized ? 'space-x-8' : 'space-x-4'}`}>
                        {/* Create Stage */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="relative mb-2">
                            <div className={`${isMaximized ? 'w-12 h-12' : 'w-8 h-8'} bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg animate-pulse`}>
                              <svg className={`${isMaximized ? 'w-6 h-6' : 'w-4 h-4'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </div>
                            <div className={`absolute ${isMaximized ? '-inset-1' : '-inset-0.5'} bg-blue-400 rounded-full opacity-20 animate-ping`}></div>
                          </div>
                          <h4 className={`${isMaximized ? 'text-sm' : 'text-xs'} font-semibold text-slate-900 mb-0.5`}>Create</h4>
                          <p className={`${isMaximized ? 'text-xs' : 'text-[10px]'} text-slate-600 text-center whitespace-nowrap`}>Provision</p>
                        </div>

                        {/* Arrow 1 */}
                        <div className="flex items-center flex-shrink-0">
                          <div className={`${isMaximized ? 'w-8' : 'w-4'} h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 relative`}>
                            <div className={`absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 ${isMaximized ? 'border-l-2' : 'border-l-1'} border-l-purple-400 border-t-1 border-t-transparent border-b-1 border-b-transparent animate-pulse`}></div>
                          </div>
                        </div>

                        {/* Manage/Configure Stage */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="relative mb-2">
                            <div className={`${isMaximized ? 'w-12 h-12' : 'w-8 h-8'} bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse`} style={{animationDelay: '0.5s'}}>
                              <svg className={`${isMaximized ? 'w-6 h-6' : 'w-4 h-4'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div className={`absolute ${isMaximized ? '-inset-1' : '-inset-0.5'} bg-purple-400 rounded-full opacity-20 animate-ping`} style={{animationDelay: '0.5s'}}></div>
                          </div>
                          <h4 className={`${isMaximized ? 'text-sm' : 'text-xs'} font-semibold text-slate-900 mb-0.5`}>Manage</h4>
                          <p className={`${isMaximized ? 'text-xs' : 'text-[10px]'} text-slate-600 text-center whitespace-nowrap`}>Configure</p>
                        </div>

                        {/* Arrow 2 */}
                        <div className="flex items-center flex-shrink-0">
                          <div className={`${isMaximized ? 'w-8' : 'w-4'} h-0.5 bg-gradient-to-r from-purple-400 to-green-400 relative`}>
                            <div className={`absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 ${isMaximized ? 'border-l-2' : 'border-l-1'} border-l-green-400 border-t-1 border-t-transparent border-b-1 border-b-transparent animate-pulse`} style={{animationDelay: '1s'}}></div>
                          </div>
                        </div>

                        {/* Operate Stage */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="relative mb-2">
                            <div className={`${isMaximized ? 'w-12 h-12' : 'w-8 h-8'} bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg animate-pulse`} style={{animationDelay: '1s'}}>
                              <svg className={`${isMaximized ? 'w-6 h-6' : 'w-4 h-4'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className={`absolute ${isMaximized ? '-inset-1' : '-inset-0.5'} bg-green-400 rounded-full opacity-20 animate-ping`} style={{animationDelay: '1s'}}></div>
                          </div>
                          <h4 className={`${isMaximized ? 'text-sm' : 'text-xs'} font-semibold text-slate-900 mb-0.5`}>Operate</h4>
                          <p className={`${isMaximized ? 'text-xs' : 'text-[10px]'} text-slate-600 text-center whitespace-nowrap`}>Monitor</p>
                        </div>
                      </div>
                    </div>
                    {/* Welcome Text */}
                    <div className={`mt-${isMaximized ? '8' : '4'} text-center`}>
                      <h3 className={`${isMaximized ? 'text-2xl' : 'text-sm'} font-bold text-slate-900 mb-${isMaximized ? '4' : '3'}`}>
                        Phoenix AI DevOps Engineer
                      </h3>
                      <p className={`${isMaximized ? 'text-base' : 'text-xs'} text-slate-700 leading-relaxed max-w-${isMaximized ? '2xl' : 'xs'} mx-auto mb-${isMaximized ? '5' : '3'}`}>
                        Your enterprise-grade autonomous infrastructure assistant delivering continuous operations excellence.
                      </p>
                      <div className={`${isMaximized ? 'text-sm' : 'text-[10px]'} text-slate-600 space-y-${isMaximized ? '2' : '1'}`}>
                        <div className={`flex items-center justify-center ${isMaximized ? 'space-x-8' : 'space-x-4'}`}>
                          <span className="flex items-center">
                            <div className={`${isMaximized ? 'w-2 h-2' : 'w-1.5 h-1.5'} bg-blue-500 rounded-full mr-${isMaximized ? '2' : '1.5'}`}></div>
                            Intelligent Provisioning
                          </span>
                          <span className="flex items-center">
                            <div className={`${isMaximized ? 'w-2 h-2' : 'w-1.5 h-1.5'} bg-purple-500 rounded-full mr-${isMaximized ? '2' : '1.5'}`}></div>
                            Autonomous Management
                          </span>
                        </div>
                        <div className="flex items-center justify-center">
                          <span className="flex items-center">
                            <div className={`${isMaximized ? 'w-2 h-2' : 'w-1.5 h-1.5'} bg-green-500 rounded-full mr-${isMaximized ? '2' : '1.5'}`}></div>
                            24×7 Infrastructure Guardian
                          </span>
                        </div>
                      </div>
                    </div>
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