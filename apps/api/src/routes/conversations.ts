import { Router } from 'express';
import { db } from '../index';
import { conversations, messages, configurations, aiAssistantMessages } from '@config-management/database';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import { featureFlagMiddleware } from '../middleware/featureFlags';
import Joi from 'joi';
import { AnsibleGenerator } from '@config-management/ansible-engine';

const router = Router();

// Function to get the AnsibleGenerator with the current API key
function getAnsibleGenerator(): AnsibleGenerator | null {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.log('CLAUDE_API_KEY not found in environment');
  }
  return apiKey ? new AnsibleGenerator(apiKey) : null;
}

const messageSchema = Joi.object({
  content: Joi.string().required(),
  targetSystem: Joi.string().valid('ubuntu', 'centos', 'debian', 'rhel', 'generic').default('ubuntu'),
  requirements: Joi.array().items(Joi.string()).optional(),
});

router.get('/', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const conversationList = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        isActive: conversations.isActive,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, req.user!.id),
          eq(conversations.organizationId, req.user!.organizationId)
        )
      )
      .orderBy(desc(conversations.updatedAt));

    res.json(conversationList);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const newConversation = await db
      .insert(conversations)
      .values({
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        title: 'New Configuration Chat',
        isActive: true,
      })
      .returning();

    res.status(201).json(newConversation[0]);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/messages', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const conversation = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, req.params.id),
          eq(conversations.userId, req.user!.id),
          eq(conversations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!conversation[0]) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, req.params.id))
      .orderBy(messages.createdAt);

    res.json(messageList);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/messages', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = messageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const conversation = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, req.params.id),
          eq(conversations.userId, req.user!.id),
          eq(conversations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!conversation[0]) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const userMessage = await db
      .insert(messages)
      .values({
        conversationId: req.params.id,
        role: 'user',
        content: value.content,
      })
      .returning();

    let title = conversation[0].title;
    if (title === 'New Configuration Chat') {
      title = value.content.substring(0, 50) + (value.content.length > 50 ? '...' : '');
      await db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(conversations.id, req.params.id));
    }

    try {
      const ansibleGenerator = getAnsibleGenerator();
      if (!ansibleGenerator) {
        throw new Error('Claude API key not configured');
      }
      
      const playbookGeneration = await ansibleGenerator.generatePlaybook({
        description: value.content,
        targetSystem: value.targetSystem,
        requirements: value.requirements || [],
      });

      const assistantMessage = await db
        .insert(messages)
        .values({
          conversationId: req.params.id,
          role: 'assistant',
          content: playbookGeneration.explanation,
          generatedConfiguration: playbookGeneration.yaml,
          // No configurationId since we're not saving it automatically
        })
        .returning();

      res.json({
        userMessage: userMessage[0],
        assistantMessage: assistantMessage[0],
        generatedConfiguration: playbookGeneration.yaml,
        // Return the generated config but don't save it to database yet
      });
    } catch (aiError: any) {
      console.error('Error generating configuration:', aiError);
      
      // Provide specific error message for Claude API overload
      let errorMessage = 'I apologize, but I encountered an error while generating the Ansible configuration. Please try rephrasing your request or provide more specific details about what you want to configure.';
      
      if (aiError.message?.includes('Claude API is currently overloaded')) {
        errorMessage = 'Claude API is currently experiencing high demand and is overloaded. Please try again in a few minutes. The system will automatically retry, but you may need to wait a bit longer for a response.';
      }
      
      const assistantMessage = await db
        .insert(messages)
        .values({
          conversationId: req.params.id,
          role: 'assistant',
          content: errorMessage,
        })
        .returning();

      res.json({
        userMessage: userMessage[0],
        assistantMessage: assistantMessage[0],
        error: 'Failed to generate configuration',
      });
    }
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const updateSchema = Joi.object({
      title: Joi.string().optional(),
      isActive: Joi.boolean().optional(),
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const conversation = await db
      .update(conversations)
      .set({
        ...value,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, req.params.id),
          eq(conversations.userId, req.user!.id),
          eq(conversations.organizationId, req.user!.organizationId)
        )
      )
      .returning();

    if (!conversation[0]) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation[0]);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // First delete all AI assistant messages that reference this conversation
    await db
      .delete(aiAssistantMessages)
      .where(eq(aiAssistantMessages.conversationId, req.params.id));

    // Then delete all regular messages in the conversation
    await db
      .delete(messages)
      .where(eq(messages.conversationId, req.params.id));

    // Finally delete the conversation itself
    const deleted = await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, req.params.id),
          eq(conversations.userId, req.user!.id),
          eq(conversations.organizationId, req.user!.organizationId)
        )
      )
      .returning();

    if (!deleted[0]) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save generated configuration to configurations table
router.post('/:id/save-configuration', featureFlagMiddleware('chat'), async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const saveConfigSchema = Joi.object({
      configurationName: Joi.string().required(),
      generatedYaml: Joi.string().required(),
      description: Joi.string().optional(),
    });

    const { error, value } = saveConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const conversation = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, req.params.id),
          eq(conversations.userId, req.user!.id),
          eq(conversations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!conversation[0]) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Create configuration with conversation prefix
    const configName = `${req.params.id}-${value.configurationName}`;
    
    const configuration = await db
      .insert(configurations)
      .values({
        name: configName,
        description: value.description || 'Configuration created from conversation',
        type: 'playbook',
        ansiblePlaybook: value.generatedYaml,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.id,
        isTemplate: false,
        source: 'conversation',
        approvalStatus: 'pending',
      })
      .returning();

    // Update the message with the configuration ID
    await db
      .update(messages)
      .set({ 
        configurationId: configuration[0].id,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(messages.conversationId, req.params.id),
          eq(messages.generatedConfiguration, value.generatedYaml)
        )
      );

    res.json(configuration[0]);
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as conversationRoutes };