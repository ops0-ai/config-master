import { Router } from 'express';
import { db } from '../index';
import { servers, serverGroups, pemKeys } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import { testServerConnection } from '../services/serverConnection';

const router = Router();

const serverSchema = Joi.object({
  name: Joi.string().required(),
  hostname: Joi.string().required(),
  ipAddress: Joi.string().ip().required(),
  port: Joi.number().integer().min(1).max(65535).default(22),
  username: Joi.string().default('root'),
  operatingSystem: Joi.string().allow('').optional(),
  osVersion: Joi.string().allow('').optional(),
  groupId: Joi.string().uuid().allow('').optional(),
  pemKeyId: Joi.string().uuid().allow('').optional(),
  metadata: Joi.object().optional(),
});

const serverUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  hostname: Joi.string().optional(),
  ipAddress: Joi.string().ip().optional(),
  port: Joi.number().integer().min(1).max(65535).optional(),
  username: Joi.string().optional(),
  operatingSystem: Joi.string().allow('').optional(),
  osVersion: Joi.string().allow('').optional(),
  groupId: Joi.string().uuid().allow('', null).optional(),
  pemKeyId: Joi.string().uuid().allow('', null).optional(),
  metadata: Joi.object().optional(),
});

router.get('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const serverList = await db
      .select({
        id: servers.id,
        name: servers.name,
        hostname: servers.hostname,
        ipAddress: servers.ipAddress,
        port: servers.port,
        username: servers.username,
        operatingSystem: servers.operatingSystem,
        osVersion: servers.osVersion,
        status: servers.status,
        lastSeen: servers.lastSeen,
        groupId: servers.groupId,
        pemKeyId: servers.pemKeyId,
        metadata: servers.metadata,
        createdAt: servers.createdAt,
        updatedAt: servers.updatedAt,
        group: {
          id: serverGroups.id,
          name: serverGroups.name,
        },
        pemKey: {
          id: pemKeys.id,
          name: pemKeys.name,
        },
      })
      .from(servers)
      .leftJoin(serverGroups, eq(servers.groupId, serverGroups.id))
      .leftJoin(pemKeys, eq(servers.pemKeyId, pemKeys.id))
      .where(eq(servers.organizationId, req.user!.organizationId));

    res.json(serverList);
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const server = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.id, req.params.id),
          eq(servers.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!server[0]) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(server[0]);
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = serverSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (value.groupId) {
      const group = await db
        .select()
        .from(serverGroups)
        .where(
          and(
            eq(serverGroups.id, value.groupId),
            eq(serverGroups.organizationId, req.user!.organizationId)
          )
        )
        .limit(1);

      if (!group[0]) {
        return res.status(400).json({ error: 'Invalid server group' });
      }

      if (!value.pemKeyId && group[0].defaultPemKeyId) {
        value.pemKeyId = group[0].defaultPemKeyId;
      }
    }

    if (value.pemKeyId) {
      const pemKey = await db
        .select()
        .from(pemKeys)
        .where(
          and(
            eq(pemKeys.id, value.pemKeyId),
            eq(pemKeys.organizationId, req.user!.organizationId)
          )
        )
        .limit(1);

      if (!pemKey[0]) {
        return res.status(400).json({ error: 'Invalid PEM key' });
      }
    }

    const newServer = await db
      .insert(servers)
      .values({
        ...value,
        operatingSystem: value.operatingSystem || null,
        osVersion: value.osVersion || null,
        groupId: value.groupId || null,
        pemKeyId: value.pemKeyId || null,
        organizationId: req.user!.organizationId,
        status: 'testing',
      })
      .returning();

    const connectionTest = await testServerConnection(
      newServer[0].ipAddress,
      newServer[0].port,
      newServer[0].username,
      value.pemKeyId,
      req.user!.organizationId
    );

    await db
      .update(servers)
      .set({
        status: connectionTest.success ? 'online' : 'offline',
        lastSeen: connectionTest.success ? new Date() : null,
        operatingSystem: connectionTest.osInfo?.platform,
        osVersion: connectionTest.osInfo?.release,
      })
      .where(eq(servers.id, newServer[0].id));

    res.status(201).json({
      ...newServer[0],
      connectionTest,
    });
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const { error, value } = serverUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingServer = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.id, req.params.id),
          eq(servers.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingServer[0]) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Handle empty strings and null values properly
    const updateData: any = { ...value, updatedAt: new Date() };
    
    // Convert empty strings to null for optional fields
    if (updateData.hasOwnProperty('operatingSystem')) {
      updateData.operatingSystem = updateData.operatingSystem || null;
    }
    if (updateData.hasOwnProperty('osVersion')) {
      updateData.osVersion = updateData.osVersion || null;
    }
    if (updateData.hasOwnProperty('groupId')) {
      updateData.groupId = updateData.groupId === '' ? null : updateData.groupId;
    }
    if (updateData.hasOwnProperty('pemKeyId')) {
      updateData.pemKeyId = updateData.pemKeyId === '' ? null : updateData.pemKeyId;
    }

    const updatedServer = await db
      .update(servers)
      .set(updateData)
      .where(eq(servers.id, req.params.id))
      .returning();

    res.json(updatedServer[0]);
  } catch (error) {
    console.error('Error updating server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const existingServer = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.id, req.params.id),
          eq(servers.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!existingServer[0]) {
      return res.status(404).json({ error: 'Server not found' });
    }

    await db.delete(servers).where(eq(servers.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/test-connection', async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const server = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.id, req.params.id),
          eq(servers.organizationId, req.user!.organizationId)
        )
      )
      .limit(1);

    if (!server[0]) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const connectionTest = await testServerConnection(
      server[0].ipAddress,
      server[0].port,
      server[0].username,
      server[0].pemKeyId,
      req.user!.organizationId
    );

    await db
      .update(servers)
      .set({
        status: connectionTest.success ? 'online' : 'offline',
        lastSeen: connectionTest.success ? new Date() : null,
        operatingSystem: connectionTest.osInfo?.platform,
        osVersion: connectionTest.osInfo?.release,
      })
      .where(eq(servers.id, server[0].id));

    res.json(connectionTest);
  } catch (error) {
    console.error('Error testing server connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as serverRoutes };