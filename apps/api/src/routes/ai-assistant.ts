import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { db } from '../index';
import { 
  aiAssistantSessions,
  aiAssistantMessages,
  configurations,
  servers,
  serverGroups,
  deployments,
  configurationDrifts,
  aiSuggestions,
  conversations,
  messages as chatMessages,
  auditLogs,
  roles,
  userRoles,
  rolePermissions,
  organizationSettings,
  organizations,
  users,
  assets,
  mdmDevices,
  pemKeys,
  permissions
} from '@config-management/database';
import { eq, and, desc, or, inArray, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import yaml from 'js-yaml';

const router = Router();

// Get Anthropic API key from environment (same as existing chat)
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

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    organizationId: string;
    email: string;
    isSuperAdmin?: boolean;
  };
}

// Schema for AI Assistant requests
const aiAssistantRequestSchema = z.object({
  message: z.string().min(1),
  contextPage: z.enum([
    'servers', 
    'configurations', 
    'deployments', 
    'dashboard', 
    'chat',
    'settings',
    'organizations',
    'assets',
    'mdm',
    'server-groups',
    'pem-keys',
    'training'
  ]),
  contextData: z.object({
    pageUrl: z.string().optional(),
    selectedItems: z.array(z.string()).optional(),
    filters: z.record(z.string(), z.any()).optional(),
    visibleData: z.record(z.string(), z.any()).optional(),
  }).optional(),
  sessionId: z.string().uuid().optional().nullable(),
  requestAction: z.enum(['chat', 'analyze', 'suggest', 'fix', 'create']).optional(),
});

// Get user permissions for AI context
async function getUserPermissions(userId: string): Promise<string[]> {
  const userRolesList = await db
    .select({
      resource: permissions.resource,
      action: permissions.action,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(
      eq(userRoles.userId, userId),
      eq(userRoles.isActive, true),
      eq(roles.isActive, true)
    ));

  return userRolesList.map(p => `${p.resource}:${p.action}`);
}

// Gather context based on the current page
async function gatherPageContext(
  page: string, 
  organizationId: string,
  contextData?: any
): Promise<any> {
  const context: any = {
    page,
    timestamp: new Date().toISOString(),
  };

  switch (page) {
    case 'servers':
      // Get servers and their status
      const serversList = await db
        .select()
        .from(servers)
        .where(eq(servers.organizationId, organizationId))
        .orderBy(desc(servers.createdAt))
        .limit(50);

      const serverGroupsList = await db
        .select()
        .from(serverGroups)
        .where(eq(serverGroups.organizationId, organizationId));

      context.servers = serversList;
      context.serverGroups = serverGroupsList;
      context.statistics = {
        total: serversList.length,
        connected: serversList.filter(s => s.status === 'connected').length,
        disconnected: serversList.filter(s => s.status === 'disconnected').length,
        groups: serverGroupsList.length,
      };
      break;

    case 'configurations':
      // Get configurations and recent changes
      const configsList = await db
        .select()
        .from(configurations)
        .where(eq(configurations.organizationId, organizationId))
        .orderBy(desc(configurations.updatedAt))
        .limit(50);

      // Check for configuration drifts
      const drifts = await db
        .select()
        .from(configurationDrifts)
        .where(and(
          eq(configurationDrifts.organizationId, organizationId),
          sql`${configurationDrifts.resolvedAt} IS NULL`
        ))
        .limit(10);

      context.configurations = configsList;
      context.drifts = drifts;
      context.statistics = {
        total: configsList.length,
        playbooks: configsList.filter(c => c.type === 'playbook').length,
        roles: configsList.filter(c => c.type === 'role').length,
        tasks: configsList.filter(c => c.type === 'task').length,
        activeDrifts: drifts.length,
      };
      break;

    case 'deployments':
      // Get recent deployments and their status
      const deploymentsList = await db
        .select()
        .from(deployments)
        .where(eq(deployments.organizationId, organizationId))
        .orderBy(desc(deployments.createdAt))
        .limit(50);

      // Get available configurations for deployments
      const availableConfigs = await db
        .select({
          id: configurations.id,
          name: configurations.name,
          type: configurations.type,
          approvalStatus: configurations.approvalStatus,
          createdAt: configurations.createdAt
        })
        .from(configurations)
        .where(and(
          eq(configurations.organizationId, organizationId),
          eq(configurations.approvalStatus, 'approved')
        ))
        .orderBy(desc(configurations.createdAt))
        .limit(20);

      // Get available servers for deployments
      const availableServers = await db
        .select({
          id: servers.id,
          name: servers.name,
          hostname: servers.hostname,
          status: servers.status,
          ipAddress: servers.ipAddress,
          type: servers.type
        })
        .from(servers)
        .where(eq(servers.organizationId, organizationId))
        .orderBy(desc(servers.createdAt))
        .limit(20);

      // Get server groups for deployments
      const availableGroups = await db
        .select({
          id: serverGroups.id,
          name: serverGroups.name,
          description: serverGroups.description,
          createdAt: serverGroups.createdAt
        })
        .from(serverGroups)
        .where(eq(serverGroups.organizationId, organizationId))
        .orderBy(desc(serverGroups.createdAt));

      context.deployments = deploymentsList;
      context.availableConfigurations = availableConfigs;
      context.availableServers = availableServers;
      context.availableServerGroups = availableGroups;
      context.statistics = {
        total: deploymentsList.length,
        running: deploymentsList.filter(d => d.status === 'running').length,
        completed: deploymentsList.filter(d => d.status === 'completed').length,
        failed: deploymentsList.filter(d => d.status === 'failed').length,
        pending: deploymentsList.filter(d => d.status === 'pending').length,
        lastDeployment: deploymentsList[0],
        availableConfigs: availableConfigs.length,
        connectedServers: availableServers.filter(s => 
          s.status === 'connected' || s.status === 'online' || s.status === 'active').length,
        totalServers: availableServers.length,
        serverGroups: availableGroups.length
      };
      break;

    case 'settings':
      // Get organization settings and user roles
      const [orgSettings] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      const rolesList = await db
        .select()
        .from(roles)
        .where(eq(roles.organizationId, organizationId));

      // Also get organization features
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      context.settings = orgSettings;
      context.roles = rolesList;
      context.organization = org;
      context.statistics = {
        rolesCount: rolesList.length,
        featuresEnabled: org?.featuresEnabled || {},
      };
      break;

    case 'organizations':
      // Get organization details for admin
      const orgsList = await db
        .select()
        .from(organizations)
        .orderBy(desc(organizations.createdAt))
        .limit(50);

      const usersList = await db
        .select()
        .from(users)
        .limit(100);

      context.organizations = orgsList;
      context.statistics = {
        totalOrganizations: orgsList.length,
        totalUsers: usersList.length,
        activeOrganizations: orgsList.filter((o: any) => o.status === 'active').length,
      };
      break;

    case 'assets':
      // Get assets and their status
      const assetsList = await db
        .select()
        .from(assets)
        .where(eq(assets.organizationId, organizationId))
        .orderBy(desc(assets.createdAt))
        .limit(100);

      context.assets = assetsList;
      context.statistics = {
        total: assetsList.length,
        servers: assetsList.filter((a: any) => a.type === 'server').length,
        databases: assetsList.filter((a: any) => a.type === 'database').length,
        applications: assetsList.filter((a: any) => a.type === 'application').length,
      };
      break;

    case 'mdm':
      // Get MDM enrolled devices
      const mdmDevicesList = await db
        .select()
        .from(mdmDevices)
        .where(eq(mdmDevices.organizationId, organizationId))
        .orderBy(desc(mdmDevices.lastSeen))
        .limit(100);

      context.mdmDevices = mdmDevicesList;
      context.statistics = {
        total: mdmDevicesList.length,
        online: mdmDevicesList.filter((d: any) => {
          const lastSeen = new Date(d.lastSeen);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return lastSeen > fiveMinutesAgo;
        }).length,
        macOS: mdmDevicesList.filter((d: any) => d.os === 'macOS').length,
        windows: mdmDevicesList.filter((d: any) => d.os === 'Windows').length,
      };
      break;

    case 'server-groups':
      // Get server groups and their members
      const groupsList = await db
        .select()
        .from(serverGroups)
        .where(eq(serverGroups.organizationId, organizationId))
        .orderBy(desc(serverGroups.createdAt));

      // Get servers that belong to groups
      const serversInGroups = await db
        .select()
        .from(servers)
        .where(and(
          eq(servers.organizationId, organizationId),
          sql`${servers.groupId} IS NOT NULL`
        ));

      context.serverGroups = groupsList;
      context.statistics = {
        totalGroups: groupsList.length,
        serversInGroups: serversInGroups.length,
        averageServersPerGroup: groupsList.length ? Math.round(serversInGroups.length / groupsList.length) : 0,
      };
      break;

    case 'pem-keys':
      // Get PEM keys (but don't expose private keys)
      const pemKeysList = await db
        .select({
          id: pemKeys.id,
          name: pemKeys.name,
          description: pemKeys.description,
          fingerprint: pemKeys.fingerprint,
          createdAt: pemKeys.createdAt,
        })
        .from(pemKeys)
        .where(eq(pemKeys.organizationId, organizationId))
        .orderBy(desc(pemKeys.createdAt));

      context.pemKeys = pemKeysList;
      context.statistics = {
        total: pemKeysList.length,
      };
      break;

    case 'training':
      // Get training progress and modules
      context.trainingModules = [
        'Server Management',
        'Configuration Management',
        'Deployment Automation',
        'Security Best Practices',
        'Monitoring & Alerts',
      ];
      context.statistics = {
        modulesAvailable: 5,
        completionRate: 0, // Would be calculated from user progress
      };
      break;

    case 'chat':
      // Get conversation history
      const conversationsList = await db
        .select()
        .from(conversations)
        .where(eq(conversations.organizationId, organizationId))
        .orderBy(desc(conversations.updatedAt))
        .limit(20);

      context.conversations = conversationsList;
      context.statistics = {
        totalConversations: conversationsList.length,
        activeConversations: conversationsList.filter((c: any) => c.isActive).length,
      };
      break;

    case 'dashboard':
    default:
      // Get dashboard overview statistics
      const [serversCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(servers)
        .where(eq(servers.organizationId, organizationId));

      const [configsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(configurations)
        .where(eq(configurations.organizationId, organizationId));

      const [deploymentsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(deployments)
        .where(eq(deployments.organizationId, organizationId));

      context.overview = {
        servers: serversCount?.count || 0,
        configurations: configsCount?.count || 0,
        deployments: deploymentsCount?.count || 0,
      };
      break;
  }

  // Add any specific context data from the request
  if (contextData) {
    context.userContext = contextData;
  }

  // Get recent audit logs for context
  const recentActions = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  context.recentActions = recentActions;

  return context;
}

// Analyze configuration for issues
function analyzeConfiguration(content: string, type: string): any {
  const issues = [];
  const recommendations = [];

  try {
    // Parse YAML
    const parsed = yaml.load(content) as any;

    // Common Ansible checks
    if (type === 'playbook' || type === 'role' || type === 'task') {
      // Check for become without become_user
      if (content.includes('become: yes') && !content.includes('become_user:')) {
        issues.push({
          severity: 'warning',
          message: 'Using become without specifying become_user (defaults to root)',
          suggestion: 'Consider explicitly setting become_user for clarity',
        });
      }

      // Check for hardcoded passwords
      if (content.match(/password:\s*['"]?[^{]/i)) {
        issues.push({
          severity: 'critical',
          message: 'Potential hardcoded password detected',
          suggestion: 'Use Ansible Vault or variables for sensitive data',
        });
      }

      // Check for missing error handling
      if (!content.includes('ignore_errors:') && !content.includes('failed_when:')) {
        recommendations.push('Consider adding error handling for critical tasks');
      }

      // Check for deprecated modules
      const deprecatedModules = ['include:', 'static:'];
      deprecatedModules.forEach(module => {
        if (content.includes(module)) {
          issues.push({
            severity: 'warning',
            message: `Using deprecated directive: ${module}`,
            suggestion: 'Update to use import_* or include_* tasks',
          });
        }
      });
    }

    // Check for unset variables
    const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;
    const matches = content.match(variablePattern);
    if (matches) {
      const uniqueVars = [...new Set(matches)];
      recommendations.push(`Ensure these variables are defined: ${uniqueVars.join(', ')}`);
    }

  } catch (error) {
    issues.push({
      severity: 'error',
      message: 'Invalid YAML syntax',
      suggestion: 'Check YAML formatting and indentation',
    });
  }

  return { issues, recommendations };
}

// Main AI Assistant endpoint
router.post('/chat', authMiddleware, async (req: any, res: Response) => {
  try {
    const validatedData = aiAssistantRequestSchema.parse(req.body);
    const userPermissions = await getUserPermissions(req.user.id);
    
    // Get or create session
    let sessionId = validatedData.sessionId;
    if (!sessionId) {
      const [session] = await db
        .insert(aiAssistantSessions)
        .values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          contextPage: validatedData.contextPage,
          contextData: validatedData.contextData || {},
        })
        .returning();
      sessionId = session.id;
    }

    // Gather context
    const pageContext = await gatherPageContext(
      validatedData.contextPage,
      req.user.organizationId,
      validatedData.contextData
    );

    // Get conversation history from this session
    const sessionHistory = await db
      .select()
      .from(aiAssistantMessages)
      .where(eq(aiAssistantMessages.sessionId, sessionId))
      .orderBy(aiAssistantMessages.createdAt)
      .limit(20);

    // Build the prompt for Claude
    const systemPrompt = `You are an AI assistant for Pulse, an enterprise configuration management platform.
    You have access to the current context and can help with:
    - Analyzing configurations for issues and best practices
    - Detecting configuration drift
    - Creating new assets, configurations, servers, and deployments
    - Approving or rejecting pending configurations (admin/super_admin only)
    - Troubleshooting deployment failures
    - Recommending optimizations and security improvements
    
    Current user permissions: ${userPermissions.join(', ')}
    Current page: ${validatedData.contextPage}
    
    Context:
    ${JSON.stringify(pageContext, null, 2)}
    
    Previous conversation:
    ${sessionHistory.map(m => `${m.role}: ${m.content}`).join('\n')}
    
    Guidelines:
    - Be proactive and action-oriented - CREATE rather than ASK for more details
    - When users request to create assets, servers, or configurations, immediately prepare the creation actions
    - For asset creation: automatically choose reasonable defaults (laptop for general assets, server for server requests)
    - For configuration approval/rejection: immediately process pending configurations when requested
    - For deployments: ONLY suggest deployments for APPROVED configurations to CONNECTED servers
    - When creating deployments, clearly specify which approved config will be deployed to which server
    - If no approved configs exist, inform user that configurations must be approved first
    - If no online/connected servers exist, inform user that servers must be online first
    - Always validate configurations before suggesting deployments
    - Respect user permissions - only suggest actions they can perform
    - When creating configurations, use best practices and secure defaults
    - Explain any security concerns clearly
    - Provide actionable recommendations
    - If the user says "create asset X", immediately create it with reasonable defaults rather than asking for more details
    - For deployment context: you have access to availableConfigurations, availableServers, and availableServerGroups
    - Security note: Server creation should be restricted due to security implications, but other operations are executable
    - IMPORTANT: NO DELETE/REMOVE operations allowed - AI can only CREATE, UPDATE, APPROVE, REJECT, or DEPLOY
    - If users request deletion/removal, explain this requires manual verification for security reasons`;

    // Get Anthropic client
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'AI Assistant not configured',
        message: 'Please configure your Anthropic API key in Settings'
      });
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: validatedData.message,
        }
      ],
    });

    const assistantResponse = response.content[0].type === 'text' ? response.content[0].text : '';

    // Analyze if the response contains configurations or actions
    let actions = [];
    let analysis = null;
    let generatedContent = null;

    // Check if response contains YAML configuration
    if (assistantResponse.includes('```yaml') || assistantResponse.includes('```yml')) {
      const yamlMatch = assistantResponse.match(/```(?:yaml|yml)\n([\s\S]*?)\n```/);
      if (yamlMatch) {
        const configContent = yamlMatch[1];
        analysis = analyzeConfiguration(configContent, 'playbook');
        
        generatedContent = {
          configurations: [{
            name: 'Generated Configuration',
            type: 'playbook',
            content: configContent,
          }],
        };

        actions.push({
          type: 'create_config',
          status: 'pending',
          details: {
            content: configContent,
            analysis: analysis,
          },
        });
      }
    }

    // Check if the user is asking to perform actions
    const userMessage = validatedData.message.toLowerCase();
    
    // Look for rejection requests - expanded patterns
    if ((userMessage.includes('reject') || userMessage.includes('deny') || 
         userMessage.includes('decline') || userMessage.includes('refuse')) && 
        (userMessage.includes('config') || userMessage.includes('configuration') ||
         userMessage.includes('pending') || userMessage.includes('approval'))) {
      
      // Try to find configuration IDs in context or extract from message
      if (validatedData.contextPage === 'configurations' && pageContext.configurations) {
        const pendingConfigs = pageContext.configurations.filter((c: any) => c.approvalStatus === 'pending');
        
        // If there are pending configurations, suggest rejection actions
        if (pendingConfigs.length > 0) {
          // Check if user specified a particular config by name
          let specificConfig = null;
          for (const config of pendingConfigs) {
            if (userMessage.includes(config.name.toLowerCase())) {
              specificConfig = config;
              break;
            }
          }
          
          if (specificConfig) {
            // Only reject the specific config mentioned
            actions.push({
              type: 'reject_config',
              status: 'pending',
              details: {
                configurationId: specificConfig.id,
                configurationName: specificConfig.name,
                reason: 'Rejected based on AI Assistant review request',
              },
            });
          } else {
            // Reject all pending configs if no specific one mentioned
            pendingConfigs.forEach((config: any) => {
              actions.push({
                type: 'reject_config',
                status: 'pending',
                details: {
                  configurationId: config.id,
                  configurationName: config.name,
                  reason: 'Rejected based on AI Assistant review request',
                },
              });
            });
          }
        }
      }
    }
    
    // Look for approval requests - expanded patterns  
    if ((userMessage.includes('approve') || userMessage.includes('accept') || 
         userMessage.includes('confirm') || userMessage.includes('allow')) && 
        (userMessage.includes('config') || userMessage.includes('configuration') ||
         userMessage.includes('pending') || userMessage.includes('approval'))) {
      
      // Try to find configuration IDs in context
      if (validatedData.contextPage === 'configurations' && pageContext.configurations) {
        const pendingConfigs = pageContext.configurations.filter((c: any) => c.approvalStatus === 'pending');
        
        // If there are pending configurations, suggest approval actions
        if (pendingConfigs.length > 0) {
          // Check if user specified a particular config by name
          let specificConfig = null;
          for (const config of pendingConfigs) {
            if (userMessage.includes(config.name.toLowerCase())) {
              specificConfig = config;
              break;
            }
          }
          
          if (specificConfig) {
            // Only approve the specific config mentioned
            actions.push({
              type: 'approve_config',
              status: 'pending',
              details: {
                configurationId: specificConfig.id,
                configurationName: specificConfig.name,
              },
            });
          } else {
            // Approve all pending configs if no specific one mentioned
            pendingConfigs.forEach((config: any) => {
              actions.push({
                type: 'approve_config',
                status: 'pending',
                details: {
                  configurationId: config.id,
                  configurationName: config.name,
                },
              });
            });
          }
        }
      }
    }

    // Look for asset creation requests
    if ((userMessage.includes('create') || userMessage.includes('add') || userMessage.includes('new')) && 
        (userMessage.includes('asset') || userMessage.includes('assets'))) {
      
      if (validatedData.contextPage === 'assets') {
        // Extract asset details from the message
        let assetType = 'laptop'; // Default to laptop instead of server for general assets
        let assetName = 'AI Generated Asset';
        
        // Try to detect asset type with more options
        if (userMessage.includes('database') || userMessage.includes('db')) assetType = 'server';
        else if (userMessage.includes('application') || userMessage.includes('app')) assetType = 'laptop';
        else if (userMessage.includes('server')) assetType = 'server';
        else if (userMessage.includes('laptop')) assetType = 'laptop';
        else if (userMessage.includes('desktop')) assetType = 'desktop';
        else if (userMessage.includes('tablet')) assetType = 'tablet';
        else if (userMessage.includes('phone')) assetType = 'phone';
        else if (userMessage.includes('monitor')) assetType = 'monitor';
        
        // Try to extract name from message with more patterns
        const namePatterns = [
          /(?:create|add|new)\s+(?:an?\s+)?(?:asset\s+)?(?:called\s+|named\s+)?["']?([^"'\n,]+)["']?/i,
          /(?:asset\s+)?["']([^"']+)["']/i,
          /\b(\w+\d+|\w+_\w+)\b/i // Match patterns like asset12, test_laptop
        ];
        
        for (const pattern of namePatterns) {
          const match = userMessage.match(pattern);
          if (match && match[1] && match[1].trim() !== 'asset') {
            assetName = match[1].trim();
            break;
          }
        }
        
        actions.push({
          type: 'create_asset',
          status: 'pending',
          details: {
            name: assetName,
            type: assetType,
            description: `Asset created via AI Assistant request`,
            metadata: { createdBy: 'ai_assistant' },
          },
        });
      }
    }

    // Look for server group creation requests (safer than individual servers)
    if ((userMessage.includes('create') || userMessage.includes('add') || userMessage.includes('new')) && 
        (userMessage.includes('server group') || userMessage.includes('group'))) {
      
      if (validatedData.contextPage === 'server-groups' || validatedData.contextPage === 'servers') {
        // Extract group details from the message
        let groupName = 'AI Generated Server Group';
        let description = 'Server group created via AI Assistant';
        
        // Try to extract group name from message
        const namePatterns = [
          /(?:create|add|new)\s+(?:server\s+)?group\s+(?:called\s+|named\s+)?["']?([^"'\n,]+)["']?/i,
          /group\s+["']([^"']+)["']/i,
        ];
        
        for (const pattern of namePatterns) {
          const match = userMessage.match(pattern);
          if (match && match[1]) {
            groupName = match[1].trim();
            break;
          }
        }
        
        actions.push({
          type: 'create_server_group',
          status: 'pending',
          details: {
            name: groupName,
            description: description,
            metadata: { createdBy: 'ai_assistant' },
          },
        });
      }
    }

    // Look for server creation requests (note: these should be restricted due to security)
    if ((userMessage.includes('create') || userMessage.includes('add') || userMessage.includes('new')) && 
        (userMessage.includes('server') && !userMessage.includes('server group'))) {
      
      if (validatedData.contextPage === 'servers') {
        // Add a warning action instead of direct server creation
        actions.push({
          type: 'warning',
          status: 'blocked',
          details: {
            message: 'Server creation requires manual verification due to security implications. Please add servers manually.',
            reason: 'security_restriction',
            suggestion: 'Consider creating a server group first, then manually add servers to it.',
          },
        });
      }
    }

    // Look for configuration creation requests
    if ((userMessage.includes('create') || userMessage.includes('add') || userMessage.includes('new')) && 
        (userMessage.includes('config') || userMessage.includes('configuration') || userMessage.includes('playbook'))) {
      
      if (validatedData.contextPage === 'configurations') {
        // Extract configuration details from the message
        let configName = 'AI Generated Configuration';
        let configType = 'playbook';
        let configContent = '';
        
        // Try to extract config name from message
        const namePatterns = [
          /(?:create|add|new)\s+(?:a\s+)?(?:config|configuration|playbook)\s+(?:called\s+|named\s+)?["']?([^"'\n,]+)["']?/i,
          /(?:config|configuration|playbook)\s+["']([^"']+)["']/i,
        ];
        
        for (const pattern of namePatterns) {
          const match = userMessage.match(pattern);
          if (match && match[1]) {
            configName = match[1].trim();
            break;
          }
        }
        
        // Try to detect config type
        if (userMessage.includes('role')) configType = 'role';
        else if (userMessage.includes('task')) configType = 'task';
        
        // Create basic configuration content based on type
        switch (configType) {
          case 'playbook':
            configContent = `---
- name: ${configName}
  hosts: all
  become: yes
  tasks:
    - name: Ensure package is installed
      package:
        name: curl
        state: present
`;
            break;
          case 'role':
            configContent = `---
# ${configName} Role
- name: Main role tasks
  include_tasks: main.yml
`;
            break;
          case 'task':
            configContent = `---
- name: ${configName}
  debug:
    msg: "Task created by AI Assistant"
`;
            break;
        }
        
        actions.push({
          type: 'create_config',
          status: 'pending',
          details: {
            name: configName,
            type: configType,
            content: configContent,
            description: `${configType} created via AI Assistant`,
            metadata: { createdBy: 'ai_assistant' },
          },
        });
      }
    }

    // Look for deployment creation requests - expanded patterns
    if ((userMessage.includes('deploy') || userMessage.includes('deployment') || 
         userMessage.includes('run') || userMessage.includes('execute') || 
         userMessage.includes('launch') || userMessage.includes('start')) && 
        (userMessage.includes('config') || userMessage.includes('configuration') || 
         userMessage.includes('playbook') || validatedData.contextPage === 'deployments')) {
      
      if (validatedData.contextPage === 'deployments' && pageContext.availableConfigurations && pageContext.availableServers) {
        // Only suggest deployments for APPROVED configurations
        const approvedConfigs = pageContext.availableConfigurations.filter((c: any) => c.approvalStatus === 'approved');
        const connectedServers = pageContext.availableServers.filter((s: any) => 
          s.status === 'connected' || s.status === 'online' || s.status === 'active');
        
        if (approvedConfigs.length > 0 && connectedServers.length > 0) {
          // Extract configuration name from message
          let targetConfig = null;
          let targetServer = null;
          
          // Try to match specific configuration names
          for (const config of approvedConfigs) {
            if (userMessage.toLowerCase().includes(config.name.toLowerCase())) {
              targetConfig = config;
              break;
            }
          }
          
          // Try to match server names or use first available
          for (const server of connectedServers) {
            if (userMessage.toLowerCase().includes(server.name.toLowerCase()) || 
                userMessage.toLowerCase().includes(server.hostname.toLowerCase())) {
              targetServer = server;
              break;
            }
          }
          
          // Use defaults if not specified
          if (!targetConfig) targetConfig = approvedConfigs[0];
          if (!targetServer) targetServer = connectedServers[0];
          
          actions.push({
            type: 'create_deployment',
            status: 'pending',
            details: {
              configurationId: targetConfig.id,
              configurationName: targetConfig.name,
              targetType: 'server',
              targetId: targetServer.id,
              targetName: targetServer.name,
              name: `AI Deployment: ${targetConfig.name} to ${targetServer.name}`,
              scheduleType: 'immediate',
            },
          });
        } else if (approvedConfigs.length === 0) {
          // No approved configurations available
          actions.push({
            type: 'warning',
            status: 'blocked',
            details: {
              message: 'No approved configurations available for deployment. Please approve configurations first.',
              reason: 'no_approved_configs',
            },
          });
        } else if (connectedServers.length === 0) {
          // No online servers available
          actions.push({
            type: 'warning',
            status: 'blocked',
            details: {
              message: 'No online servers available for deployment. Please ensure servers are online/connected.',
              reason: 'no_online_servers',
            },
          });
        }
      }
    }

    // Look for configuration execution/deployment from configurations page
    if ((userMessage.includes('execute') || userMessage.includes('deploy') || userMessage.includes('run')) &&
        validatedData.contextPage === 'configurations' && pageContext.configurations) {
      
      const approvedConfigs = pageContext.configurations.filter((c: any) => c.approvalStatus === 'approved');
      
      if (approvedConfigs.length > 0) {
        // Get available servers for this organization (we need to fetch them)
        const availableServers = await db
          .select({
            id: servers.id,
            name: servers.name,
            hostname: servers.hostname,
            status: servers.status,
          })
          .from(servers)
          .where(and(
            eq(servers.organizationId, req.user.organizationId),
            or(
              eq(servers.status, 'connected'),
              eq(servers.status, 'online'),
              eq(servers.status, 'active')
            )
          ))
          .limit(10);
          
        if (availableServers.length > 0) {
          // Find specific configuration if mentioned
          let targetConfig = approvedConfigs[0];
          for (const config of approvedConfigs) {
            if (userMessage.toLowerCase().includes(config.name.toLowerCase())) {
              targetConfig = config;
              break;
            }
          }
          
          actions.push({
            type: 'create_deployment',
            status: 'pending',
            details: {
              configurationId: targetConfig.id,
              configurationName: targetConfig.name,
              targetType: 'server',
              targetId: availableServers[0].id,
              targetName: availableServers[0].name,
              name: `AI Deployment: ${targetConfig.name}`,
              scheduleType: 'immediate',
            },
          });
        }
      }
    }

    // Save assistant message
    const [assistantMessage] = await db
      .insert(aiAssistantMessages)
      .values({
        sessionId,
        role: 'assistant',
        content: assistantResponse,
        contextPage: validatedData.contextPage,
        actions: actions,
        analysis: analysis,
        generatedContent: generatedContent,
      })
      .returning();

    // Save user message
    await db
      .insert(aiAssistantMessages)
      .values({
        sessionId,
        role: 'user',
        content: validatedData.message,
        contextPage: validatedData.contextPage,
      });

    // Check for proactive suggestions based on context
    const suggestions = [];
    
    // Check for disconnected servers
    if (pageContext.servers) {
      const disconnectedServers = pageContext.servers.filter((s: any) => s.status === 'disconnected');
      if (disconnectedServers.length > 0) {
        suggestions.push({
          type: 'warning',
          message: `${disconnectedServers.length} server(s) are disconnected. Would you like help troubleshooting?`,
        });
      }
    }

    // Check for configuration drifts
    if (pageContext.drifts && pageContext.drifts.length > 0) {
      suggestions.push({
        type: 'error',
        message: `${pageContext.drifts.length} configuration drift(s) detected. I can help analyze and fix them.`,
      });
    }

    // Check for failed deployments
    if (pageContext.deployments) {
      const failedDeployments = pageContext.deployments.filter((d: any) => d.status === 'failed');
      if (failedDeployments.length > 0) {
        suggestions.push({
          type: 'error',
          message: `${failedDeployments.length} deployment(s) failed recently. I can help diagnose the issues.`,
        });
      }
    }

    res.json({
      sessionId,
      messageId: assistantMessage.id,
      message: assistantResponse,
      actions,
      analysis,
      generatedContent,
      suggestions,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
    }
    res.status(500).json({ error: 'AI Assistant error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Execute AI-suggested actions (requires confirmation)
router.post('/execute-action', authMiddleware, async (req: any, res: Response) => {
  try {
    const { messageId, actionIndex, confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({ error: 'Action requires confirmation' });
    }

    // Get the message with the action
    const [message] = await db
      .select()
      .from(aiAssistantMessages)
      .where(eq(aiAssistantMessages.id, messageId))
      .limit(1);

    if (!message || !message.actions || !message.actions[actionIndex]) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const action = message.actions[actionIndex];

    // Execute based on action type
    let result = null;
    switch (action.type) {
      case 'create_config':
        // Create configuration
        const [config] = await db
          .insert(configurations)
          .values({
            name: action.details.name || 'AI Generated Configuration',
            description: 'Generated by AI Assistant',
            type: action.details.type || 'playbook',
            ansiblePlaybook: action.details.content,
            organizationId: req.user.organizationId,
            createdBy: req.user.id,
            metadata: { source: 'ai_assistant' },
          })
          .returning();
        
        result = { configurationId: config.id };
        
        // Log the action
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'create',
          resource: 'configuration',
          resourceId: config.id,
          details: { source: 'ai_assistant', messageId },
        });
        break;

      case 'modify_config':
        // Update configuration
        await db
          .update(configurations)
          .set({
            ansiblePlaybook: action.details.content,
            updatedAt: new Date(),
          })
          .where(and(
            eq(configurations.id, action.details.configurationId),
            eq(configurations.organizationId, req.user.organizationId)
          ));
        
        result = { updated: true };
        break;

      case 'deploy':
        // Create deployment
        const [legacyDeployment] = await db
          .insert(deployments)
          .values({
            name: `AI Deployment - ${new Date().toISOString()}`,
            configurationId: action.details.configurationId,
            targetType: action.details.targetType || 'server',
            targetId: action.details.targetId,
            status: 'pending',
            organizationId: req.user.organizationId,
            executedBy: req.user.id,
            scheduleType: 'immediate',
            scheduledFor: new Date(),
          })
          .returning();
        
        result = { deploymentId: legacyDeployment.id };
        break;

      case 'reject_config':
        // Reject configuration
        await db
          .update(configurations)
          .set({
            approvalStatus: 'rejected',
            approvedBy: req.user.id,
            approvedAt: new Date(),
            rejectionReason: action.details.reason || 'Rejected via AI Assistant',
            updatedAt: new Date(),
          })
          .where(and(
            eq(configurations.id, action.details.configurationId),
            eq(configurations.organizationId, req.user.organizationId)
          ));
        
        result = { rejected: true, reason: action.details.reason };
        
        // Log the action
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'reject',
          resource: 'configuration',
          resourceId: action.details.configurationId,
          details: { source: 'ai_assistant', messageId, reason: action.details.reason },
        });
        break;

      case 'approve_config':
        // Approve configuration
        await db
          .update(configurations)
          .set({
            approvalStatus: 'approved',
            approvedBy: req.user.id,
            approvedAt: new Date(),
            rejectionReason: null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(configurations.id, action.details.configurationId),
            eq(configurations.organizationId, req.user.organizationId)
          ));
        
        result = { approved: true };
        
        // Log the action
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'approve',
          resource: 'configuration',
          resourceId: action.details.configurationId,
          details: { source: 'ai_assistant', messageId },
        });
        break;

      case 'create_asset':
        // Create asset
        const [asset] = await db
          .insert(assets)
          .values({
            assetTag: action.details.assetTag || `AI-${Date.now()}`,
            assetType: action.details.assetType || action.details.type || 'laptop',
            brand: action.details.brand || 'Unknown',
            model: action.details.model || action.details.name || 'AI Generated Asset',
            status: 'available',
            condition: 'good',
            category: 'IT Equipment',
            subcategory: action.details.assetType || action.details.type || 'Laptop',
            organizationId: req.user.organizationId,
            createdBy: req.user.id,
            notes: action.details.description || 'Created by AI Assistant',
          })
          .returning();
        
        result = { assetId: asset.id, assetTag: asset.assetTag, model: asset.model };
        
        // Log the action
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'create',
          resource: 'asset',
          resourceId: asset.id,
          details: { source: 'ai_assistant', messageId },
        });
        break;


      case 'create_server_group':
        // Create server group
        const [serverGroup] = await db
          .insert(serverGroups)
          .values({
            name: action.details.name || 'AI Generated Server Group',
            description: action.details.description || 'Server group created by AI Assistant',
            organizationId: req.user.organizationId,
          })
          .returning();
        
        result = { serverGroupId: serverGroup.id, name: serverGroup.name };
        
        // Log the action
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'create',
          resource: 'server_group',
          resourceId: serverGroup.id,
          details: { source: 'ai_assistant', messageId },
        });
        break;

      case 'create_deployment':
        // Validate configuration is approved before creating deployment
        const [configToCheck] = await db
          .select({ approvalStatus: configurations.approvalStatus })
          .from(configurations)
          .where(and(
            eq(configurations.id, action.details.configurationId),
            eq(configurations.organizationId, req.user.organizationId)
          ))
          .limit(1);
          
        if (!configToCheck || configToCheck.approvalStatus !== 'approved') {
          throw new Error('Configuration must be approved before deployment');
        }
        
        // Create deployment
        const [newDeployment] = await db
          .insert(deployments)
          .values({
            name: action.details.name || `AI Deployment - ${new Date().toISOString()}`,
            configurationId: action.details.configurationId,
            targetType: action.details.targetType || 'server',
            targetId: action.details.targetId,
            status: 'pending',
            organizationId: req.user.organizationId,
            executedBy: req.user.id,
            scheduleType: action.details.scheduleType || 'immediate',
            scheduledFor: new Date(),
          })
          .returning();
        
        result = { 
          deploymentId: newDeployment.id, 
          name: newDeployment.name,
          status: newDeployment.status,
          configurationName: action.details.configurationName,
          targetName: action.details.targetName
        };
        
        // Log the action
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'create',
          resource: 'deployment',
          resourceId: newDeployment.id,
          details: { source: 'ai_assistant', messageId, configurationId: action.details.configurationId },
        });
        break;

      case 'warning':
        // Handle warning acknowledgment - just mark as executed with the message
        result = { 
          message: action.details.message || 'Warning acknowledged',
          reason: action.details.reason,
          acknowledged: true
        };
        
        // Log the acknowledgment
        await db.insert(auditLogs).values({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          action: 'acknowledge',
          resource: 'warning',
          resourceId: messageId,
          details: { source: 'ai_assistant', messageId, reason: action.details.reason },
        });
        break;
    }

    // Update action status
    const updatedActions = [...message.actions];
    updatedActions[actionIndex].status = 'executed';
    updatedActions[actionIndex].executedAt = new Date().toISOString();

    await db
      .update(aiAssistantMessages)
      .set({ actions: updatedActions })
      .where(eq(aiAssistantMessages.id, messageId));

    res.json({ success: true, result });

  } catch (error) {
    console.error('Execute action error:', error);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

// Get AI suggestions for the current page
router.get('/suggestions', authMiddleware, async (req: any, res: Response) => {
  try {
    const { page } = req.query;

    const suggestions = await db
      .select()
      .from(aiSuggestions)
      .where(and(
        eq(aiSuggestions.organizationId, req.user.organizationId),
        eq(aiSuggestions.status, 'pending'),
        page ? eq(aiSuggestions.affectedResource, page) : sql`true`
      ))
      .orderBy(desc(aiSuggestions.createdAt))
      .limit(10);

    res.json(suggestions);
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Detect configuration drift
router.post('/detect-drift', authMiddleware, async (req: any, res: Response) => {
  try {
    const { configurationId, actualContent } = req.body;

    // Get the expected configuration
    const [config] = await db
      .select()
      .from(configurations)
      .where(and(
        eq(configurations.id, configurationId),
        eq(configurations.organizationId, req.user.organizationId)
      ))
      .limit(1);

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Compare configurations
    const differences = [];
    const configContent = config.ansiblePlaybook || '';
    const expectedLines = configContent.split('\n');
    const actualLines = actualContent.split('\n');

    for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
      if (expectedLines[i] !== actualLines[i]) {
        differences.push({
          path: `line_${i + 1}`,
          expected: expectedLines[i] || '',
          actual: actualLines[i] || '',
          type: !expectedLines[i] ? 'added' : !actualLines[i] ? 'removed' : 'modified',
        });
      }
    }

    if (differences.length > 0) {
      // Record the drift
      const [drift] = await db
        .insert(configurationDrifts)
        .values({
          configurationId,
          serverId: null,
          serverGroupId: null,
          expectedContent: configContent,
          actualContent,
          driftType: 'content',
          differences,
          severity: differences.length > 10 ? 'high' : 'medium',
          organizationId: req.user.organizationId,
        })
        .returning();

      // Create an AI suggestion
      await db.insert(aiSuggestions).values({
        organizationId: req.user.organizationId,
        type: 'drift',
        severity: 'warning',
        title: `Configuration drift detected in ${config.name}`,
        description: `${differences.length} differences found between expected and actual configuration`,
        affectedResource: 'configurations',
        affectedResourceId: configurationId,
        suggestedAction: {
          type: 'fix_drift',
          details: { driftId: drift.id, configurationId },
          autoFixAvailable: true,
        },
      });

      res.json({ drift: true, differences, driftId: drift.id });
    } else {
      res.json({ drift: false });
    }

  } catch (error) {
    console.error('Detect drift error:', error);
    res.status(500).json({ error: 'Failed to detect drift' });
  }
});

// Save conversation to main chat history
router.post('/save-to-history', authMiddleware, async (req: any, res: Response) => {
  try {
    const { sessionId } = req.body;

    // Get all messages from the session
    const sessionMessages = await db
      .select()
      .from(aiAssistantMessages)
      .where(eq(aiAssistantMessages.sessionId, sessionId))
      .orderBy(aiAssistantMessages.createdAt);

    if (sessionMessages.length === 0) {
      return res.status(404).json({ error: 'No messages to save' });
    }

    // Create a conversation in the main chat
    const [conversation] = await db
      .insert(conversations)
      .values({
        userId: req.user.id,
        organizationId: req.user.organizationId,
        title: `AI Assistant - ${sessionMessages[0].contextPage} - ${new Date().toLocaleDateString()}`,
      })
      .returning();

    // Save messages to main chat history
    for (const msg of sessionMessages) {
      await db.insert(chatMessages).values({
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
        generatedConfiguration: msg.generatedContent ? JSON.stringify(msg.generatedContent) : null,
      });

      // Link the AI message to the conversation
      await db
        .update(aiAssistantMessages)
        .set({ conversationId: conversation.id })
        .where(eq(aiAssistantMessages.id, msg.id));
    }

    // Mark session as inactive
    await db
      .update(aiAssistantSessions)
      .set({ 
        isActive: false,
        endedAt: new Date(),
      })
      .where(eq(aiAssistantSessions.id, sessionId));

    res.json({ success: true, conversationId: conversation.id });

  } catch (error) {
    console.error('Save to history error:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
});

export default router;