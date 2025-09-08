import express from 'express';
import { Request, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requirePermission } from '../middleware/rbacMiddleware';
import { db } from '../index';
import { 
  hiveAgents, 
  hiveAgentConfigs, 
  hiveTelemetry, 
  hiveIssues, 
  hiveCommands, 
  hiveOutputEndpoints, 
  hiveAgentOutputs,
  organizationSettings
} from '@config-management/database';
import { eq, and, desc, asc, inArray, sql, gte, isNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

// Get Anthropic API key from environment (same as AI Assistant)
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.log('CLAUDE_API_KEY not found in environment');
    return null;
  }
  return new Anthropic({
    apiKey: apiKey,
  });
}

// Wait for a command to complete with polling
async function waitForCommandResult(commandId: string, timeoutMs: number = 30000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 1000; // Poll every second
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await db.select()
        .from(hiveCommands)
        .where(eq(hiveCommands.id, commandId))
        .limit(1);
      
      if (result.length > 0) {
        const command = result[0];
        
        // Check if command has completed or failed
        if (command.status === 'completed' || command.status === 'failed') {
          console.log(`Command ${commandId} completed with status: ${command.status}`);
          return command;
        }
      }
    } catch (error) {
      console.error(`Error polling for command result: ${error}`);
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  console.log(`Command ${commandId} timed out after ${timeoutMs}ms`);
  return null;
}

// Gather Hive agent context for intelligent responses
async function gatherHiveContext(agentId: string, organizationId: string): Promise<any> {
  const context: any = {
    timestamp: new Date().toISOString(),
    agentId
  };

  // Get agent details and status
  const agent = await db.select()
    .from(hiveAgents)
    .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId)))
    .limit(1);

  if (agent.length > 0) {
    context.agent = {
      name: agent[0].name,
      hostname: agent[0].hostname,
      status: agent[0].status,
      lastHeartbeat: agent[0].lastHeartbeat,
      version: agent[0].version,
      platform: 'Unknown'
    };
  }

  // Get recent telemetry data
  const recentTelemetry = await db.select()
    .from(hiveTelemetry)
    .where(eq(hiveTelemetry.agentId, agentId))
    .orderBy(desc(hiveTelemetry.timestamp))
    .limit(10);

  context.recentTelemetry = recentTelemetry.map(t => ({
    timestamp: t.timestamp,
    data: t.data
  }));

  // Get recent issues
  const recentIssues = await db.select()
    .from(hiveIssues)
    .where(eq(hiveIssues.agentId, agentId))
    .orderBy(desc(hiveIssues.detectedAt))
    .limit(5);

  context.recentIssues = recentIssues.map(i => ({
    severity: i.severity,
    title: i.title,
    description: i.description,
    detectedAt: i.detectedAt
  }));

  // Get recent command history (last 10 commands)
  const recentCommands = await db.select()
    .from(hiveCommands)
    .where(and(
      eq(hiveCommands.agentId, agentId),
      inArray(hiveCommands.commandType, ['execute', 'chat_user'])
    ))
    .orderBy(desc(hiveCommands.executedAt))
    .limit(10);

  context.recentCommands = recentCommands.map(c => ({
    command: c.command,
    type: c.commandType,
    status: c.status,
    response: c.response,
    executedAt: c.executedAt
  }));

  // Get all agents in this organization for context
  const allAgents = await db.select({
    id: hiveAgents.id,
    name: hiveAgents.name,
    status: hiveAgents.status,
    hostname: hiveAgents.hostname
  })
  .from(hiveAgents)
  .where(eq(hiveAgents.organizationId, organizationId));

  context.organizationAgents = allAgents;
  context.statistics = {
    totalAgents: allAgents.length,
    onlineAgents: allAgents.filter(a => a.status === 'online').length,
    offlineAgents: allAgents.filter(a => a.status === 'offline').length,
    recentIssues: recentIssues.length,
    recentCommands: recentCommands.length
  };

  return context;
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'hive_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateSessionId(): string {
  const { randomUUID } = require('crypto');
  return randomUUID();
}

const router = express.Router();

// Legacy endpoints moved to public routes section

router.post('/agents', authMiddleware, requirePermission('hive', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, hostname } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const apiKey = generateApiKey();

    const agent = await db.insert(hiveAgents)
      .values({
        organizationId,
        apiKey,
        name,
        hostname,
        status: 'offline'
      })
      .returning();

    return res.json({ success: true, agent: agent[0], apiKey });
  } catch (error) {
    console.error('Error creating agent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const agents = await db.select()
      .from(hiveAgents)
      .where(eq(hiveAgents.organizationId, organizationId))
      .orderBy(desc(hiveAgents.createdAt));

    // Check for offline agents (no heartbeat in last 2 minutes) and update status
    const now = new Date();
    const offlineThreshold = 2 * 60 * 1000; // 2 minutes in milliseconds

    const updatedAgents = await Promise.all(agents.map(async (agent) => {
      const lastHeartbeat = agent.lastHeartbeat ? new Date(agent.lastHeartbeat) : new Date(0);
      const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();
      
      if (timeSinceLastHeartbeat > offlineThreshold && agent.status !== 'offline') {
        // Mark agent as offline in database
        await db.update(hiveAgents)
          .set({ status: 'offline' })
          .where(eq(hiveAgents.id, agent.id));
        
        console.log(`Agent ${agent.name} marked as offline (no heartbeat for ${Math.round(timeSinceLastHeartbeat/1000)}s)`);
        return { ...agent, status: 'offline' };
      }
      
      return agent;
    }));

    return res.json({ success: true, agents: updatedAgents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents/:id', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, id), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({ success: true, agent: agent[0] });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/agents/:id', authMiddleware, requirePermission('hive', 'update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, hostname } = req.body;
    const organizationId = req.user?.organizationId;

    const agent = await db.update(hiveAgents)
      .set({
        name,
        hostname,
        updatedAt: new Date()
      })
      .where(and(eq(hiveAgents.id, id), eq(hiveAgents.organizationId, organizationId!)))
      .returning();

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({ success: true, agent: agent[0] });
  } catch (error) {
    console.error('Error updating agent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/agents/:id', authMiddleware, requirePermission('hive', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const agent = await db.delete(hiveAgents)
      .where(and(eq(hiveAgents.id, id), eq(hiveAgents.organizationId, organizationId!)))
      .returning();

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/agents/:id/configs', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { configType, configName, config, enabled } = req.body;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agentConfig = await db.insert(hiveAgentConfigs)
      .values({
        agentId,
        configType,
        configName,
        config,
        enabled: enabled !== undefined ? enabled : true
      })
      .returning();

    return res.json({ success: true, config: agentConfig[0] });
  } catch (error) {
    console.error('Error creating agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents/:id/configs', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const configs = await db.select()
      .from(hiveAgentConfigs)
      .where(eq(hiveAgentConfigs.agentId, agentId))
      .orderBy(asc(hiveAgentConfigs.configType), asc(hiveAgentConfigs.configName));

    return res.json({ success: true, configs });
  } catch (error) {
    console.error('Error fetching agent configs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents/:id/telemetry', authMiddleware, requirePermission('hive', 'read_telemetry'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { type, limit = 100 } = req.query;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let query = db.select()
      .from(hiveTelemetry)
      .where(eq(hiveTelemetry.agentId, agentId))
      .orderBy(desc(hiveTelemetry.timestamp))
      .limit(Number(limit));

    if (type && typeof type === 'string') {
      query = query.where(and(eq(hiveTelemetry.agentId, agentId), eq(hiveTelemetry.type, type)));
    }

    const telemetry = await query;

    return res.json({ success: true, telemetry });
  } catch (error) {
    console.error('Error fetching telemetry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch telemetry endpoint moved to public routes section

router.post('/agents/:id/telemetry', async (req: Request, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { apiKey, telemetry } = req.body;

    if (!apiKey || !apiKey.startsWith('hive_')) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.apiKey, apiKey)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found or invalid API key' });
    }

    if (!Array.isArray(telemetry)) {
      return res.status(400).json({ error: 'Telemetry data must be an array' });
    }

    const telemetryEntries = telemetry.map(entry => ({
      agentId,
      type: entry.type,
      source: entry.source,
      data: entry.data,
      timestamp: new Date(entry.timestamp || Date.now())
    }));

    await db.insert(hiveTelemetry).values(telemetryEntries);

    return res.json({ success: true, inserted: telemetryEntries.length });
  } catch (error) {
    console.error('Error inserting telemetry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agents/:id/issues', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { severity, limit = 50 } = req.query;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    let query = db.select()
      .from(hiveIssues)
      .where(eq(hiveIssues.agentId, agentId))
      .orderBy(desc(hiveIssues.detectedAt))
      .limit(Number(limit));

    if (severity && typeof severity === 'string') {
      query = query.where(and(eq(hiveIssues.agentId, agentId), eq(hiveIssues.severity, severity)));
    }

    const issues = await query;

    return res.json({ success: true, issues });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/agents/:id/commands', authMiddleware, requirePermission('hive', 'execute'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { commandType, command, parameters } = req.body;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { randomUUID } = require('crypto');
    const commandRecord = await db.insert(hiveCommands)
      .values({
        agentId,
        userId: userId!,
        commandType,
        command,
        parameters: parameters || {},
        status: 'pending',
        executedAt: new Date(),
        sessionId: randomUUID()
      })
      .returning();

    return res.json({ success: true, command: commandRecord[0] });
  } catch (error) {
    console.error('Error creating command:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// AI-powered chat interface for agent communication
router.post('/agents/:id/chat', authMiddleware, requirePermission('hive', 'execute'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { message, type = 'chat' } = req.body;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    console.log(`Chat request: agent=${agentId}, message="${message}", user=${userId}`);

    // Verify agent exists and user has access
    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { randomUUID } = require('crypto');
    const sessionId = randomUUID();

    // Gather comprehensive context about the agent and environment
    const hiveContext = await gatherHiveContext(agentId, organizationId!);

    // Get conversation history for this agent (last 20 messages)
    const conversationHistory = await db.select()
      .from(hiveCommands)
      .where(and(
        eq(hiveCommands.agentId, agentId),
        inArray(hiveCommands.commandType, ['chat_user', 'chat_ai'])
      ))
      .orderBy(desc(hiveCommands.executedAt))
      .limit(20);

    // Build messages for Claude with history
    const claudeMessages: any[] = [];
    
    // Add recent conversation history (in chronological order)
    const sortedHistory = conversationHistory.reverse();
    for (const historyMsg of sortedHistory) {
      claudeMessages.push({
        role: historyMsg.commandType === 'chat_user' ? 'user' : 'assistant',
        content: historyMsg.commandType === 'chat_user' ? historyMsg.command : historyMsg.response
      });
    }

    // Add current message
    claudeMessages.push({
      role: 'user',
      content: message
    });

    // Get Anthropic client
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'AI Assistant not configured',
        message: 'Please configure your Anthropic API key'
      });
    }

    // Build intelligent system prompt with context
    const systemPrompt = `You are Pulse, an intelligent AI assistant for Hive monitoring agents. You help users monitor, troubleshoot, and manage their systems.

Current Agent Context:
- Agent: ${hiveContext.agent?.name} (${hiveContext.agent?.hostname})
- Status: ${hiveContext.agent?.status}
- Platform: ${hiveContext.agent?.platform}
- Last Heartbeat: ${hiveContext.agent?.lastHeartbeat || 'Never'}

Organization Overview:
- Total Agents: ${hiveContext.statistics?.totalAgents || 0}
- Online Agents: ${hiveContext.statistics?.onlineAgents || 0}
- Offline Agents: ${hiveContext.statistics?.offlineAgents || 0}
- Recent Issues: ${hiveContext.statistics?.recentIssues || 0}

Recent Agent Activity:
${hiveContext.recentCommands?.length > 0 ? 
  hiveContext.recentCommands.map((cmd: any) => `- ${cmd.command} (${cmd.status})`).join('\n') :
  'No recent command history'
}

${hiveContext.recentIssues?.length > 0 ? 
  `Recent Issues:\n${hiveContext.recentIssues.map((issue: any) => `- ${issue.title} (${issue.severity})`).join('\n')}` :
  ''
}

Your capabilities:
1. Answer questions about system status, performance, and monitoring
2. Suggest and execute system commands when appropriate
3. Help troubleshoot issues based on agent context
4. Provide insights from telemetry and monitoring data
5. Explain system information in a user-friendly way

When users ask about system information:
- Be natural and conversational (no robotic responses)
- Use the agent context to provide relevant information
- Suggest appropriate commands when needed
- If you recommend running a command, clearly explain why

For command execution:
- Only suggest safe, read-only commands for system information
- Explain what each command will show
- Be helpful but security-conscious

Keep responses concise but informative. Be friendly and professional.`;

    // Call Claude API with proper context
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.7,
      system: systemPrompt,
      messages: claudeMessages,
    });

    let aiResponse = 'I apologize, but I encountered an issue generating a response. Please try again.';
    if (response.content && response.content[0] && response.content[0].type === 'text') {
      aiResponse = response.content[0].text;
    }

    // Store user message
    const userCommand = await db.insert(hiveCommands).values({
      agentId,
      command: message,
      commandType: 'chat_user',
      parameters: { type, session_id: sessionId },
      status: 'completed',
      executedAt: new Date(),
      response: message,
      userId: userId!,
      sessionId
    }).returning();

    // Store AI response  
    const aiCommand = await db.insert(hiveCommands).values({
      agentId,
      command: 'AI Response',
      commandType: 'chat_ai', 
      parameters: { type: 'ai_response', session_id: sessionId },
      status: 'completed',
      executedAt: new Date(),
      response: aiResponse,
      userId: userId!,
      sessionId
    }).returning();

    console.log(`User command stored: ${userCommand[0].id}, AI response stored: ${aiCommand[0].id}`);

    // Enhanced command detection for system queries
    const msgLower = message.trim().toLowerCase();
    
    // Check if this looks like a shell command (starts with common commands or contains paths)
    const shellCommandPatterns = [
      'ls', 'ps', 'whoami', 'pwd', 'date', 'uptime', 'df', 'free', 'top', 'uname', 'lscpu',
      'cat', 'echo', 'touch', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown', 'find', 'grep',
      'head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'sed', 'awk', 'which', 'whereis',
      'systemctl', 'service', 'ping', 'curl', 'wget', 'netstat', 'ss', 'ip', 'ifconfig',
      'du', 'id', 'groups', 'last', 'w', 'who', 'hostname', 'hostnamectl', 'timedatectl'
    ];
    
    const isDirectCommand = shellCommandPatterns.some(cmd => 
      msgLower.startsWith(cmd + ' ') || msgLower === cmd
    );
    
    // Check if message contains a path (starts with / or ~/)
    const containsPath = message.includes('~/') || message.includes('/');
    
    // Check if user wants to list files (natural language)
    const wantsFileList = msgLower.includes('list') && (msgLower.includes('file') || msgLower.includes('folder') || msgLower.includes('directory'));
    
    // Check if AI response suggests executing a command
    const shouldExecuteCommand = aiResponse.toLowerCase().includes('i\'ll run') || 
                                aiResponse.toLowerCase().includes('let me run') ||
                                aiResponse.toLowerCase().includes('i\'ll execute') ||
                                aiResponse.toLowerCase().includes('i will execute') ||
                                aiResponse.toLowerCase().includes('executing') ||
                                aiResponse.toLowerCase().includes('let me proceed') ||
                                aiResponse.toLowerCase().includes('let me show you') ||
                                aiResponse.toLowerCase().includes('i\'ll create') ||
                                aiResponse.toLowerCase().includes('i\'ll modify') ||
                                aiResponse.toLowerCase().includes('let me check') ||
                                wantsFileList ||
                                (msgLower.includes('show') || msgLower.includes('display') || msgLower.includes('what') || msgLower.includes('check')) &&
                                (msgLower.includes('cpu') || msgLower.includes('memory') || msgLower.includes('disk') || 
                                 msgLower.includes('process') || msgLower.includes('network') || msgLower.includes('uptime'));
    
    // Also extract commands mentioned in AI response
    const extractCommandFromAI = (aiText: string): string | null => {
      // Look for commands in backticks or code blocks
      const codeBlockMatch = aiText.match(/```[\s\S]*?\n(.*?)\n[\s\S]*?```/);
      if (codeBlockMatch) return codeBlockMatch[1].trim();
      
      const backtickMatch = aiText.match(/`([^`]+)`/);
      if (backtickMatch && shellCommandPatterns.some(cmd => 
        backtickMatch[1].toLowerCase().startsWith(cmd + ' ') || backtickMatch[1].toLowerCase() === cmd
      )) {
        return backtickMatch[1].trim();
      }
      
      // Look for "I'll run X" or "Let me run X" patterns
      const runMatch = aiText.match(/(?:i'll run|let me run|i'll execute|executing)\s+[`']?([^`'\n]+)[`']?/i);
      if (runMatch) return runMatch[1].trim();
      
      return null;
    };

    // Map natural language to appropriate commands (only for natural language requests)
    let suggestedCommand = '';
    if (shouldExecuteCommand && !isDirectCommand) {
      // First try to extract command from AI response
      const aiExtractedCommand = extractCommandFromAI(aiResponse);
      if (aiExtractedCommand) {
        suggestedCommand = aiExtractedCommand;
      }
      // Check for file listing requests
      else if (wantsFileList) {
        // Extract path from message if present
        const pathMatch = message.match(/\/[^\s]+/);
        const path = pathMatch ? pathMatch[0] : '/tmp';
        suggestedCommand = `ls -al ${path}`;
      } else if (msgLower.includes('cpu') || msgLower.includes('processor')) {
        suggestedCommand = 'uname -a && lscpu 2>/dev/null || uname -a';
      } else if (msgLower.includes('memory') || msgLower.includes('ram') || msgLower.includes('mem')) {
        suggestedCommand = 'free -h';
      } else if (msgLower.includes('disk') || msgLower.includes('storage') || msgLower.includes('space')) {
        suggestedCommand = 'df -h';
      } else if (msgLower.includes('process') || msgLower.includes('running')) {
        suggestedCommand = 'ps aux | head -10';
      } else if (msgLower.includes('network') || msgLower.includes('interface')) {
        suggestedCommand = 'ip addr show 2>/dev/null || ifconfig';
      } else if (msgLower.includes('uptime') || msgLower.includes('load')) {
        suggestedCommand = 'uptime';
      } else if (msgLower.includes('system') && msgLower.includes('info')) {
        suggestedCommand = 'uname -a && uptime';
      }
    }

    if (isDirectCommand || suggestedCommand) {
      const commandToExecute = suggestedCommand || message.trim();
      console.log(`Command will be executed: ${commandToExecute}`);
      
      // Queue command for execution
      const execCommand = await db.insert(hiveCommands).values({
        agentId,
        command: commandToExecute,
        commandType: 'execute',
        parameters: { 
          type: suggestedCommand ? 'ai_suggested_execute' : 'direct_execute',
          original_message: message,
          user_id: userId,
          session_id: sessionId
        },
        status: 'pending',
        executedAt: new Date(),
        userId: userId!,
        sessionId: sessionId
      }).returning();

      console.log(`Execute command queued: ${execCommand[0].id}`);

      // Wait for command result (poll with timeout)
      const commandResult = await waitForCommandResult(execCommand[0].id, 30000); // 30 second timeout
      
      if (commandResult && commandResult.response) {
        // Format the command output with the AI response
        const formattedResponse = `${aiResponse}\n\n**Command Output:**\n\`\`\`\n${commandResult.response}\n\`\`\``;
        
        return res.json({
          success: true,
          type: 'ai_execute',
          session_id: sessionId,
          command_id: execCommand[0].id,
          ai_response: formattedResponse,
          executing_command: commandToExecute,
          command_result: commandResult.response,
          auto_execute: true
        });
      } else {
        // Command didn't complete in time, return pending status
        return res.json({
          success: true,
          type: 'ai_execute',
          session_id: sessionId,
          command_id: execCommand[0].id,
          ai_response: aiResponse,
          executing_command: commandToExecute,
          status: 'pending',
          message: 'Command is being executed. Results will appear shortly.',
          auto_execute: true
        });
      }
    }

    // Just return the AI analysis
    return res.json({
      success: true,
      type: 'ai_analysis',
      session_id: sessionId,
      ai_response: aiResponse,
      suggestion: null
    });

  } catch (error) {
    console.error('Error in chat interface:', error);
    return res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

// Execute confirmed command (using HTTP polling system)
router.post('/agents/:id/execute', authMiddleware, requirePermission('hive', 'execute'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { command, session_id, command_id } = req.body;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { randomUUID } = require('crypto');
    const actualCommandId = command_id || randomUUID();

    // Create command record for the agent to poll
    const [commandRecord] = await db.insert(hiveCommands).values({
      agentId,
      command: command,
      commandType: 'execute',
      parameters: { 
        type: 'confirmed_execution', 
        user_id: userId || '',
        session_id: session_id || randomUUID() 
      },
      status: 'pending',
      executedAt: new Date(),
      userId: userId!,
      sessionId: session_id || randomUUID()
    }).returning();

    console.log(`Command queued for agent ${agent[0].name}: ${command}`);

    return res.json({ 
      success: true, 
      session_id: session_id,
      command_id: actualCommandId,
      message: 'Command queued for execution. The agent will process it shortly.',
      status: 'pending'
    });

  } catch (error) {
    console.error('Error executing command:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat history for an agent
router.get('/agents/:id/chat', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { limit = 50 } = req.query;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const chatHistory = await db.select()
      .from(hiveCommands)
      .where(and(
        eq(hiveCommands.agentId, agentId),
        inArray(hiveCommands.commandType, ['chat', 'chat_user', 'chat_ai', 'execute', 'user_input', 'ai_response'])
      ))
      .orderBy(desc(hiveCommands.executedAt))
      .limit(Number(limit));

    return res.json({ success: true, messages: chatHistory.reverse() });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Dynamic configuration management
router.get('/agents/:id/config', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const configs = await db.select()
      .from(hiveAgentConfigs)
      .where(eq(hiveAgentConfigs.agentId, agentId))
      .orderBy(desc(hiveAgentConfigs.createdAt));

    // Generate default config with correct server URL for UI
    const forwardedProto = req.get('x-forwarded-proto');
    const forwardedHost = req.get('x-forwarded-host');
    const host = forwardedHost || req.get('host') || 'localhost:5005';
    const isSecure = forwardedProto === 'https' || req.secure || req.get('x-forwarded-ssl') === 'on';
    const protocol = isSecure ? 'https' : 'http';
    const serverUrl = `${protocol}://${host}`;

    const defaultConfig = {
      server: {
        url: serverUrl,
        api_key: agent[0].apiKey,
        heartbeat_interval: '30s',
        reconnect_interval: '10s',
        max_reconnects: 3,
        timeout: '30s'
      },
      agent: {
        name: agent[0].name,
        hostname: agent[0].hostname,
        data_dir: '/var/lib/pulse-hive',
        buffer_size: 10000,
        batch_size: 1000,
        flush_interval: '10s',
        compress_data: true,
        enable_profiling: false,
        metrics_port: 8080,
        enable_self_monitoring: true
      },
      logging: {
        level: 'info',
        format: 'json',
        output: 'stdout'
      },
      collectors: {
        logs: {
          enabled: true,
          paths: [
            {
              path: '/var/log/system.log',
              tags: { source: 'system' }
            },
            {
              path: '/var/log/install.log', 
              tags: { source: 'install' }
            },
            {
              path: '/var/log/syslog',
              tags: { source: 'syslog' }
            },
            {
              path: '/var/log/auth.log',
              tags: { source: 'security' }
            }
          ],
          patterns: [
            {
              name: 'error_detection',
              pattern: '(?i)(error|failed|exception|critical)',
              severity: 'error',
              category: 'application'
            }
          ],
          parsers: {
            regex: {
              type: 'regex',
              pattern: '^(?P<timestamp>\\S+\\s+\\S+)\\s+(?P<host>\\S+)\\s+(?P<service>\\S+):\\s+(?P<message>.*)$'
            },
            json: {
              type: 'json'
            },
            syslog: {
              type: 'regex',
              pattern: '^(?P<timestamp>\\w+\\s+\\d+\\s+\\d+:\\d+:\\d+)\\s+(?P<host>\\S+)\\s+(?P<service>\\w+)(?:\\[(?P<pid>\\d+)\\])?:\\s+(?P<message>.*)$'
            }
          },
          scan_frequency: '10s',
          rotate_wait: '5s'
        },
        metrics: {
          enabled: true,
          interval: '60s',
          system: {
            cpu: true,
            memory: true,
            disk: true,
            network: true,
            process: true
          }
        },
        traces: {
          enabled: false
        },
        events: {
          enabled: false
        }
      },
      outputs: [
        {
          name: 'pulse_platform',
          type: 'http',
          enabled: true,
          url: `${serverUrl}/api/hive/telemetry`,
          auth: {
            type: 'bearer',
            token: agent[0].apiKey
          },
          batch_size: 1000,
          timeout: '30s',
          data_types: ['logs', 'metrics', 'traces', 'events'],
          retry: {
            max_retries: 3,
            initial_backoff: '5s',
            max_backoff: '60s',
            backoff_multiple: 2
          }
        },
        {
          name: 'openobserve',
          type: 'http',
          enabled: false,
          url: 'https://api.openobserve.ai/api/default/_json',
          batch_size: 1000,
          timeout: '30s',
          auth: {
            type: 'basic',
            username: 'user@example.com',
            password: 'your_password'
          },
          data_types: ['logs'],
          retry: {
            max_retries: 3,
            initial_backoff: '5s',
            max_backoff: '60s',
            backoff_multiple: 2
          }
        }
      ],
      healthcheck: {
        enabled: true,
        port: 8081,
        path: '/health',
        interval: '30s'
      }
    };

    return res.json({ 
      success: true, 
      configs, 
      agent: agent[0], 
      defaultConfig,
      detectedServerUrl: serverUrl 
    });
  } catch (error) {
    console.error('Error fetching agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/agents/:id/config', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { configName, config, enabled = true } = req.body;
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Auto-detect and set the correct server URL if not provided or if it's localhost
    if (!config.server) {
      config.server = {};
    }
    
    // Determine the correct host and protocol
    const forwardedProto = req.get('x-forwarded-proto');
    const forwardedHost = req.get('x-forwarded-host');
    const host = forwardedHost || req.get('host') || 'localhost:5005';
    const isSecure = forwardedProto === 'https' || req.secure || req.get('x-forwarded-ssl') === 'on';
    const protocol = isSecure ? 'https' : 'http';
    
    // Only override if not set or if it's localhost
    if (!config.server.url || config.server.url.includes('localhost') || config.server.url.includes('127.0.0.1')) {
      config.server.url = `${protocol}://${host}`;
      console.log(`🔧 Auto-detected server URL for hive agent: ${config.server.url}`);
    }

    // Create new config
    const newConfig = await db.insert(hiveAgentConfigs)
      .values({
        agentId,
        configType: 'general',
        configName,
        config,
        enabled
      })
      .returning();

    // Send config update to agent via HTTP polling command queue
    if (enabled) {
      const { randomUUID } = require('crypto');
      const configJson = JSON.stringify(config, null, 2);
      
      // Generate proper YAML configuration
      const generateYamlConfig = (config: any): string => {
        // Use detected protocol (HTTP or HTTPS) with detected host
        const detectedUrl = `${protocol}://${host}`;
        const serverUrl = config.server?.url || detectedUrl;
        return `# Pulse Hive Agent Configuration
# Deployed via Pulse Platform
server:
  url: ${serverUrl}
  api_key: ${config.server?.api_key || ''}
  heartbeat_interval: ${config.server?.heartbeat_interval || '30s'}
  reconnect_interval: ${config.server?.reconnect_interval || '10s'}
  max_reconnects: ${config.server?.max_reconnects || 3}
  timeout: ${config.server?.timeout || '30s'}

agent:
  name: ${config.agent?.name || 'agent'}
  hostname: ${config.agent?.hostname || 'localhost'}
  data_dir: ${config.agent?.data_dir || '/var/lib/pulse-hive'}
  buffer_size: ${config.agent?.buffer_size || 10000}
  batch_size: ${config.agent?.batch_size || 1000}
  flush_interval: ${config.agent?.flush_interval || '10s'}
  compress_data: ${config.agent?.compress_data !== false}
  enable_profiling: ${config.agent?.enable_profiling || false}
  metrics_port: ${config.agent?.metrics_port || 8080}
  enable_self_monitoring: ${config.agent?.enable_self_monitoring !== false}

logging:
  level: ${config.logging?.level || 'info'}
  format: ${config.logging?.format || 'json'}
  output: ${config.logging?.output || 'stdout'}

collectors:
  logs:
    enabled: ${config.collectors?.logs?.enabled !== false}
    paths:${config.collectors?.logs?.paths ? config.collectors.logs.paths.map((p: any) => `
      - path: ${typeof p === 'string' ? p : p.path}`).join('') : `
      - path: /var/log/*.log`}
    scan_frequency: 10s
    rotate_wait: 5s
  metrics:
    enabled: ${config.collectors?.metrics?.enabled !== false}
    interval: ${config.collectors?.metrics?.interval || '60s'}
    system:
      cpu: true
      memory: true
      disk: true
      network: true
      process: true
  traces:
    enabled: ${config.collectors?.traces?.enabled || false}
  events:
    enabled: ${config.collectors?.events?.enabled || false}

outputs:${config.outputs ? config.outputs.map((output: any) => {
  let authSection = '';
  if (output.auth) {
    if (output.auth.type === 'basic' && output.auth.username && output.auth.password) {
      authSection = `
    auth:
      type: basic
      username: ${output.auth.username}
      password: ${output.auth.password}`;
    } else if (output.auth.type === 'bearer' || output.auth.token) {
      authSection = `
    auth:
      type: bearer
      token: ${output.auth.token || config.server?.api_key || ''}`;
    } else {
      authSection = `
    auth:
      type: ${output.auth.type || 'bearer'}
      token: ${output.auth.token || config.server?.api_key || ''}`;
    }
  }
  
  return `
  - name: ${output.name || 'pulse_platform'}
    type: ${output.type || 'http'}
    enabled: ${output.enabled !== false}
    url: ${output.url || `${serverUrl}/api/hive/telemetry`}
    batch_size: ${output.batch_size || 1000}
    timeout: ${output.timeout || '30s'}${authSection}`;
}).join('') : `
  - name: pulse_platform
    type: http
    enabled: true
    url: ${serverUrl}/api/hive/telemetry
    batch_size: 1000
    timeout: 30s
    retry:
      max_retries: 3
      initial_backoff: 5s
      max_backoff: 60s
      backoff_multiple: 2.0
    data_types: ["logs", "metrics", "traces", "events"]
    auth:
      type: bearer
      token: ${config.server?.api_key || ''}
  - name: openobserve
    type: http
    enabled: false
    url: https://api.openobserve.ai/api/default/_json
    batch_size: 1000
    timeout: 30s
    retry:
      max_retries: 3
      initial_backoff: 5s
      max_backoff: 60s
      backoff_multiple: 2.0
    data_types: ["logs", "metrics"]
    auth:
      type: basic
      username: user@example.com
      password: your_password
  - name: custom_endpoint
    type: http
    enabled: false
    url: https://your-custom-endpoint.com/api/telemetry
    batch_size: 500
    timeout: 15s
    retry:
      max_retries: 3
      initial_backoff: 5s
      max_backoff: 60s
      backoff_multiple: 2.0
    data_types: ["logs"]
    auth:
      type: bearer
      token: your_token`}

healthcheck:
  enabled: ${config.healthcheck?.enabled !== false}
  port: ${config.healthcheck?.port || 8081}
  path: ${config.healthcheck?.path || '/health'}
  interval: ${config.healthcheck?.interval || '30s'}`;
      };

      // Handle YAML content from UI
      let yamlConfig: string;
      if (config.yaml_content) {
        // Direct YAML content from UI
        yamlConfig = config.yaml_content;
      } else {
        // Generate YAML from JSON config
        yamlConfig = generateYamlConfig(config);
      }
      
      // Create deployment command to write YAML config to agent's config file
      const tempFile = `/tmp/pulse-hive-config-${Date.now()}.yaml`;
      const configPath = '/etc/pulse-hive/config.yaml';
      const escapedYaml = yamlConfig.replace(/'/g, "'\\''");
      
      const writeConfigCommand = `mkdir -p "/etc/pulse-hive" && echo '${escapedYaml}' > "${configPath}" && chmod 644 "${configPath}" && echo "Configuration deployed to ${configPath}" && ls -la "${configPath}"`;

      // Queue the command for the agent to poll using 'execute' type
      const deployCommand = await db.insert(hiveCommands).values({
        agentId,
        command: writeConfigCommand,
        commandType: 'execute',
        parameters: { 
          config_id: newConfig[0].id,
          timeout: 60000 // 1 minute timeout
        },
        status: 'pending',
        executedAt: new Date(),
        userId: userId!,
        sessionId: randomUUID()
      }).returning();

      console.log(`Config deployment queued for agent ${agent[0].name}`);
      
      // Return with deployment command ID so frontend can track progress
      return res.json({ 
        success: true, 
        config: newConfig[0],
        deployment_command_id: deployCommand[0].id,
        message: 'Configuration queued for deployment. Verification in progress...'
      });
    } else {
      return res.json({ success: true, config: newConfig[0] });
    }
  } catch (error) {
    console.error('Error creating agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/agents/:id/config/:configId', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId, configId } = req.params;
    const { config, enabled } = req.body;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const updatedConfig = await db.update(hiveAgentConfigs)
      .set({
        config,
        enabled,
        updatedAt: new Date()
      })
      .where(and(
        eq(hiveAgentConfigs.id, configId),
        eq(hiveAgentConfigs.agentId, agentId)
      ))
      .returning();

    if (updatedConfig.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Config updates are handled via HTTP polling - no WebSocket needed

    return res.json({ success: true, config: updatedConfig[0] });
  } catch (error) {
    console.error('Error updating agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/agents/:id/config/:configId', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId, configId } = req.params;
    const organizationId = req.user?.organizationId;

    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const deletedConfig = await db.delete(hiveAgentConfigs)
      .where(and(
        eq(hiveAgentConfigs.id, configId),
        eq(hiveAgentConfigs.agentId, agentId)
      ))
      .returning();

    if (deletedConfig.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/output-endpoints', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    const endpoints = await db.select()
      .from(hiveOutputEndpoints)
      .where(eq(hiveOutputEndpoints.organizationId, organizationId!))
      .orderBy(desc(hiveOutputEndpoints.createdAt));

    return res.json({ success: true, endpoints });
  } catch (error) {
    console.error('Error fetching output endpoints:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/output-endpoints', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, endpointUrl, authType, authConfig, headers, batchSize, flushIntervalSeconds } = req.body;
    const organizationId = req.user?.organizationId;

    const endpoint = await db.insert(hiveOutputEndpoints)
      .values({
        organizationId: organizationId!,
        name,
        type,
        endpointUrl,
        authType,
        authConfig: authConfig || {},
        headers: headers || {},
        batchSize: batchSize || 1000,
        flushIntervalSeconds: flushIntervalSeconds || 10
      })
      .returning();

    return res.json({ success: true, endpoint: endpoint[0] });
  } catch (error) {
    console.error('Error creating output endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/install', async (req: Request, res: Response) => {
  try {
    // Determine the correct host and protocol for the script
    let pulseHost = req.get('host') || 'localhost:5005';
    
    // Determine protocol - use HTTPS if X-Forwarded-Proto is https, otherwise detect from request
    const forwardedProto = req.get('x-forwarded-proto');
    const isSecure = forwardedProto === 'https' || req.secure || req.get('x-forwarded-ssl') === 'on';
    const protocol = isSecure ? 'https' : 'http';
    
    // If the host is the Docker internal hostname, use localhost instead
    if (pulseHost === 'api:5005' || pulseHost.startsWith('api:')) {
      pulseHost = 'localhost:5005';
    }
    
    // Handle X-Forwarded-Host header for reverse proxies
    const forwardedHost = req.get('x-forwarded-host');
    if (forwardedHost) {
      pulseHost = forwardedHost;
    }

    const installScript = `#!/bin/bash
set -e

# Hive Agent Installation Script
# Generated by Pulse Platform

API_KEY=""
PULSE_URL="${pulseHost}"
PROTOCOL="${protocol}"
INSTALL_DIR="/opt/hive-agent"
SERVICE_NAME="hive-agent"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key=*)
      API_KEY="\${1#*=}"
      shift
      ;;
    --api-key)
      API_KEY="$2"
      shift 2
      ;;
    --pulse-url=*)
      CUSTOM_PULSE_URL="\${1#*=}"
      shift
      ;;
    --pulse-url)
      CUSTOM_PULSE_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Use custom Pulse URL if provided, otherwise use detected values
if [[ -n "$CUSTOM_PULSE_URL" ]]; then
  # Parse the custom URL to extract protocol and host
  if [[ "$CUSTOM_PULSE_URL" =~ ^https:// ]]; then
    PROTOCOL="https"
    PULSE_URL="\${CUSTOM_PULSE_URL#https://}"
  elif [[ "$CUSTOM_PULSE_URL" =~ ^http:// ]]; then
    PROTOCOL="http"
    PULSE_URL="\${CUSTOM_PULSE_URL#http://}"
  else
    # Assume https if no protocol specified
    PROTOCOL="https"
    PULSE_URL="$CUSTOM_PULSE_URL"
  fi
fi

if [[ -z "$API_KEY" ]]; then
  echo "Error: API key is required. Use --api-key=YOUR_KEY"
  exit 1
fi

echo "🐝 Installing Hive Agent..."
echo "   API Key: \${API_KEY:0:10}..."
echo "   Pulse URL: $PULSE_URL"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case $ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Create installation directory
mkdir -p $INSTALL_DIR

# Download Hive Agent binary
BINARY_URL="$PROTOCOL://$PULSE_URL/api/hive/download/hive-agent-$OS-$ARCH"
echo "Downloading Hive Agent..."

# Download and check if we got a binary or error message
curl -L -o "$INSTALL_DIR/hive-agent.tmp" "$BINARY_URL" 2>/dev/null

# Check if the download is actually JSON (error message)
if head -c 1 "$INSTALL_DIR/hive-agent.tmp" | grep -q '{'; then
  echo "⚠️  Agent binary not available yet. Creating placeholder..."
  
  # Create a placeholder script that will inform the user
  cat > "$INSTALL_DIR/hive-agent" << 'PLACEHOLDER'
#!/bin/bash
echo "🐝 Pulse Hive Agent - Placeholder"
echo "The actual agent binary is still being built."
echo "Please check back later or build from source:"
echo "  https://github.com/pulse-platform/hive-agent"
echo ""
echo "This placeholder will be replaced once the binary is available."
exit 1
PLACEHOLDER
  
  chmod +x "$INSTALL_DIR/hive-agent"
  rm -f "$INSTALL_DIR/hive-agent.tmp"
  
  echo "⚠️  Note: Agent binary not yet available. Placeholder installed."
else
  # Valid binary downloaded
  mv "$INSTALL_DIR/hive-agent.tmp" "$INSTALL_DIR/hive-agent"
  chmod +x "$INSTALL_DIR/hive-agent"
  echo "✓ Agent binary downloaded successfully"
fi

# Create configuration directory and file
sudo mkdir -p "/etc/pulse-hive" 
sudo tee "/etc/pulse-hive/config.yaml" << EOF
# Pulse Hive Agent Configuration
server:
  url: "https://$PULSE_URL"
  api_key: "$API_KEY"
  heartbeat_interval: 30s
  reconnect_interval: 10s
  max_reconnects: 3
  timeout: 30s

agent:
  name: "$(hostname)-hive-agent"
  hostname: "$(hostname -f)"
  data_dir: "/tmp/pulse-hive"
  buffer_size: 10000
  batch_size: 1000
  flush_interval: 10s
  compress_data: true
  enable_profiling: false
  metrics_port: 8080
  enable_self_monitoring: true

logging:
  level: "info"
  format: "json"
  output: "stdout"

collectors:
  logs:
    enabled: false
  metrics:
    enabled: true
    interval: 60s
    system:
      cpu: true
      memory: true
      disk: true
      network: true
      process: true
  traces:
    enabled: false
  events:
    enabled: false

outputs:
  - name: "pulse_platform"
    type: "http"
    enabled: true
    url: "https://$PULSE_URL/api/hive/telemetry"
    auth:
      type: "bearer"
      token: "$API_KEY"
    batch_size: 1000
    timeout: 30s
    retry:
      max_retries: 3
      initial_backoff: 5s
      max_backoff: 60s
      backoff_multiple: 2.0
    data_types: ["logs", "metrics", "traces", "events"]

healthcheck:
  enabled: true
  port: 8081
  path: "/health"
  interval: 30s
EOF

# Detect OS and install service accordingly
OS_TYPE=$(uname -s)

if [[ "$OS_TYPE" == "Darwin" ]]; then
  # macOS - Create launchd plist
  echo "📱 Detected macOS - Creating launchd service..."
  
  PLIST_FILE="/Library/LaunchDaemons/com.pulse.hive-agent.plist"
  
  cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.hive-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/hive-agent</string>
        <string>--config</string>
        <string>/etc/pulse-hive/config.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/hive-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/hive-agent.error.log</string>
</dict>
</plist>
EOF

  # Load the service
  launchctl load -w "$PLIST_FILE"
  
  echo "✅ Hive Agent installed successfully on macOS!"
  echo "   Status: launchctl list | grep com.pulse.hive-agent"
  echo "   Logs:   tail -f /var/log/hive-agent.log"
  echo "   Stop:   sudo launchctl unload $PLIST_FILE"
  echo "   Start:  sudo launchctl load $PLIST_FILE"
  
elif [[ "$OS_TYPE" == "Linux" ]]; then
  # Linux - Create systemd service
  echo "🐧 Detected Linux - Creating systemd service..."
  
  cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=Hive Agent - Distributed Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
ExecStart=$INSTALL_DIR/hive-agent --config /etc/pulse-hive/config.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hive-agent

[Install]
WantedBy=multi-user.target
EOF

  # Enable and start service
  systemctl daemon-reload
  systemctl enable $SERVICE_NAME
  systemctl start $SERVICE_NAME

  echo "✅ Hive Agent installed successfully on Linux!"
  echo "   Status: systemctl status $SERVICE_NAME"
  echo "   Logs:   journalctl -u $SERVICE_NAME -f"
  echo "   Stop:   sudo systemctl stop $SERVICE_NAME"
  echo "   Start:  sudo systemctl start $SERVICE_NAME"
  
else
  echo "⚠️  Unsupported operating system: $OS_TYPE"
  echo "   Manual setup required."
  echo "   Binary installed at: $INSTALL_DIR/hive-agent"
  echo "   Config file at: /etc/pulse-hive/config.yaml"
fi

echo ""
echo "   Config: /etc/pulse-hive/config.yaml"
echo ""
echo "The agent should appear in your Pulse dashboard within 30 seconds."`;

    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', 'attachment; filename="install-hive-agent.sh"');
    return res.send(installScript);
  } catch (error) {
    console.error('Error generating install script:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/download/hive-agent-:platform-:arch', async (req: Request, res: Response) => {
  try {
    const { platform, arch } = req.params;
    
    // Map platform/arch to binary filename
    let binaryFilename: string;
    if (platform === 'windows') {
      binaryFilename = `hive-agent-${platform}-${arch}.exe`;
    } else {
      binaryFilename = `hive-agent-${platform}-${arch}`;
    }
    
    // Check if we have the compiled binary available in public directory
    const path = require('path');
    const fs = require('fs');
    const binaryPath = path.join('/app/apps/api/public', binaryFilename);
    
    try {
      const stats = fs.statSync(binaryPath);
      
      if (stats.isFile() && stats.size > 1000) { // Ensure it's a real binary, not just a tiny file
        console.log(`✅ Serving ${platform}/${arch} binary: ${binaryFilename} (${stats.size} bytes)`);
        
        // Send the platform-specific binary file
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="hive-agent"`);
        res.setHeader('X-Binary-Platform', platform);
        res.setHeader('X-Binary-Architecture', arch);
        return res.sendFile(binaryPath);
      } else {
        console.log(`❌ Binary too small or not found: ${binaryPath} (${stats?.size || 0} bytes)`);
      }
    } catch (err) {
      console.log(`❌ Binary not found: ${binaryPath}`);
    }
    
    // Try fallback to generic binary (for backward compatibility)
    const fallbackPath = path.join('/app/apps/api/public', 'hive-agent-binary');
    try {
      const stats = fs.statSync(fallbackPath);
      if (stats.isFile() && stats.size > 1000) {
        console.log(`⚠️ Using fallback binary for ${platform}/${arch}: hive-agent-binary`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="hive-agent"`);
        res.setHeader('X-Binary-Platform', 'fallback');
        res.setHeader('X-Binary-Architecture', 'unknown');
        return res.sendFile(fallbackPath);
      }
    } catch (err) {
      console.log('❌ Fallback binary also not found');
    }
    
    // List available binaries for debugging
    try {
      const publicDir = '/app/apps/api/public';
      const files = fs.readdirSync(publicDir).filter((f: string) => f.startsWith('hive-agent'));
      console.log(`Available hive agent binaries: ${files.join(', ')}`);
    } catch (err) {
      console.log('Could not list public directory files');
    }
    
    // No binary found - return error
    return res.status(404).json({ 
      error: 'Binary not available', 
      message: `Hive agent binary for ${platform}/${arch} is not available. Please check back soon or contact support.`,
      platform,
      arch,
      requestedFile: binaryFilename
    });
  } catch (error) {
    console.error('Error downloading agent binary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a separate router for public endpoints
export const hivePublicRoutes = express.Router();

// Agent registration endpoint - completely public, no auth required
hivePublicRoutes.post('/register', async (req: Request, res: Response) => {
  try {
    // Extract API key from body or header
    let apiKey = req.body.api_key || req.body.apiKey;
    
    if (!apiKey) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required in body or header' });
    }
    
    if (!apiKey.startsWith('hive_')) {
      return res.status(400).json({ error: 'Invalid API key format - must start with hive_' });
    }

    const { 
      name, 
      hostname, 
      ip_address, 
      os_type, 
      os_version, 
      arch, 
      version, 
      capabilities, 
      system_info, 
      metadata 
    } = req.body;

    // Find existing agent by API key
    const existingAgent = await db.select()
      .from(hiveAgents)
      .where(eq(hiveAgents.apiKey, apiKey))
      .limit(1);

    if (existingAgent.length > 0) {
      // Update existing agent
      const agent = await db.update(hiveAgents)
        .set({
          name: name || existingAgent[0].name,
          hostname: hostname || existingAgent[0].hostname,
          ipAddress: ip_address || existingAgent[0].ipAddress,
          osType: os_type || existingAgent[0].osType,
          osVersion: os_version || existingAgent[0].osVersion,
          arch: arch || existingAgent[0].arch,
          version: version || existingAgent[0].version,
          capabilities: capabilities || existingAgent[0].capabilities,
          systemInfo: system_info || existingAgent[0].systemInfo,
          metadata: { ...(existingAgent[0].metadata || {}), ...(metadata || {}) },
          status: 'online',
          lastHeartbeat: new Date(),
          updatedAt: new Date()
        })
        .where(eq(hiveAgents.id, existingAgent[0].id))
        .returning();

      return res.json({ 
        success: true, 
        message: 'Agent updated successfully',
        agent: agent[0]
      });
    }

    // Auto-create agent if it doesn't exist - use default organization for auto-registered agents
    // In production, this should be linked to a specific organization or require pre-registration
    const defaultOrgId = '1'; // TODO: Replace with proper organization detection
    
    try {
      const newAgent = await db.insert(hiveAgents)
        .values({
          organizationId: defaultOrgId,
          apiKey,
          name: name || hostname || 'Unknown Agent',
          hostname: hostname || 'unknown',
          ipAddress: ip_address,
          osType: os_type,
          osVersion: os_version,
          arch: arch,
          version: version,
          capabilities: capabilities || [],
          systemInfo: system_info || {},
          metadata: metadata || {},
          status: 'online',
          lastHeartbeat: new Date()
        })
        .returning();

      return res.json({ 
        success: true, 
        message: 'Agent registered successfully',
        agent: newAgent[0]
      });
    } catch (insertError) {
      console.error('Error creating new agent:', insertError);
      return res.status(500).json({ error: 'Failed to register agent' });
    }
  } catch (error) {
    console.error('Error registering agent:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent heartbeat endpoint - moved to public routes
hivePublicRoutes.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    // Extract API key from body or header  
    let apiKey = req.body.api_key || req.body.apiKey;
    
    if (!apiKey) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required in body or header' });
    }
    
    if (!apiKey.startsWith('hive_')) {
      return res.status(400).json({ error: 'Invalid API key format - must start with hive_' });
    }

    const { status, system_info, metrics, timestamp } = req.body;

    // Find agent by API key
    const agent = await db.select()
      .from(hiveAgents)
      .where(eq(hiveAgents.apiKey, apiKey))
      .limit(1);

    if (agent.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const agentData = agent[0];

    // Normalize status - map 'running' to 'online' 
    const normalizedStatus = status === 'running' ? 'online' : (status || 'online');
    
    // Update agent with heartbeat data
    await db.update(hiveAgents)
      .set({
        status: normalizedStatus,
        lastHeartbeat: new Date(timestamp || Date.now()),
        systemInfo: system_info || agentData.systemInfo,
        metadata: { 
          ...(agentData.metadata || {}), 
          metrics: metrics || {},
          last_heartbeat_timestamp: new Date().toISOString()
        },
        updatedAt: new Date()
      })
      .where(eq(hiveAgents.id, agentData.id));

    return res.json({ 
      success: true, 
      message: 'Heartbeat received',
      timestamp: new Date().toISOString(),
      next_heartbeat: new Date(Date.now() + 30000).toISOString() // 30 seconds
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch telemetry endpoint for agent data (matches Golang agent BatchData format) - moved to public routes
hivePublicRoutes.post('/telemetry', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const apiKey = authHeader.substring(7);
    
    if (!apiKey.startsWith('hive_')) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }

    // Find agent by API key
    const agent = await db.select()
      .from(hiveAgents)
      .where(eq(hiveAgents.apiKey, apiKey))
      .limit(1);

    if (agent.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const agentData = agent[0];

    // Update agent last heartbeat and status
    await db.update(hiveAgents)
      .set({
        status: 'online',
        lastHeartbeat: new Date(),
        updatedAt: new Date()
      })
      .where(eq(hiveAgents.id, agentData.id));

    // Process batch data
    const batch = req.body;
    const telemetryEntries = [];
    const issueEntries = [];

    if (batch.items && Array.isArray(batch.items)) {
      for (const item of batch.items) {
        if (item.type === 'log' || item.type === 'metric' || item.type === 'trace' || item.type === 'event') {
          // Check if this is issue data (detected by log collector)
          if (item.data && item.data.issue) {
            const issue = item.data.issue;
            issueEntries.push({
              agentId: agentData.id,
              severity: issue.severity,
              category: issue.category || 'application',
              title: issue.title,
              description: issue.description,
              errorPattern: issue.pattern,
              context: issue.context || {},
              suggestedFix: issue.suggested_fix,
              autoFixable: issue.auto_fixable || false,
              detectedAt: new Date(issue.timestamp)
            });
          }

          // AUTOMATIC ERROR DETECTION - Check for error keywords in log messages
          if (item.type === 'log' && item.data && item.data.message) {
            const message = item.data.message.toString().toLowerCase();
            const originalMessage = item.data.message.toString();
            
            // Error patterns to detect
            const errorPatterns = [
              { keywords: ['critical', 'fatal', 'emergency'], severity: 'critical' },
              { keywords: ['error', 'failed', 'failure', 'exception', 'crash'], severity: 'error' }
            ];

            for (const pattern of errorPatterns) {
              const hasError = pattern.keywords.some(keyword => message.includes(keyword));
              
              if (hasError) {
                // Check if there are continuous errors in the last 30 seconds for this agent
                const thirtySecondsAgo = new Date(Date.now() - 30000);
                
                // Count recent error logs for this agent
                const recentErrorLogs = await db.select()
                  .from(hiveTelemetry)
                  .where(
                    and(
                      eq(hiveTelemetry.agentId, agentData.id),
                      eq(hiveTelemetry.type, 'log'),
                      gte(hiveTelemetry.timestamp, thirtySecondsAgo)
                    )
                  );
                
                // Count how many of these recent logs contain errors
                const errorCount = recentErrorLogs.filter(log => {
                  if (log.data && typeof log.data === 'object' && 'message' in log.data) {
                    const logMessage = String(log.data.message).toLowerCase();
                    return errorPatterns.some(p => p.keywords.some(k => logMessage.includes(k)));
                  }
                  return false;
                }).length;
                
                // Only create issue if there are multiple errors (continuous) AND no existing active issue
                if (errorCount >= 2) {
                  // Check if there's already an active issue for this agent
                  const existingIssue = await db.select()
                    .from(hiveIssues)
                    .where(
                      and(
                        eq(hiveIssues.agentId, agentData.id),
                        isNull(hiveIssues.resolvedAt)
                      )
                    )
                    .limit(1);
                  
                  // Only create new issue if none exists
                  if (existingIssue.length === 0) {
                    // Determine category from source or message content
                    let category = item.source || 'application';
                    if (message.includes('database') || message.includes('mysql') || message.includes('postgres')) {
                      category = 'database';
                    } else if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
                      category = 'network';
                    } else if (message.includes('memory') || message.includes('disk') || message.includes('cpu')) {
                      category = 'performance';
                    } else if (message.includes('security') || message.includes('auth') || message.includes('login')) {
                      category = 'security';
                    }

                    // Create single issue for this agent
                    issueEntries.push({
                      agentId: agentData.id,
                      severity: pattern.severity,
                      category: category,
                      title: `Multiple ${pattern.severity} errors detected on agent`,
                      description: `Detected ${errorCount} continuous errors in the last 30 seconds. Latest: ${originalMessage}`,
                      errorPattern: pattern.keywords.join('|'),
                      context: {
                        error_count: errorCount,
                        time_window: '30 seconds',
                        source: item.source || 'unknown',
                        latest_error: originalMessage,
                        detected_at: item.timestamp || new Date().toISOString()
                      },
                      suggestedFix: null,
                      autoFixable: false,
                      detectedAt: new Date(item.timestamp || Date.now())
                    });

                    console.log(`🚨 Active issue created for agent ${agentData.id}: ${errorCount} continuous ${pattern.severity} errors`);
                  }
                }
                break; // Only check one pattern per log entry
              }
            }
          }

          telemetryEntries.push({
            agentId: agentData.id,
            type: item.type,
            source: item.source,
            data: item.data,
            timestamp: new Date(item.timestamp || Date.now())
          });
        }
      }
    }

    // Insert telemetry data
    if (telemetryEntries.length > 0) {
      await db.insert(hiveTelemetry).values(telemetryEntries);
    }

    // Insert issues
    if (issueEntries.length > 0) {
      await db.insert(hiveIssues).values(issueEntries);
    }

    return res.json({ 
      success: true, 
      inserted: telemetryEntries.length,
      issues_detected: issueEntries.length,
      batch_id: batch.batch_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing batch telemetry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

hivePublicRoutes.get('/install', async (req: Request, res: Response) => {
  try {
    // Determine the correct host and protocol for the script
    let pulseHost = req.get('host') || 'localhost:5005';
    
    // Determine protocol - use HTTPS if X-Forwarded-Proto is https, otherwise detect from request
    const forwardedProto = req.get('x-forwarded-proto');
    const isSecure = forwardedProto === 'https' || req.secure || req.get('x-forwarded-ssl') === 'on';
    const protocol = isSecure ? 'https' : 'http';
    
    // If the host is the Docker internal hostname, use localhost instead
    if (pulseHost === 'api:5005' || pulseHost.startsWith('api:')) {
      pulseHost = 'localhost:5005';
    }
    
    // Handle X-Forwarded-Host header for reverse proxies
    const forwardedHost = req.get('x-forwarded-host');
    if (forwardedHost) {
      pulseHost = forwardedHost;
    }

    const installScript = `#!/bin/bash
set -e

# Hive Agent Installation Script
# Generated by Pulse Platform

API_KEY=""
PULSE_URL="${pulseHost}"
PROTOCOL="${protocol}"
INSTALL_DIR="/opt/hive-agent"
SERVICE_NAME="hive-agent"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key=*)
      API_KEY="\${1#*=}"
      shift
      ;;
    --api-key)
      API_KEY="$2"
      shift 2
      ;;
    --pulse-url=*)
      CUSTOM_PULSE_URL="\${1#*=}"
      shift
      ;;
    --pulse-url)
      CUSTOM_PULSE_URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Use custom Pulse URL if provided, otherwise use detected values
if [[ -n "$CUSTOM_PULSE_URL" ]]; then
  # Parse the custom URL to extract protocol and host
  if [[ "$CUSTOM_PULSE_URL" =~ ^https:// ]]; then
    PROTOCOL="https"
    PULSE_URL="\${CUSTOM_PULSE_URL#https://}"
  elif [[ "$CUSTOM_PULSE_URL" =~ ^http:// ]]; then
    PROTOCOL="http"
    PULSE_URL="\${CUSTOM_PULSE_URL#http://}"
  else
    # Assume https if no protocol specified
    PROTOCOL="https"
    PULSE_URL="$CUSTOM_PULSE_URL"
  fi
fi

if [[ -z "$API_KEY" ]]; then
  echo "Error: API key is required. Use --api-key=YOUR_KEY"
  exit 1
fi

echo "🐝 Installing Hive Agent..."
echo "   API Key: \${API_KEY:0:10}..."
echo "   Pulse URL: $PULSE_URL"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case $ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Create installation directory
mkdir -p $INSTALL_DIR

# Download Hive Agent binary
BINARY_URL="$PROTOCOL://$PULSE_URL/api/hive/download/hive-agent-$OS-$ARCH"
echo "Downloading Hive Agent..."

# Download and check if we got a binary or error message
curl -L -o "$INSTALL_DIR/hive-agent.tmp" "$BINARY_URL" 2>/dev/null

# Check if the download is actually JSON (error message)
if head -c 1 "$INSTALL_DIR/hive-agent.tmp" | grep -q '{'; then
  echo "⚠️  Agent binary not available yet. Creating placeholder..."
  
  # Create a placeholder script that will inform the user
  cat > "$INSTALL_DIR/hive-agent" << 'PLACEHOLDER'
#!/bin/bash
echo "🐝 Pulse Hive Agent - Placeholder"
echo "The actual agent binary is still being built."
echo "Please check back later or build from source:"
echo "  https://github.com/pulse-platform/hive-agent"
echo ""
echo "This placeholder will be replaced once the binary is available."
exit 1
PLACEHOLDER
  
  chmod +x "$INSTALL_DIR/hive-agent"
  rm -f "$INSTALL_DIR/hive-agent.tmp"
  
  echo "⚠️  Note: Agent binary not yet available. Placeholder installed."
else
  # Valid binary downloaded
  mv "$INSTALL_DIR/hive-agent.tmp" "$INSTALL_DIR/hive-agent"
  chmod +x "$INSTALL_DIR/hive-agent"
  echo "✓ Agent binary downloaded successfully"
fi

# Create configuration directory and file
sudo mkdir -p "/etc/pulse-hive" 
sudo tee "/etc/pulse-hive/config.yaml" << EOF
# Pulse Hive Agent Configuration
server:
  url: "http://$PULSE_URL"
  api_key: "$API_KEY"
  heartbeat_interval: 30s
  reconnect_interval: 10s
  max_reconnects: 3
  timeout: 30s

agent:
  name: "$(hostname)-hive-agent"
  hostname: "$(hostname -f)"
  data_dir: "/tmp/pulse-hive"
  buffer_size: 10000
  batch_size: 1000
  flush_interval: 10s
  compress_data: true
  enable_profiling: false
  metrics_port: 8080
  enable_self_monitoring: true

logging:
  level: "info"
  format: "json"
  output: "stdout"

collectors:
  logs:
    enabled: false
  metrics:
    enabled: true
    interval: 60s
    system:
      cpu: true
      memory: true
      disk: true
      network: true
      process: true
  traces:
    enabled: false
  events:
    enabled: false

outputs:
  - name: "pulse_platform"
    type: "http"
    enabled: true
    url: "http://$PULSE_URL/api/hive/telemetry"
    auth:
      type: "bearer"
      token: "$API_KEY"
    batch_size: 1000
    timeout: 30s
    retry:
      max_retries: 3
      initial_backoff: 5s
      max_backoff: 60s
      backoff_multiple: 2.0
    data_types: ["logs", "metrics", "traces", "events"]

healthcheck:
  enabled: true
  port: 8081
  path: "/health"
  interval: 30s
EOF

# Detect OS and install service accordingly
OS_TYPE=$(uname -s)

if [[ "$OS_TYPE" == "Darwin" ]]; then
  # macOS - Create launchd plist
  echo "📱 Detected macOS - Creating launchd service..."
  
  PLIST_FILE="/Library/LaunchDaemons/com.pulse.hive-agent.plist"
  
  cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pulse.hive-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/hive-agent</string>
        <string>--config</string>
        <string>/etc/pulse-hive/config.yaml</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/hive-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/hive-agent.error.log</string>
</dict>
</plist>
EOF

  # Load the service
  launchctl load -w "$PLIST_FILE"
  
  echo "✅ Hive Agent installed successfully on macOS!"
  echo "   Status: launchctl list | grep com.pulse.hive-agent"
  echo "   Logs:   tail -f /var/log/hive-agent.log"
  echo "   Stop:   sudo launchctl unload $PLIST_FILE"
  echo "   Start:  sudo launchctl load $PLIST_FILE"
  
elif [[ "$OS_TYPE" == "Linux" ]]; then
  # Linux - Create systemd service
  echo "🐧 Detected Linux - Creating systemd service..."
  
  cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=Hive Agent - Distributed Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
ExecStart=$INSTALL_DIR/hive-agent --config /etc/pulse-hive/config.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hive-agent

[Install]
WantedBy=multi-user.target
EOF

  # Enable and start service
  systemctl daemon-reload
  systemctl enable $SERVICE_NAME
  systemctl start $SERVICE_NAME

  echo "✅ Hive Agent installed successfully on Linux!"
  echo "   Status: systemctl status $SERVICE_NAME"
  echo "   Logs:   journalctl -u $SERVICE_NAME -f"
  echo "   Stop:   sudo systemctl stop $SERVICE_NAME"
  echo "   Start:  sudo systemctl start $SERVICE_NAME"
  
else
  echo "⚠️  Unsupported operating system: $OS_TYPE"
  echo "   Manual setup required."
  echo "   Binary installed at: $INSTALL_DIR/hive-agent"
  echo "   Config file at: /etc/pulse-hive/config.yaml"
fi

echo ""
echo "   Config: /etc/pulse-hive/config.yaml"
echo ""
echo "The agent should appear in your Pulse dashboard within 30 seconds."`;

    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', 'attachment; filename="install-hive-agent.sh"');
    return res.send(installScript);
  } catch (error) {
    console.error('Error generating install script:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending commands for an agent (polling endpoint)
hivePublicRoutes.get('/commands/pending', async (req: Request, res: Response) => {
  try {
    // Extract API key from header
    let apiKey;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    if (!apiKey || !apiKey.startsWith('hive_')) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    // Find agent by API key
    const agent = await db.select()
      .from(hiveAgents)
      .where(eq(hiveAgents.apiKey, apiKey))
      .limit(1);

    if (agent.length === 0) {
      return res.status(401).json({ error: 'Agent not found' });
    }

    const agentData = agent[0];

    // Get pending commands for this agent
    const pendingCommands = await db.select()
      .from(hiveCommands)
      .where(and(
        eq(hiveCommands.agentId, agentData.id),
        eq(hiveCommands.status, 'pending')
      ))
      .orderBy(hiveCommands.executedAt)
      .limit(10);

    // Convert to command format expected by agent
    const commands = pendingCommands.map(cmd => ({
      id: cmd.id,
      type: cmd.commandType,
      command: cmd.command,
      parameters: cmd.parameters,
      session_id: cmd.sessionId,
      timeout: 30000 // 30 seconds default
    }));

    // Mark commands as 'executing' to prevent duplicate processing
    if (commands.length > 0) {
      const commandIds = commands.map(cmd => cmd.id);
      await db.update(hiveCommands)
        .set({ status: 'executing' })
        .where(inArray(hiveCommands.id, commandIds));
    }

    return res.json(commands);

  } catch (error) {
    console.error('Error fetching pending commands:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent reports command execution results
hivePublicRoutes.post('/commands/:commandId/response', async (req: Request, res: Response) => {
  try {
    const { commandId } = req.params;
    const { success, response, error, exit_code, execution_time_ms } = req.body;
    
    // Extract API key from header
    let apiKey;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    if (!apiKey || !apiKey.startsWith('hive_')) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    // Find agent by API key
    const agent = await db.select()
      .from(hiveAgents)
      .where(eq(hiveAgents.apiKey, apiKey))
      .limit(1);

    if (agent.length === 0) {
      return res.status(401).json({ error: 'Agent not found' });
    }

    const agentData = agent[0];

    // Update command with results
    const updatedCommand = await db.update(hiveCommands)
      .set({
        status: success ? 'completed' : 'failed',
        response: response || error || 'No response',
        exitCode: exit_code || 0,
        executionTimeMs: execution_time_ms || 0,
        completedAt: new Date()
      })
      .where(and(
        eq(hiveCommands.id, commandId),
        eq(hiveCommands.agentId, agentData.id)
      ))
      .returning();

    if (updatedCommand.length === 0) {
      return res.status(404).json({ error: 'Command not found or not authorized' });
    }

    console.log(`Command ${commandId} completed: success=${success}, exit_code=${exit_code}`);
    
    return res.json({ 
      success: true, 
      message: 'Command response recorded',
      command_id: commandId
    });

  } catch (error) {
    console.error('Error recording command response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

hivePublicRoutes.get('/download/hive-agent-:platform-:arch', async (req: Request, res: Response) => {
  try {
    const { platform, arch } = req.params;
    
    // Map platform/arch to binary filename
    let binaryFilename: string;
    if (platform === 'windows') {
      binaryFilename = `hive-agent-${platform}-${arch}.exe`;
    } else {
      binaryFilename = `hive-agent-${platform}-${arch}`;
    }
    
    // Check if we have the compiled binary available in public directory
    const path = require('path');
    const fs = require('fs');
    const binaryPath = path.join('/app/apps/api/public', binaryFilename);
    
    try {
      const stats = fs.statSync(binaryPath);
      
      if (stats.isFile() && stats.size > 1000) { // Ensure it's a real binary, not just a tiny file
        console.log(`✅ [PUBLIC] Serving ${platform}/${arch} binary: ${binaryFilename} (${stats.size} bytes)`);
        
        // Send the platform-specific binary file
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="hive-agent"`);
        res.setHeader('X-Binary-Platform', platform);
        res.setHeader('X-Binary-Architecture', arch);
        return res.sendFile(binaryPath);
      } else {
        console.log(`❌ [PUBLIC] Binary too small or not found: ${binaryPath} (${stats?.size || 0} bytes)`);
      }
    } catch (err) {
      console.log(`❌ [PUBLIC] Binary not found: ${binaryPath}`);
    }
    
    // Try fallback to generic binary (for backward compatibility)
    const fallbackPath = path.join('/app/apps/api/public', 'hive-agent-binary');
    try {
      const stats = fs.statSync(fallbackPath);
      if (stats.isFile() && stats.size > 1000) {
        console.log(`⚠️ [PUBLIC] Using fallback binary for ${platform}/${arch}: hive-agent-binary`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="hive-agent"`);
        res.setHeader('X-Binary-Platform', 'fallback');
        res.setHeader('X-Binary-Architecture', 'unknown');
        return res.sendFile(fallbackPath);
      }
    } catch (err) {
      console.log('❌ [PUBLIC] Fallback binary also not found');
    }
    
    // List available binaries for debugging
    try {
      const publicDir = '/app/apps/api/public';
      const files = fs.readdirSync(publicDir).filter((f: string) => f.startsWith('hive-agent'));
      console.log(`[PUBLIC] Available hive agent binaries: ${files.join(', ')}`);
    } catch (err) {
      console.log('[PUBLIC] Could not list public directory files');
    }
    
    // No binary found - return error
    return res.status(404).json({ 
      error: 'Binary not available', 
      message: `Hive agent binary for ${platform}/${arch} is not available. Please check back soon or contact support.`,
      platform,
      arch,
      requestedFile: binaryFilename
    });
  } catch (error) {
    console.error('Error downloading agent binary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Configuration Management Endpoints

// Get agent configuration
router.get('/agents/:id/config', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify agent belongs to organization
    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get agent configurations
    const configs = await db.select()
      .from(hiveAgentConfigs)
      .where(eq(hiveAgentConfigs.agentId, agentId))
      .orderBy(asc(hiveAgentConfigs.configType), asc(hiveAgentConfigs.configName));

    const configsByType = configs.reduce((acc, config) => {
      if (!acc[config.configType]) {
        acc[config.configType] = [];
      }
      acc[config.configType].push(config);
      return acc;
    }, {} as Record<string, any[]>);

    return res.json({
      success: true,
      agent: agent[0],
      configurations: configsByType
    });
  } catch (error) {
    console.error('Error fetching agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent configuration
router.put('/agents/:id/config', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { configType, configName, config, enabled } = req.body;
    const organizationId = req.user?.organizationId;

    // Verify agent belongs to organization
    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Upsert configuration
    const existingConfig = await db.select()
      .from(hiveAgentConfigs)
      .where(and(
        eq(hiveAgentConfigs.agentId, agentId),
        eq(hiveAgentConfigs.configType, configType),
        eq(hiveAgentConfigs.configName, configName)
      ))
      .limit(1);

    if (existingConfig.length > 0) {
      // Update existing config
      const updatedConfig = await db.update(hiveAgentConfigs)
        .set({
          config,
          enabled: enabled !== undefined ? enabled : true,
          updatedAt: new Date()
        })
        .where(eq(hiveAgentConfigs.id, existingConfig[0].id))
        .returning();

      // Config updates handled via HTTP polling

      return res.json({ success: true, config: updatedConfig[0] });
    } else {
      // Create new config
      const newConfig = await db.insert(hiveAgentConfigs)
        .values({
          agentId,
          configType,
          configName,
          config,
          enabled: enabled !== undefined ? enabled : true
        })
        .returning();

      // Config updates handled via HTTP polling

      return res.json({ success: true, config: newConfig[0] });
    }
  } catch (error) {
    console.error('Error updating agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete agent configuration
router.delete('/agents/:id/config/:configId', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId, configId } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify agent belongs to organization
    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get config to delete (for notification)
    const configToDelete = await db.select()
      .from(hiveAgentConfigs)
      .where(and(eq(hiveAgentConfigs.id, configId), eq(hiveAgentConfigs.agentId, agentId)))
      .limit(1);

    if (configToDelete.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Delete configuration
    await db.delete(hiveAgentConfigs)
      .where(eq(hiveAgentConfigs.id, configId));

    // Config updates handled via HTTP polling

    return res.json({ success: true, message: 'Configuration deleted' });
  } catch (error) {
    console.error('Error deleting agent config:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get output endpoints for organization
router.get('/output-endpoints', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    const endpoints = await db.select()
      .from(hiveOutputEndpoints)
      .where(eq(hiveOutputEndpoints.organizationId, organizationId!))
      .orderBy(desc(hiveOutputEndpoints.createdAt));

    return res.json({ success: true, endpoints });
  } catch (error) {
    console.error('Error fetching output endpoints:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create output endpoint
router.post('/output-endpoints', authMiddleware, requirePermission('hive', 'configure'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    const {
      name,
      type,
      endpointUrl,
      authType,
      authConfig,
      headers,
      batchSize,
      flushIntervalSeconds,
      retryConfig,
      enabled
    } = req.body;

    const endpoint = await db.insert(hiveOutputEndpoints)
      .values({
        organizationId: organizationId!,
        name,
        type,
        endpointUrl,
        authType,
        authConfig: authConfig || {},
        headers: headers || {},
        batchSize: batchSize || 1000,
        flushIntervalSeconds: flushIntervalSeconds || 10,
        retryConfig: retryConfig || { max_retries: 3, backoff_seconds: 5 },
        enabled: enabled !== undefined ? enabled : true
      })
      .returning();

    return res.json({ success: true, endpoint: endpoint[0] });
  } catch (error) {
    console.error('Error creating output endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// Get command history for agent
router.get('/agents/:id/commands', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const organizationId = req.user?.organizationId;

    // Verify agent belongs to organization
    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const commands = await db.select()
      .from(hiveCommands)
      .where(eq(hiveCommands.agentId, agentId))
      .orderBy(desc(hiveCommands.executedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    return res.json({ success: true, commands });
  } catch (error) {
    console.error('Error fetching command history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific command result
router.get('/agents/:id/commands/:commandId', authMiddleware, requirePermission('hive', 'read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: agentId, commandId } = req.params;
    const organizationId = req.user?.organizationId;

    // Verify agent belongs to organization
    const agent = await db.select()
      .from(hiveAgents)
      .where(and(eq(hiveAgents.id, agentId), eq(hiveAgents.organizationId, organizationId!)))
      .limit(1);

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const command = await db.select()
      .from(hiveCommands)
      .where(and(eq(hiveCommands.id, commandId), eq(hiveCommands.agentId, agentId)))
      .limit(1);

    if (command.length === 0) {
      return res.status(404).json({ error: 'Command not found' });
    }

    return res.json({ success: true, command: command[0] });
  } catch (error) {
    console.error('Error fetching command result:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;