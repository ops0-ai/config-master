'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ServerIcon,
  PlusIcon,
  CpuChipIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CommandLineIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  XMarkIcon,
  InformationCircleIcon,
  TrashIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  BeakerIcon,
  AdjustmentsHorizontalIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  FireIcon,
  CubeTransparentIcon,
  DocumentTextIcon,
  CircleStackIcon,
  ArrowUpTrayIcon,
  LightBulbIcon,
  EyeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import ArchitectureModal from './ArchitectureModal';
import { useOrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';

interface HiveAgent {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'degraded' | 'error';
  osType: string;
  osVersion: string;
  arch: string;
  version: string;
  lastHeartbeat: string;
  systemInfo: {
    cpu?: { cores: number; model: string; usage: number };
    memory?: { total: number; used: number; free: number };
    disk?: { total: number; used: number; free: number };
  };
  capabilities: string[];
  createdAt: string;
}

interface HiveIssue {
  id: string;
  agentId: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  category: string;
}

export default function HivePage() {
  const [agents, setAgents] = useState<HiveAgent[]>([]);
  const [issues, setIssues] = useState<HiveIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<HiveAgent | null>(null);
  const [installCommand, setInstallCommand] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentHostname, setNewAgentHostname] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<HiveAgent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<any>(null);
  const [showCommandConfirm, setShowCommandConfirm] = useState(false);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [configYaml, setConfigYaml] = useState('');
  const [isDeployingConfig, setIsDeployingConfig] = useState(false);
  const [isRestartingAgent, setIsRestartingAgent] = useState(false);
  const [showFixModal, setShowFixModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<HiveIssue | null>(null);
  const [aiFixRecommendation, setAiFixRecommendation] = useState('');
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isFeatureEnabled } = useOrganizationFeatures();

  useEffect(() => {
    loadAgents();
    // Set up polling for real-time updates
    const interval = setInterval(loadAgents, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/hive/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
        await loadIssues(data.agents || []);
      } else {
        console.error('Failed to load agents');
        setAgents([]);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadIssues = async (agentList: HiveAgent[]) => {
    try {
      if (agentList.length > 0) {
        const allIssues: HiveIssue[] = [];
        for (const agent of agentList) {
          const response = await fetch(`/api/hive/agents/${agent.id}/issues`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            allIssues.push(...(data.issues || []));
          }
        }
        setIssues(allIssues);
      }
    } catch (error) {
      console.error('Error loading issues:', error);
    }
  };

  const createAgent = async () => {
    if (!newAgentName.trim() || !newAgentHostname.trim()) {
      toast.error('Please provide both agent name and hostname');
      return;
    }

    try {
      const response = await fetch('/api/hive/agents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newAgentName.trim(),
          hostname: newAgentHostname.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
        generateInstallCommand(data.apiKey);
        setShowInstallModal(true);
        setNewAgentName('');
        setNewAgentHostname('');
        await loadAgents();
        toast.success('Agent created successfully!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create agent');
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      toast.error('Failed to create agent');
    }
  };

  const generateInstallCommand = (apiKey: string) => {
    // Use API URL instead of frontend URL for install script
    const apiUrl = window.location.origin.replace(':3000', ':5005');
    const command = `curl -sSL ${apiUrl}/api/hive/install | bash -s -- --api-key=${apiKey}`;
    setInstallCommand(command);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadAgents();
  };

  const deleteAgent = async () => {
    if (!agentToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/hive/agents/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success(`Agent "${agentToDelete.name}" deleted successfully`);
        setShowDeleteModal(false);
        setAgentToDelete(null);
        await loadAgents();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setIsDeleting(false);
    }
  };

  const loadChatHistory = async (agentId: string) => {
    try {
      const response = await fetch(`/api/hive/agents/${agentId}/chat`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Process messages to determine user vs system
        const processedMessages = (data.messages || []).map((msg: any) => ({
          ...msg,
          isUserMessage: msg.commandType === 'chat_user',
          isAIMessage: msg.commandType === 'chat_ai',
          isResult: msg.commandType === 'execute' || msg.commandType === 'execute_result'
        }));
        
        setChatMessages(processedMessages);
      } else {
        console.error('Failed to load chat history');
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setChatMessages([]);
    }
  };

  const pollForCommandResults = async (agentId: string, commandId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 30 seconds
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/hive/agents/${agentId}/commands/${commandId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const command = data.command;
          
          if (command && (command.status === 'completed' || command.status === 'failed')) {
            // Command completed, update the chat with results
            const resultMessage = {
              id: commandId + '_result',
              command: command.command,
              commandType: 'execute_result',
              status: command.status,
              executedAt: command.executedAt,
              completedAt: command.completedAt || new Date().toISOString(),
              response: command.response || (command.status === 'failed' ? 'Command failed to execute' : 'Command completed successfully'),
              exitCode: command.exitCode,
              userId: 'system',
              isResult: true
            };

            setChatMessages(prev => {
              // Remove any existing pending message for this command
              const filtered = prev.filter(msg => msg.id !== commandId + '_exec');
              return [...filtered, resultMessage];
            });
            
            return; // Stop polling
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000); // Poll every second
        } else {
          // Timeout - show timeout message
          const timeoutMessage = {
            id: commandId + '_timeout',
            command: 'Command Timeout',
            commandType: 'timeout',
            status: 'timeout',
            executedAt: new Date().toISOString(),
            response: 'Command timed out. Please check agent logs.',
            userId: 'system',
            isResult: true
          };
          
          setChatMessages(prev => [...prev, timeoutMessage]);
        }
      } catch (error) {
        console.error('Error polling for command results:', error);
      }
    };

    poll();
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedAgent) return;

    setIsSendingMessage(true);
    const message = chatInput.trim();
    setChatInput('');

    try {
      const response = await fetch(`/api/hive/agents/${selectedAgent.id}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          type: 'chat'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add user message to chat
        const userMessage = {
          id: `user_${Date.now()}`,
          command: message,
          commandType: 'chat_user',
          executedAt: new Date().toISOString(),
          isUserMessage: true
        };
        
        // Add AI response to chat
        const aiMessage = {
          id: `ai_${Date.now()}`,
          command: 'AI Response',
          response: data.ai_response || data.message,
          commandType: 'chat_ai',
          executedAt: new Date().toISOString(),
          isAIMessage: true
        };
        
        setChatMessages(prev => [...prev, userMessage, aiMessage]);
        
        // If command was executed or is being executed
        if (data.executing_command || data.command_result) {
          if (data.command_result) {
            // Command already has results
            const resultMessage = {
              id: `result_${Date.now()}`,
              command: data.executing_command,
              commandType: 'execute_result',
              status: 'completed',
              executedAt: new Date().toISOString(),
              response: data.command_result,
              isResult: true
            };
            setChatMessages(prev => [...prev, resultMessage]);
          } else if (data.command_id) {
            // Command is pending, poll for results
            const pendingMessage = {
              id: data.command_id + '_exec',
              command: data.executing_command,
              commandType: 'execute',
              status: 'pending',
              executedAt: new Date().toISOString(),
              response: 'Executing command...',
              isResult: true
            };
            setChatMessages(prev => [...prev, pendingMessage]);
            pollForCommandResults(selectedAgent.id, data.command_id);
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSendingMessage(false);
      setPendingCommand(null);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const loadAgentConfig = async (agentId: string) => {
    try {
      const response = await fetch(`/api/hive/agents/${agentId}/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAgentConfig(data);
        
        // Load current agent configuration (create default if none exists)
        if (data.configs && data.configs.length > 0) {
          const currentConfig = data.configs.find((c: any) => c.enabled) || data.configs[0];
          // Convert JSON config to YAML format for editing
          setConfigYaml(JSON.stringify(currentConfig.config, null, 2));
        } else {
          // Default configuration template (in JSON for editing, will be converted to YAML on deployment)
          const defaultConfig = {
            server: {
              url: "http://localhost:5005",
              api_key: data.agent?.apiKey || "",
              heartbeat_interval: "30s",
              reconnect_interval: "10s",
              max_reconnects: 3,
              timeout: "30s"
            },
            agent: {
              name: data.agent?.name || "agent",
              hostname: data.agent?.hostname || "localhost",
              data_dir: "/var/lib/pulse-hive",
              buffer_size: 10000,
              batch_size: 1000,
              flush_interval: "10s",
              compress_data: true,
              enable_profiling: false,
              metrics_port: 8080,
              enable_self_monitoring: true
            },
            logging: {
              level: "info",
              format: "json",
              output: "stdout"
            },
            collectors: {
              logs: {
                enabled: true,
                paths: [
                  {
                    path: "/var/log/system.log",
                    tags: { source: "system" }
                  },
                  {
                    path: "/var/log/install.log",
                    tags: { source: "install" }
                  },
                  {
                    path: "/var/log/syslog",
                    tags: { source: "syslog" }
                  },
                  {
                    path: "/var/log/auth.log",
                    tags: { source: "security" }
                  }
                ],
                patterns: [
                  {
                    name: "error_detection",
                    pattern: "(?i)(error|failed|exception|critical)",
                    severity: "error",
                    category: "application"
                  }
                ],
                parsers: {
                  regex: {
                    type: "regex",
                    pattern: "^(?P<timestamp>\\S+\\s+\\S+)\\s+(?P<host>\\S+)\\s+(?P<service>\\S+):\\s+(?P<message>.*)$"
                  },
                  json: { type: "json" },
                  syslog: {
                    type: "regex", 
                    pattern: "^(?P<timestamp>\\w+\\s+\\d+\\s+\\d+:\\d+:\\d+)\\s+(?P<host>\\S+)\\s+(?P<service>\\w+)(?:\\[(?P<pid>\\d+)\\])?:\\s+(?P<message>.*)$"
                  }
                },
                scan_frequency: "10s",
                rotate_wait: "5s"
              },
              metrics: { 
                enabled: true, 
                interval: "60s",
                system: {
                  cpu: true,
                  memory: true,
                  disk: true,
                  network: true,
                  process: true
                }
              },
              traces: { enabled: false },
              events: { enabled: false }
            },
            outputs: [
              {
                name: "pulse_platform",
                type: "http",
                enabled: true,
                url: "http://localhost:5005/api/hive/telemetry",
                auth: { type: "bearer", token: data.agent?.apiKey || "" },
                batch_size: 1000,
                timeout: "30s",
                data_types: ["metrics", "events", "traces"],
                retry: {
                  max_retries: 3,
                  initial_backoff: "5s",
                  max_backoff: "60s",
                  backoff_multiple: 2.0
                }
              },
              {
                name: "openobserve",
                type: "http",
                enabled: false,
                url: "https://api.openobserve.ai/api/your_organization/stream_name/_json",
                batch_size: 1000,
                timeout: "30s",
                auth: {
                  type: "basic",
                  username: "your_email@example.com", 
                  password: "your_api_password"
                },
                data_types: ["logs"],
                retry: {
                  max_retries: 3,
                  initial_backoff: "5s",
                  max_backoff: "60s", 
                  backoff_multiple: 2.0
                }
              }
            ],
            healthcheck: {
              enabled: true,
              port: 8081,
              path: "/health",
              interval: "30s"
            }
          };
          setConfigYaml(JSON.stringify(defaultConfig, null, 2));
        }
      } else {
        console.error('Failed to load agent config');
        setAgentConfig(null);
      }
    } catch (error) {
      console.error('Error loading agent config:', error);
      setAgentConfig(null);
    }
  };

  const deployConfig = async () => {
    if (!selectedAgent || !configYaml.trim()) return;
    
    setIsDeployingConfig(true);
    try {
      let parsedConfig;
      try {
        // First try to parse as JSON
        parsedConfig = JSON.parse(configYaml);
      } catch (jsonError) {
        // If JSON parsing fails, try to parse as YAML
        try {
          // Simple YAML parsing - for now just check if it looks like YAML
          if (configYaml.includes(':') && !configYaml.trim().startsWith('{')) {
            // This looks like YAML, convert to a basic JSON structure
            // For now, we'll send the raw text and let the backend handle it
            parsedConfig = { yaml_content: configYaml };
          } else {
            toast.error('Invalid configuration format. Please use valid JSON or YAML.');
            return;
          }
        } catch (yamlError) {
          toast.error('Invalid configuration format. Please use valid JSON or YAML.');
          return;
        }
      }

      const response = await fetch(`/api/hive/agents/${selectedAgent.id}/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configName: `config_${Date.now()}`,
          config: parsedConfig,
          enabled: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.deployment_command_id) {
          toast.success('Configuration deployment started! Verifying...');
          
          // Track deployment progress
          trackDeploymentProgress(selectedAgent.id, result.deployment_command_id);
        } else {
          toast.success('Configuration saved successfully!');
          await loadAgentConfig(selectedAgent.id);
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to deploy configuration');
      }
    } catch (error) {
      console.error('Error deploying config:', error);
      toast.error('Failed to deploy configuration');
    } finally {
      setIsDeployingConfig(false);
    }
  };

  const trackDeploymentProgress = async (agentId: string, commandId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max
    
    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/hive/agents/${agentId}/commands/${commandId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const command = data.command;
          
          if (command && command.status === 'completed') {
            toast.success('Configuration deployed successfully!');
            return;
          } else if (command && command.status === 'failed') {
            toast.error('Configuration deployment failed. Check agent logs.');
            return;
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 2000); // Check every 2 seconds
        } else {
          toast('Configuration deployment is taking longer than expected. Please check agent status.', {
            icon: '⚠️'
          });
        }
      } catch (error) {
        console.error('Error checking deployment progress:', error);
      }
    };
    
    checkProgress();
  };

  const restartAgent = async () => {
    if (!selectedAgent) return;
    
    setIsRestartingAgent(true);
    try {
      // Try multiple restart commands based on OS
      const restartCommands = [
        'sudo systemctl restart hive-agent || sudo launchctl restart com.pulse.hive-agent || sudo service hive-agent restart',
        'sudo pkill -f hive-agent; sleep 2; sudo systemctl start hive-agent || sudo launchctl start com.pulse.hive-agent || sudo service hive-agent start'
      ];

      const response = await fetch(`/api/hive/agents/${selectedAgent.id}/commands`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commandType: 'system',
          command: restartCommands[0],
          parameters: { 
            service: 'hive-agent',
            description: 'Restart Hive Agent Service',
            fallback_command: restartCommands[1]
          }
        }),
      });

      if (response.ok) {
        toast.success('Agent restart command sent! The agent will restart shortly.');
        // Refresh agent status after a delay
        setTimeout(() => {
          loadAgents();
        }, 5000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to restart agent');
      }
    } catch (error) {
      console.error('Error restarting agent:', error);
      toast.error('Failed to restart agent');
    } finally {
      setIsRestartingAgent(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const generateAiFix = async (issue: HiveIssue) => {
    setIsGeneratingFix(true);
    try {
      // Find the agent associated with this issue
      const issueAgent = agents.find(a => a.id === issue.agentId);
      
      const response = await fetch('/api/ai-assistant/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Analyze this infrastructure issue and provide a fix recommendation:

Agent: ${issueAgent?.name || 'Unknown'} (${issueAgent?.hostname || 'Unknown'})
OS: ${issueAgent?.osType} ${issueAgent?.osVersion}
Issue: ${issue.title}
Description: ${issue.description}
Severity: ${issue.severity}
Category: ${issue.category}

Provide:
1. Root cause analysis
2. Step-by-step fix instructions
3. Prevention recommendations
4. Commands to execute (if applicable)

Be specific and actionable.`
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiFixRecommendation(data.response || 'AI analysis failed to generate a response.');
      } else {
        setAiFixRecommendation('Failed to generate AI fix recommendation. Please try again.');
      }
    } catch (error) {
      console.error('Error generating AI fix:', error);
      setAiFixRecommendation('Error connecting to AI assistant. Please check your connection and try again.');
    } finally {
      setIsGeneratingFix(false);
    }
  };

  const filterAgents = (agents: HiveAgent[], query: string) => {
    return agents.filter(agent => {
      if (!query.trim()) return true;
      const searchQuery = query.toLowerCase().trim();
      return (
        (agent.name || '').toLowerCase().includes(searchQuery) ||
        (agent.hostname || '').toLowerCase().includes(searchQuery) ||
        (agent.ipAddress || '').toLowerCase().includes(searchQuery)
      );
    });
  };

  const proceedWithFix = async () => {
    if (!selectedIssue) return;
    
    // Find the agent for this issue
    const issueAgent = agents.find(a => a.id === selectedIssue.agentId);
    if (!issueAgent) {
      toast.error('Agent not found for this issue');
      return;
    }

    // Close fix modal
    setShowFixModal(false);
    
    // Open chat modal with the selected agent
    setSelectedAgent(issueAgent);
    setShowChatModal(true);
    await loadChatHistory(issueAgent.id);
    
    // Auto-paste the error context into chat
    const errorContext = `Issue: ${selectedIssue.title}
Description: ${selectedIssue.description}
Severity: ${selectedIssue.severity}
Category: ${selectedIssue.category}

${aiFixRecommendation}

Please help me resolve this issue on ${issueAgent.hostname}.`;
    
    setChatInput(errorContext);
    toast.success(`Navigated to ${issueAgent.name} chat with error context loaded`);
  };

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatPercentage = (used: number, total: number) => {
    if (!total) return 0;
    return Math.round((used / total) * 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'offline':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-300';
      case 'error':
        return 'bg-orange-50 text-orange-700 border-orange-300';
      case 'warning':
        return 'bg-yellow-50 text-yellow-700 border-yellow-300';
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <CubeTransparentIcon className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Pulse Hive...</p>
        </div>
      </div>
    );
  }

  // Check if hive feature is enabled
  if (!isFeatureEnabled('hive')) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <CubeTransparentIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Hive Monitoring Unavailable</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              The Hive Monitoring feature is not enabled for your organization. 
              Contact your administrator to enable this feature.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">Hive Monitoring includes:</p>
              <ul className="text-left space-y-1 max-w-sm mx-auto">
                <li>• Distributed monitoring agents</li>
                <li>• Real-time log collection</li>
                <li>• System metrics tracking</li>
                <li>• AI-powered issue detection</li>
                <li>• Remote agent management</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Enterprise Header */}
        <div className="mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur">
                <CubeTransparentIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold flex items-center">
                  Pulse Hive
                  <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    BETA
                  </span>
                </h1>
                <p className="text-indigo-100">Enterprise Infrastructure Monitoring & Control</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowArchitectureModal(true)}
                className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg font-medium hover:bg-white/30 transition-colors flex items-center space-x-2"
                title="View Architecture Overview"
              >
                <InformationCircleIcon className="h-5 w-5" />
                <span>Info</span>
              </button>
              <button
                onClick={refresh}
                className={`px-4 py-2 bg-white/20 backdrop-blur rounded-lg font-medium hover:bg-white/30 transition-colors flex items-center space-x-2 ${refreshing ? 'opacity-50' : ''}`}
                disabled={refreshing}
              >
                <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => setShowInstallModal(true)}
                className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors flex items-center space-x-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Deploy Agent</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enterprise Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{agents.length}</p>
                <p className="text-xs text-green-600 mt-1">
                  {agents.filter(a => a.status === 'online').length} online
                </p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <ServerIcon className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Health Score</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {agents.length > 0 ? Math.round((agents.filter(a => a.status === 'online').length / agents.length) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">System health</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <ShieldCheckIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Issues</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{issues.length}</p>
                <p className="text-xs text-orange-600 mt-1">
                  {issues.filter(i => i.severity === 'critical').length} critical
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg CPU Usage</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {agents.length > 0 
                    ? `${Math.round(agents.reduce((sum, agent) => sum + (agent.systemInfo.cpu?.usage || 0), 0) / agents.length)}%`
                    : 'N/A'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {agents.length > 0 ? 'Across all agents' : 'No data available'}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Memory Usage</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {agents.length > 0 && agents.some(a => a.systemInfo.memory)
                    ? `${Math.round(agents.reduce((sum, agent) => {
                        if (agent.systemInfo.memory && agent.systemInfo.memory.total > 0) {
                          return sum + ((agent.systemInfo.memory.used / agent.systemInfo.memory.total) * 100);
                        }
                        return sum;
                      }, 0) / agents.filter(a => a.systemInfo.memory?.total).length)}%`
                    : 'N/A'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {agents.length > 0 ? 'Average usage' : 'No data available'}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <ChartPieIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Single Column Layout */}
        <div className="space-y-6">
          {/* Infrastructure Agents Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <GlobeAltIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Infrastructure Agents
                </h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{(() => {
                    const filteredAgents = filterAgents(agents, searchQuery);
                    return `${filteredAgents.filter(a => a.status === 'online').length} / ${filteredAgents.length} online`;
                  })()}</span>
                  {(() => {
                    const filteredAgents = filterAgents(agents, searchQuery);
                    return filteredAgents.length > 0 && (
                      <span>Page {currentPage} of {Math.ceil(filteredAgents.length / 15)}</span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    placeholder="Search agents by name, hostname, or IP..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y divide-gray-200 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 border-t border-gray-100">
              {agents.length === 0 ? (
                <div className="p-12 text-center">
                  <ServerIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-900">No agents deployed</p>
                  <p className="mt-2 text-sm text-gray-500">Deploy your first agent to start monitoring</p>
                  <button
                    onClick={() => setShowInstallModal(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Deploy First Agent
                  </button>
                </div>
              ) : (
                (() => {
                  // Apply search filter first
                  const filteredAgents = filterAgents(agents, searchQuery);
                  
                  // Then apply pagination to filtered results
                  const itemsPerPage = 15;
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedAgents = filteredAgents.slice(startIndex, endIndex);
                  
                  // Show message if no results found
                  if (filteredAgents.length === 0) {
                    return (
                      <div className="p-12 text-center">
                        <MagnifyingGlassIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">No agents found</p>
                        <p className="mt-2 text-sm text-gray-500">
                          No agents match your search "{searchQuery}"
                        </p>
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setCurrentPage(1);
                          }}
                          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          Clear Search
                        </button>
                      </div>
                    );
                  }
                  
                  return paginatedAgents.map((agent) => (
                    <div key={agent.id} className="p-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <div className={`p-2 rounded-lg ${agent.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}>
                              <ServerIcon className={`h-6 w-6 ${agent.status === 'online' ? 'text-green-600' : 'text-gray-400'}`} />
                            </div>
                            <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white ${
                              agent.status === 'online' ? 'bg-green-500' :
                              agent.status === 'degraded' ? 'bg-yellow-500' :
                              agent.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                            }`}></div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                            <p className="text-xs text-gray-500">{agent.hostname}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-gray-400">{agent.ipAddress}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-400">{agent.osType} {agent.osVersion}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-400">{agent.arch}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {/* Agent Metrics */}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <div className="flex items-center space-x-1" title="Log Sources">
                              <DocumentTextIcon className="h-3 w-3 text-blue-500" />
                              <span>{agent.status === 'online' ? 3 : 0}</span>
                            </div>
                            <div className="flex items-center space-x-1" title="Data Sent">
                              <CircleStackIcon className="h-3 w-3 text-green-500" />
                              <span>{agent.systemInfo?.memory?.used ? `${Math.round((agent.systemInfo.memory.used / (1024 * 1024)) / 100)} MB` : '0 KB'}</span>
                            </div>
                            <div className="flex items-center space-x-1" title="Output Destinations">
                              <ArrowUpTrayIcon className="h-3 w-3 text-purple-500" />
                              <span>2</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 text-xs rounded-full font-medium border ${getStatusColor(agent.status)}`}>
                            {agent.status}
                          </span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                setSelectedAgent(agent);
                                setShowChatModal(true);
                                loadChatHistory(agent.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Remote Shell"
                            >
                              <CommandLineIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAgent(agent);
                                setShowConfigModal(true);
                                loadAgentConfig(agent.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Configure"
                            >
                              <AdjustmentsHorizontalIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setAgentToDelete(agent);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* System metrics */}
                      {agent.systemInfo && agent.status === 'online' && (
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          {agent.systemInfo.cpu && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600 flex items-center">
                                  <CpuChipIcon className="h-3 w-3 mr-1" />
                                  CPU
                                </span>
                                <span className="text-xs font-bold text-gray-900">{agent.systemInfo.cpu.usage}%</span>
                              </div>
                              <div className="bg-white rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${agent.systemInfo.cpu.usage}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {agent.systemInfo.memory && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600 flex items-center">
                                  <ChartBarIcon className="h-3 w-3 mr-1" />
                                  Memory
                                </span>
                                <span className="text-xs font-bold text-gray-900">
                                  {formatPercentage(agent.systemInfo.memory.used, agent.systemInfo.memory.total)}%
                                </span>
                              </div>
                              <div className="bg-white rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${formatPercentage(agent.systemInfo.memory.used, agent.systemInfo.memory.total)}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {agent.systemInfo.disk && (
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600 flex items-center">
                                  <ServerIcon className="h-3 w-3 mr-1" />
                                  Disk
                                </span>
                                <span className="text-xs font-bold text-gray-900">
                                  {formatPercentage(agent.systemInfo.disk.used, agent.systemInfo.disk.total)}%
                                </span>
                              </div>
                              <div className="bg-white rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-purple-400 to-pink-500 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${formatPercentage(agent.systemInfo.disk.used, agent.systemInfo.disk.total)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center">
                          <ClockIcon className="h-3 w-3 mr-1" />
                          Last seen: {formatLastSeen(agent.lastHeartbeat)}
                        </span>
                        {agent.version && (
                          <span className="flex items-center">
                            <BeakerIcon className="h-3 w-3 mr-1" />
                            v{agent.version}
                          </span>
                        )}
                      </div>
                    </div>
                  ));
                })()
              )}
            </div>
            
            {/* Pagination Controls */}
            {(() => {
              const filteredAgents = filterAgents(agents, searchQuery);
              
              return filteredAgents.length > 15 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Showing {Math.min((currentPage - 1) * 15 + 1, filteredAgents.length)} to {Math.min(currentPage * 15, filteredAgents.length)} of {filteredAgents.length} agents
                      {searchQuery && <span className="text-indigo-600 ml-1">(filtered)</span>}
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm font-medium">
                        Page {currentPage} of {Math.ceil(filteredAgents.length / 15)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(filteredAgents.length / 15), currentPage + 1))}
                        disabled={currentPage === Math.ceil(filteredAgents.length / 15)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Agent Installation Modal */}
        {showInstallModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full m-4">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    {apiKey ? 'Agent Deployment Instructions' : 'Deploy New Agent'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowInstallModal(false);
                      setApiKey('');
                      setInstallCommand('');
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                {!apiKey ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="e.g., Production Server 1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Hostname
                      </label>
                      <input
                        type="text"
                        value={newAgentHostname}
                        onChange={(e) => setNewAgentHostname(e.target.value)}
                        placeholder="e.g., prod-server-01.company.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        onClick={() => setShowInstallModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createAgent}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                      >
                        Create Agent
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
                        <p className="text-sm font-medium text-green-800">
                          Agent created successfully!
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key (keep this secure)
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={apiKey}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-l-lg text-sm font-mono"
                        />
                        <button
                          onClick={() => copyToClipboard(apiKey)}
                          className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Installation Command
                      </label>
                      <div className="bg-gray-900 rounded-lg p-3">
                        <code className="text-green-400 text-sm font-mono break-all">
                          {installCommand}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(installCommand)}
                        className="mt-2 inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                      >
                        {copied ? (
                          <>
                            <CheckIcon className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                            Copy Command
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Deployment Steps:</p>
                          <ol className="list-decimal list-inside space-y-1 text-xs">
                            <li>Copy the installation command above</li>
                            <li>SSH into your target server with root access</li>
                            <li>Paste and execute the command</li>
                            <li>Agent will auto-register and appear in dashboard</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Chat Modal */}
        {showChatModal && selectedAgent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full m-4 h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <CommandLineIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Remote Shell - {selectedAgent.name}
                      </h2>
                      <p className="text-sm text-indigo-100">
                        {selectedAgent.hostname} • {['online', 'running'].includes(selectedAgent.status) ? 
                          <span className="text-green-300">● Online</span> : 
                          <span className="text-gray-300">● Offline</span>
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowChatModal(false);
                      setChatMessages([]);
                      setChatInput('');
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 mt-8">
                    <CommandLineIcon className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                    <p>No command history</p>
                    <p className="text-sm mt-1">Type a command or ask about the system</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatMessages.map((message) => (
                      <div key={message.id} className="font-mono text-sm">
                        {/* User message */}
                        {message.isUserMessage && (
                          <div className="flex items-start space-x-2">
                            <span className="text-green-400">$</span>
                            <div className="flex-1">
                              <p className="text-green-400">{message.command}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* AI message */}
                        {message.isAIMessage && (
                          <div className="mt-2 p-3 bg-gray-800 rounded-lg border border-gray-700">
                            <p className="text-gray-300 whitespace-pre-wrap">{message.response}</p>
                          </div>
                        )}
                        
                        {/* Command result */}
                        {message.isResult && (
                          <div className="mt-2">
                            {message.status === 'pending' ? (
                              <div className="flex items-center space-x-2 text-yellow-400">
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                <span>Executing: {message.command}</span>
                              </div>
                            ) : (
                              <div className="bg-black/50 rounded-lg p-3 border border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-500">Command output:</span>
                                  {message.exitCode !== undefined && (
                                    <span className={`text-xs ${message.exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      Exit code: {message.exitCode}
                                    </span>
                                  )}
                                </div>
                                <pre className="text-gray-300 text-xs whitespace-pre-wrap overflow-x-auto">
                                  {message.response}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
              
              {/* Input */}
              <div className="border-t border-gray-700 bg-gray-800 p-4 rounded-b-xl">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400 font-mono">$</span>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder="Enter command or ask about the system..."
                    className="flex-1 bg-gray-900 text-gray-100 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                    disabled={isSendingMessage}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={isSendingMessage || !chatInput.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSendingMessage ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <CommandLineIcon className="h-4 w-4" />
                    )}
                    <span>Execute</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Config Modal */}
        {showConfigModal && selectedAgent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full m-4 h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <AdjustmentsHorizontalIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Agent Configuration - {selectedAgent.name}
                      </h2>
                      <p className="text-sm text-indigo-100">
                        {selectedAgent.hostname}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowConfigModal(false);
                      setAgentConfig(null);
                      setConfigYaml('');
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enhanced Multi-Output Configuration (JSON - will be deployed as YAML to /etc/pulse-hive/config.yaml)
                  </label>
                  <textarea
                    value={configYaml}
                    onChange={(e) => setConfigYaml(e.target.value)}
                    className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    spellCheck={false}
                  />
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">🚀 Enhanced Features:</h4>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• <strong>Multi-Output Support:</strong> Send logs to Pulse Platform + OpenObserve + Custom endpoints</li>
                      <li>• <strong>Advanced Log Collection:</strong> System logs (/var/log/*), Kubernetes containers, Security logs</li>
                      <li>• <strong>Regex Pattern Support:</strong> Custom log path patterns and parsing rules</li>
                      <li>• <strong>Error Detection:</strong> Automatic error pattern recognition with severity levels</li>
                      <li>• <strong>OpenObserve Integration:</strong> Pre-configured for https://api.openobserve.ai (update credentials)</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <button
                    onClick={restartAgent}
                    disabled={isRestartingAgent}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isRestartingAgent ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="h-4 w-4" />
                    )}
                    <span>Restart Agent</span>
                  </button>
                  
                  <button
                    onClick={deployConfig}
                    disabled={isDeployingConfig}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isDeployingConfig ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    )}
                    <span>Deploy Configuration</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && agentToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Confirm Deletion
                </h2>
              </div>
              <div className="p-6">
                <p className="text-gray-600">
                  Are you sure you want to delete the agent <strong>{agentToDelete.name}</strong>?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This action cannot be undone. The agent will need to be re-registered.
                </p>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setAgentToDelete(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteAgent}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Agent'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Fix Recommendation Modal */}
        {showFixModal && selectedIssue && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full m-4 max-h-[80vh] flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <BugAntIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        AI Fix Recommendation
                      </h2>
                      <p className="text-sm text-indigo-100">
                        {selectedIssue.severity} • {selectedIssue.category}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowFixModal(false);
                      setSelectedIssue(null);
                      setAiFixRecommendation('');
                    }}
                    className="text-white/80 hover:text-white"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto">
                {/* Issue Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Issue Summary</h3>
                    <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityColor(selectedIssue.severity)}`}>
                      {selectedIssue.severity}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Agent: </span>
                      <span className="text-sm text-gray-900">
                        {agents.find(a => a.id === selectedIssue.agentId)?.name || 'Unknown'} 
                        ({agents.find(a => a.id === selectedIssue.agentId)?.hostname || 'Unknown'})
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Issue: </span>
                      <span className="text-sm text-gray-900">{selectedIssue.title}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Description: </span>
                      <span className="text-sm text-gray-700">{selectedIssue.description}</span>
                    </div>
                  </div>
                </div>

                {/* AI Recommendation */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      AI Analysis & Fix Recommendation
                    </h3>
                    {isGeneratingFix && (
                      <div className="flex items-center text-sm text-indigo-600">
                        <ArrowPathIcon className="h-4 w-4 animate-spin mr-1" />
                        Analyzing...
                      </div>
                    )}
                  </div>
                  
                  {isGeneratingFix ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                          <ArrowPathIcon className="h-8 w-8 text-indigo-600 animate-spin" />
                        </div>
                        <p className="text-gray-600 font-medium">AI is analyzing the issue...</p>
                        <p className="text-sm text-gray-500 mt-1">This may take a few moments</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                        {aiFixRecommendation || 'No recommendation generated yet.'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">Ready to apply the fix?</p>
                    <p className="text-xs">This will navigate to the agent chat with error context loaded.</p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowFixModal(false);
                        setSelectedIssue(null);
                        setAiFixRecommendation('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={proceedWithFix}
                      disabled={isGeneratingFix || !aiFixRecommendation}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      <CommandLineIcon className="h-4 w-4" />
                      <span>Proceed to Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Architecture Modal */}
        <ArchitectureModal 
          isOpen={showArchitectureModal} 
          onClose={() => setShowArchitectureModal(false)} 
        />
      </div>
    </div>
  );
}