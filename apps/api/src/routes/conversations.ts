import { Router } from 'express';
import { db } from '../index';
import { conversations, messages, configurations } from '@config-management/database';
import { eq, and, desc } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
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

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.post('/', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.get('/:id/messages', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.post('/:id/messages', async (req: AuthenticatedRequest, res): Promise<any> => {
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

      const configuration = await db
        .insert(configurations)
        .values({
          name: `Config: ${title}`,
          description: value.content,
          type: 'generated',
          ansiblePlaybook: playbookGeneration.yaml,
          organizationId: req.user!.organizationId,
          createdBy: req.user!.id,
          isTemplate: false,
        })
        .returning();

      const assistantMessage = await db
        .insert(messages)
        .values({
          conversationId: req.params.id,
          role: 'assistant',
          content: playbookGeneration.explanation,
          generatedConfiguration: playbookGeneration.yaml,
          configurationId: configuration[0].id,
        })
        .returning();

      res.json({
        userMessage: userMessage[0],
        assistantMessage: assistantMessage[0],
        configuration: configuration[0],
      });
    } catch (aiError) {
      console.error('Error generating configuration:', aiError);
      
      const assistantMessage = await db
        .insert(messages)
        .values({
          conversationId: req.params.id,
          role: 'assistant',
          content: 'I apologize, but I encountered an error while generating the Ansible configuration. Please try rephrasing your request or provide more specific details about what you want to configure.',
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

router.put('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
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

router.delete('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // First delete all messages in the conversation
    await db
      .delete(messages)
      .where(eq(messages.conversationId, req.params.id));

    // Then delete the conversation
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

export { router as conversationRoutes };