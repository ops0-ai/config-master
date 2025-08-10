import { Router } from 'express';
import { db } from '../index';
import { configurations } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';

const router = Router();

const configurationSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  type: Joi.string().valid('playbook', 'role', 'task').required(),
  content: Joi.string().required(),
  variables: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

const configurationUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  type: Joi.string().valid('playbook', 'role', 'task').optional(),
  content: Joi.string().optional(),
  variables: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const configs = await db
      .select()
      .from(configurations)
      .where(eq(configurations.organizationId, req.user!.organizationId));
    
    // Map database field names to frontend field names
    const mappedConfigs = configs.map(config => ({
      ...config,
      content: config.ansiblePlaybook
    }));
    
    res.json(mappedConfigs);
  } catch (error) {
    console.error('Error fetching configurations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const config = await db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.id, req.params.id),
          eq(configurations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!config[0]) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Map database field names to frontend field names
    const mappedConfig = {
      ...config[0],
      content: config[0].ansiblePlaybook
    };

    res.json(mappedConfig);
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = configurationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const configData = {
      name: value.name,
      description: value.description || null,
      type: value.type,
      ansiblePlaybook: value.content, // Map content to ansiblePlaybook
      variables: value.variables || null,
      tags: value.tags || null,
      organizationId: req.user!.organizationId,
      createdBy: req.user!.id,
    };

    const newConfig = await db
      .insert(configurations)
      .values(configData)
      .returning();
    
    res.status(201).json(newConfig[0]);
  } catch (error) {
    console.error('Error creating configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = configurationUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingConfig = await db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.id, req.params.id),
          eq(configurations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingConfig[0]) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const updateData: any = { updatedAt: new Date() };
    
    // Map frontend field names to database field names
    if (value.hasOwnProperty('name')) {
      updateData.name = value.name;
    }
    if (value.hasOwnProperty('description')) {
      updateData.description = value.description || null;
    }
    if (value.hasOwnProperty('type')) {
      updateData.type = value.type;
    }
    if (value.hasOwnProperty('content')) {
      updateData.ansiblePlaybook = value.content; // Map content to ansiblePlaybook
    }
    if (value.hasOwnProperty('variables')) {
      updateData.variables = value.variables || null;
    }
    if (value.hasOwnProperty('tags')) {
      updateData.tags = value.tags || null;
    }

    const updatedConfig = await db
      .update(configurations)
      .set(updateData)
      .where(eq(configurations.id, req.params.id))
      .returning();

    res.json(updatedConfig[0]);
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const existingConfig = await db
      .select()
      .from(configurations)
      .where(
        and(
          eq(configurations.id, req.params.id),
          eq(configurations.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingConfig[0]) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    await db.delete(configurations).where(eq(configurations.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as configurationRoutes };