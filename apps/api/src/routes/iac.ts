import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { db } from '../index';
import { 
  iacConversations,
  iacMessages,
  users,
  organizations,
  githubIntegrations
} from '@config-management/database';
import { eq, and, desc, or, inArray, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { GitHubService } from '../services/githubService';
import { AWSService } from '../services/awsService';

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


// Validation schemas
const createConversationSchema = z.object({
  title: z.string().optional(),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1),
  awsRegion: z.string().optional().default('us-east-1'),
});

const createPRSchema = z.object({
  messageId: z.string().uuid(),
  integrationId: z.string().uuid(),
  branch: z.string().optional().default('main'),
  commitMessage: z.string().optional(),
});

const deployTerraformSchema = z.object({
  messageId: z.string().uuid(),
  action: z.enum(['init', 'validate', 'plan', 'deploy']),
  awsRegion: z.string().optional().default('us-east-1'),
});

// Get all IAC conversations for the user
router.get('/conversations', authMiddleware, async (req: any, res: Response) => {
  try {
    const conversations = await db
      .select()
      .from(iacConversations)
      .where(
        and(
          eq(iacConversations.userId, req.user.id),
          eq(iacConversations.organizationId, req.user.organizationId),
          eq(iacConversations.isActive, true)
        )
      )
      .orderBy(desc(iacConversations.updatedAt));

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching IAC conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create a new IAC conversation
router.post('/conversations', authMiddleware, async (req: any, res: Response) => {
  try {
    const validatedData = createConversationSchema.parse(req.body);
    
    const [conversation] = await db
      .insert(iacConversations)
      .values({
        title: validatedData.title || 'New IAC Conversation',
        userId: req.user.id,
        organizationId: req.user.organizationId,
      })
      .returning();

    res.json(conversation);
  } catch (error) {
    console.error('Error creating IAC conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Update conversation title
router.put('/conversations/:id', authMiddleware, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify conversation belongs to user
    const conversation = await db
      .select()
      .from(iacConversations)
      .where(
        and(
          eq(iacConversations.id, id),
          eq(iacConversations.userId, req.user.id),
          eq(iacConversations.organizationId, req.user.organizationId)
        )
      )
      .limit(1);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Update the title
    await db
      .update(iacConversations)
      .set({ 
        title: title.trim(),
        updatedAt: new Date()
      })
      .where(eq(iacConversations.id, id));

    res.json({ success: true, title: title.trim() });
  } catch (error) {
    console.error('Error updating conversation title:', error);
    res.status(500).json({ error: 'Failed to update conversation title' });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:id/messages', authMiddleware, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify conversation belongs to user
    const conversation = await db
      .select()
      .from(iacConversations)
      .where(
        and(
          eq(iacConversations.id, id),
          eq(iacConversations.userId, req.user.id),
          eq(iacConversations.organizationId, req.user.organizationId)
        )
      )
      .limit(1);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db
      .select()
      .from(iacMessages)
      .where(eq(iacMessages.conversationId, id))
      .orderBy(iacMessages.createdAt);

    res.json(messages);
  } catch (error) {
    console.error('Error fetching IAC messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message to the IAC AI assistant
router.post('/chat', authMiddleware, async (req: any, res: Response) => {
  try {
    const validatedData = sendMessageSchema.parse(req.body);
    
    // Get or create conversation
    let conversationId = validatedData.conversationId;
    if (!conversationId) {
      const [conversation] = await db
        .insert(iacConversations)
        .values({
          title: 'New IAC Conversation',
          userId: req.user.id,
          organizationId: req.user.organizationId,
        })
        .returning();
      conversationId = conversation.id;
    }

    // Verify conversation belongs to user
    const conversation = await db
      .select()
      .from(iacConversations)
      .where(
        and(
          eq(iacConversations.id, conversationId),
          eq(iacConversations.userId, req.user.id),
          eq(iacConversations.organizationId, req.user.organizationId)
        )
      )
      .limit(1);

    if (conversation.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Save user message
    const [userMessage] = await db
      .insert(iacMessages)
      .values({
        conversationId,
        role: 'user',
        content: validatedData.message,
        awsRegion: validatedData.awsRegion,
      })
      .returning();

    // Get conversation history
    const history = await db
      .select()
      .from(iacMessages)
      .where(eq(iacMessages.conversationId, conversationId))
      .orderBy(iacMessages.createdAt)
      .limit(10);

    // Get Anthropic client
    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'AI Assistant not configured',
        message: 'Please configure your Anthropic API key in Settings'
      });
    }

    // Build system prompt for Terraform generation
    const systemPrompt = `You are an AI assistant specialized in Infrastructure as Code (IaC) using Terraform.
    You help users create, modify, and deploy infrastructure on AWS using Terraform scripts.
    
    Your capabilities:
    - Generate Terraform configurations for AWS resources
    - Provide best practices for infrastructure design
    - Help with security configurations and compliance
    - Suggest optimizations for cost and performance
    - Generate complete, ready-to-deploy Terraform code
    
    Guidelines:
    - Always generate complete, valid Terraform code
    - Include proper provider configuration for AWS
    - Use appropriate resource naming conventions
    - Include security best practices (security groups, IAM roles, etc.)
    - Add comments explaining the infrastructure
    - Use variables for configurable values
    - Include outputs for important resource information
    - Generate code that follows Terraform best practices
    
    When generating Terraform code, wrap it in \`\`\`hcl blocks.
    Always provide a brief explanation of what the infrastructure does.
    
    Current AWS Region: ${validatedData.awsRegion || 'us-east-1'}
    
    Previous conversation:
    ${history.map(m => `${m.role}: ${m.content}`).join('\n')}`;

    // Call Claude API with retry logic for overload errors
    let response: any;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    while (retryCount <= maxRetries) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: validatedData.message,
            }
          ],
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        // Check if it's a 529 overload error and we have retries left
        if (error.status === 529 && retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`⚠️ Claude API overloaded (529), retrying in ${delay}ms (attempt ${retryCount}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // If it's not a 529 error or we've exhausted retries, throw the error
        console.error(`Failed after ${retryCount} retries:`, error);
        throw error;
      }
    }

    // Ensure response is defined (should never happen due to throw in catch, but satisfies TypeScript)
    if (!response) {
      throw new Error('Failed to get response from Claude API after all retries');
    }

    const assistantResponse = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract Terraform code if present
    let generatedTerraform = null;
    if (assistantResponse.includes('```hcl') || assistantResponse.includes('```terraform')) {
      const terraformMatch = assistantResponse.match(/```(?:hcl|terraform)\n([\s\S]*?)\n```/);
      if (terraformMatch) {
        generatedTerraform = terraformMatch[1];
      }
    }

    // Save assistant message
    const [assistantMessage] = await db
      .insert(iacMessages)
      .values({
        conversationId,
        role: 'assistant',
        content: assistantResponse,
        generatedTerraform,
        awsRegion: validatedData.awsRegion,
        deploymentStatus: 'pending',
      })
      .returning();

    // Update conversation title if it's the first message and title is still default
    if (history.length === 1) {
      const currentConversation = await db
        .select()
        .from(iacConversations)
        .where(eq(iacConversations.id, conversationId))
        .limit(1);
      
      if (currentConversation.length > 0 && 
          (currentConversation[0].title === 'New IAC Conversation' || !currentConversation[0].title)) {
        const title = validatedData.message.substring(0, 50) + (validatedData.message.length > 50 ? '...' : '');
        await db
          .update(iacConversations)
          .set({ title, updatedAt: new Date() })
          .where(eq(iacConversations.id, conversationId));
      } else {
        await db
          .update(iacConversations)
          .set({ updatedAt: new Date() })
          .where(eq(iacConversations.id, conversationId));
      }
    } else {
      await db
        .update(iacConversations)
        .set({ updatedAt: new Date() })
        .where(eq(iacConversations.id, conversationId));
    }

    res.json({
      userMessage,
      assistantMessage,
      generatedTerraform,
      conversationId,
    });
  } catch (error: any) {
    console.error('IAC chat error:', error);
    
    // Handle specific error types
    if (error.status === 529) {
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: 'Claude API is currently overloaded. Please try again in a few moments.',
        retryAfter: 30
      });
    } else if (error.status === 401) {
      res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid API key. Please check your Claude API configuration.'
      });
    } else if (error.status === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please wait before trying again.'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to process message',
        message: 'An unexpected error occurred. Please try again.'
      });
    }
  }
});

// Create a PR with generated Terraform code
router.post('/create-pr', authMiddleware, async (req: any, res: Response) => {
  try {
    const validatedData = createPRSchema.parse(req.body);
    
    // Get the message with generated Terraform
    const [message] = await db
      .select()
      .from(iacMessages)
      .where(
        and(
          eq(iacMessages.id, validatedData.messageId),
          eq(iacMessages.role, 'assistant')
        )
      )
      .limit(1);

    if (!message || !message.generatedTerraform) {
      return res.status(400).json({ error: 'No Terraform code found in message' });
    }

    // Get GitHub integration with decrypted token
    const githubService = new GitHubService();
    const integration = await githubService.getGitHubIntegration(
      validatedData.integrationId,
      req.user.organizationId
    );

    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const [owner, repo] = integration.repositoryFullName.split('/');

    // Create a new branch
    const branchName = `iac-${Date.now()}`;
    const commitMessage = validatedData.commitMessage || `Add Terraform infrastructure: ${message.content.substring(0, 50)}...`;

    // Create the branch first
    console.log(`Creating branch: ${branchName}`);
    await githubService.createBranch(
      integration.accessToken,
      owner,
      repo,
      branchName,
      validatedData.branch || integration.defaultBranch
    );

    // Create or update the Terraform file
    // Ensure the path doesn't start with / for GitHub API
    const basePath = integration.basePath ? (integration.basePath.startsWith('/') ? integration.basePath.slice(1) : integration.basePath) : 'configs';
    const terraformPath = `${basePath}/infrastructure/main.tf`;
    console.log(`Creating file: ${terraformPath} in branch: ${branchName}`);
    const result = await githubService.createOrUpdateFile(
      integration.accessToken,
      owner,
      repo,
      terraformPath,
      message.generatedTerraform,
      commitMessage,
      branchName
    );

    // Create pull request
    const prResult = await githubService.createPullRequest(
      integration.accessToken,
      owner,
      repo,
      {
        title: `Infrastructure: ${message.content.substring(0, 100)}...`,
        head: branchName,
        base: validatedData.branch,
        body: `This PR contains Terraform infrastructure generated by the IAC AI assistant.\n\n**Generated from conversation:** ${message.content}\n\n**Terraform Code:**\n\`\`\`hcl\n${message.generatedTerraform}\n\`\`\``,
      }
    );

    // Update message with PR information
    await db
      .update(iacMessages)
      .set({
        prNumber: prResult.number,
        prUrl: prResult.html_url,
        prStatus: 'open',
        updatedAt: new Date(),
      })
      .where(eq(iacMessages.id, validatedData.messageId));

    res.json({
      success: true,
      prNumber: prResult.number,
      prUrl: prResult.html_url,
      branchName,
      commitSha: result.sha,
    });
  } catch (error: any) {
    console.error('Error creating PR:', error);
    
    // Handle specific GitHub API errors
    if (error.message?.includes('GitHub API error: 422')) {
      res.status(422).json({ 
        error: 'Invalid request to GitHub',
        message: 'The request to GitHub was invalid. This might be due to branch conflicts or invalid file path.',
        details: error.message
      });
    } else if (error.message?.includes('GitHub API error: 409')) {
      res.status(409).json({ 
        error: 'Conflict with GitHub repository',
        message: 'There was a conflict with the GitHub repository. The branch might already exist.',
        details: error.message
      });
    } else if (error.message?.includes('GitHub API error: 404')) {
      res.status(404).json({ 
        error: 'Repository not found',
        message: 'The GitHub repository was not found. Please check your integration settings.',
        details: error.message
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to create pull request',
        message: 'An unexpected error occurred while creating the pull request.',
        details: error.message
      });
    }
  }
});

// Deploy Terraform (init, validate, plan, deploy)
router.post('/deploy', authMiddleware, async (req: any, res: Response) => {
  try {
    const validatedData = deployTerraformSchema.parse(req.body);
    
    // Get the message with generated Terraform
    const [message] = await db
      .select()
      .from(iacMessages)
      .where(
        and(
          eq(iacMessages.id, validatedData.messageId),
          eq(iacMessages.role, 'assistant')
        )
      )
      .limit(1);

    if (!message || !message.generatedTerraform) {
      return res.status(400).json({ error: 'No Terraform code found in message' });
    }

    // Update deployment status
    await db
      .update(iacMessages)
      .set({
        deploymentStatus: validatedData.action,
        awsRegion: validatedData.awsRegion,
        updatedAt: new Date(),
      })
      .where(eq(iacMessages.id, validatedData.messageId));

    // For now, simulate the deployment process
    // In a real implementation, you would:
    // 1. Create a temporary directory
    // 2. Write the Terraform files
    // 3. Run terraform init, validate, plan, apply
    // 4. Capture the output and state

    let result = '';
    switch (validatedData.action) {
      case 'init':
        result = 'Terraform initialized successfully';
        break;
      case 'validate':
        result = 'Terraform configuration is valid';
        break;
      case 'plan':
        result = 'Terraform plan generated successfully';
        break;
      case 'deploy':
        result = 'Terraform deployment completed successfully';
        break;
    }

    // Update message with deployment result
    await db
      .update(iacMessages)
      .set({
        terraformPlan: result,
        updatedAt: new Date(),
      })
      .where(eq(iacMessages.id, validatedData.messageId));

    res.json({
      success: true,
      action: validatedData.action,
      result,
      messageId: validatedData.messageId,
    });
  } catch (error) {
    console.error('Error deploying Terraform:', error);
    res.status(500).json({ error: 'Failed to deploy Terraform' });
  }
});

// Get PR status
router.get('/pr-status/:messageId', authMiddleware, async (req: any, res: Response) => {
  try {
    const { messageId } = req.params;
    
    const [message] = await db
      .select()
      .from(iacMessages)
      .where(eq(iacMessages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({
      prNumber: message.prNumber,
      prUrl: message.prUrl,
      prStatus: message.prStatus,
      deploymentStatus: message.deploymentStatus,
    });
  } catch (error) {
    console.error('Error fetching PR status:', error);
    res.status(500).json({ error: 'Failed to fetch PR status' });
  }
});

// Refresh PR status from GitHub
router.post('/refresh-pr-status/:messageId', authMiddleware, async (req: any, res: Response) => {
  try {
    const { messageId } = req.params;
    
    const [message] = await db
      .select()
      .from(iacMessages)
      .where(eq(iacMessages.id, messageId))
      .limit(1);

    if (!message || !message.prNumber) {
      return res.status(404).json({ error: 'Message or PR not found' });
    }

    // Get the GitHub integration for this message's conversation
    const [conversation] = await db
      .select()
      .from(iacConversations)
      .where(eq(iacConversations.id, message.conversationId))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get GitHub integration
    const githubService = new GitHubService();
    const integration = await githubService.getGitHubIntegration(
      req.body.integrationId || 'default', // You might need to pass this in the request
      req.user.organizationId
    );

    if (!integration) {
      return res.status(404).json({ error: 'GitHub integration not found' });
    }

    const [owner, repo] = integration.repositoryFullName.split('/');
    
    // Get PR status from GitHub
    const prStatus = await githubService.getPullRequestStatus(
      integration.accessToken,
      owner,
      repo,
      message.prNumber
    );

    // Determine the status based on GitHub response
    let newPrStatus: 'open' | 'merged' | 'closed' | 'draft';
    if (prStatus.merged) {
      newPrStatus = 'merged';
    } else if (prStatus.state === 'closed') {
      newPrStatus = 'closed';
    } else if (prStatus.state === 'open') {
      newPrStatus = 'open';
    } else {
      newPrStatus = 'draft';
    }

    // Update the message with new PR status
    await db
      .update(iacMessages)
      .set({
        prStatus: newPrStatus,
        updatedAt: new Date(),
      })
      .where(eq(iacMessages.id, messageId));

    res.json({
      success: true,
      prNumber: message.prNumber,
      prUrl: message.prUrl,
      prStatus: newPrStatus,
      merged: prStatus.merged,
      mergedAt: prStatus.merged_at,
      closedAt: prStatus.closed_at,
    });
  } catch (error: any) {
    console.error('Error refreshing PR status:', error);
    
    if (error.message?.includes('GitHub API error: 404')) {
      res.status(404).json({ 
        error: 'PR not found',
        message: 'The pull request was not found on GitHub. It may have been deleted.'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to refresh PR status',
        message: 'An error occurred while fetching the PR status from GitHub.'
      });
    }
  }
});

export default router;
