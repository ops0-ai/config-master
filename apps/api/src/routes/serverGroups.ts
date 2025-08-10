import { Router } from 'express';
import { db } from '../index';
import { serverGroups, servers } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';

const router = Router();

const serverGroupSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  defaultPemKeyId: Joi.string().uuid().allow('', null).optional(),
});

const serverGroupUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  defaultPemKeyId: Joi.string().uuid().allow('', null).optional(),
});

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const groups = await db
      .select()
      .from(serverGroups)
      .where(eq(serverGroups.organizationId, req.user!.organizationId));
    
    res.json(groups);
  } catch (error) {
    console.error('Error fetching server groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = serverGroupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Handle empty string/null conversion
    const groupData = {
      ...value,
      description: value.description || null,
      defaultPemKeyId: value.defaultPemKeyId === '' ? null : value.defaultPemKeyId,
      organizationId: req.user!.organizationId,
    };

    const newGroup = await db
      .insert(serverGroups)
      .values(groupData)
      .returning();
    
    res.status(201).json(newGroup[0]);
  } catch (error) {
    console.error('Error creating server group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = serverGroupUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingGroup = await db
      .select()
      .from(serverGroups)
      .where(
        and(
          eq(serverGroups.id, req.params.id),
          eq(serverGroups.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingGroup[0]) {
      return res.status(404).json({ error: 'Server group not found' });
    }

    // Handle empty strings and null values properly
    const updateData: any = { ...value, updatedAt: new Date() };
    
    if (updateData.hasOwnProperty('description')) {
      updateData.description = updateData.description || null;
    }
    if (updateData.hasOwnProperty('defaultPemKeyId')) {
      updateData.defaultPemKeyId = updateData.defaultPemKeyId === '' ? null : updateData.defaultPemKeyId;
    }

    const updatedGroup = await db
      .update(serverGroups)
      .set(updateData)
      .where(eq(serverGroups.id, req.params.id))
      .returning();

    res.json(updatedGroup[0]);
  } catch (error) {
    console.error('Error updating server group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const existingGroup = await db
      .select()
      .from(serverGroups)
      .where(
        and(
          eq(serverGroups.id, req.params.id),
          eq(serverGroups.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingGroup[0]) {
      return res.status(404).json({ error: 'Server group not found' });
    }

    // Check if any servers are still in this group
    const serversInGroup = await db
      .select()
      .from(servers)
      .where(eq(servers.groupId, req.params.id))
      .limit(1);

    if (serversInGroup.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete server group that contains servers. Please remove all servers from the group first.' 
      });
    }

    await db.delete(serverGroups).where(eq(serverGroups.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting server group:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as serverGroupRoutes };