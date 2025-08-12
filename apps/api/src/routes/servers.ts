import { Router } from 'express';
import { db } from '../index';
import { servers, serverGroups, pemKeys } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';
import { testServerConnection } from '../services/serverConnection';
import { encryptPassword, decryptPassword } from '../services/encryption';

const router = Router();

const serverSchema = Joi.object({
  name: Joi.string().required(),
  hostname: Joi.string().required(),
  ipAddress: Joi.string().ip().required(),
  port: Joi.number().integer().min(1).max(65535).optional(),
  type: Joi.string().valid('linux', 'windows').required(),
  username: Joi.string().required(),
  // For Windows servers - plain text password (will be encrypted)
  password: Joi.when('type', {
    is: 'windows',
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  // For Linux servers - PEM key ID
  pemKeyId: Joi.when('type', {
    is: 'linux',
    then: Joi.string().uuid().required(),
    otherwise: Joi.string().uuid().allow('').optional(),
  }),
  operatingSystem: Joi.string().allow('').optional(),
  osVersion: Joi.string().allow('').optional(),
  groupId: Joi.string().uuid().allow('').optional(),
  metadata: Joi.object().optional(),
});

const serverUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  hostname: Joi.string().optional(),
  ipAddress: Joi.string().ip().optional(),
  port: Joi.number().integer().min(1).max(65535).optional(),
  type: Joi.string().valid('linux', 'windows').optional(),
  username: Joi.string().optional(),
  // For Windows servers - password update
  password: Joi.string().optional(),
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
        type: servers.type,
        username: servers.username,
        operatingSystem: servers.operatingSystem,
        osVersion: servers.osVersion,
        status: servers.status,
        lastSeen: servers.lastSeen,
        groupId: servers.groupId,
        pemKeyId: servers.pemKeyId,
        // Note: We don't return encryptedPassword for security
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

    // Set default ports based on server type
    if (!value.port) {
      value.port = value.type === 'windows' ? 3389 : 22;
    }

    // Set default usernames based on server type
    if (!value.username) {
      value.username = value.type === 'windows' ? 'administrator' : 'root';
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

      // For Linux servers, use default PEM key from group if not specified
      if (value.type === 'linux' && !value.pemKeyId && group[0].defaultPemKeyId) {
        value.pemKeyId = group[0].defaultPemKeyId;
      }
    }

    // Validate PEM key for Linux servers
    if (value.type === 'linux' && value.pemKeyId) {
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

    // Encrypt password for Windows servers
    let encryptedPassword = null;
    if (value.type === 'windows' && value.password) {
      encryptedPassword = encryptPassword(value.password);
    }

    const newServer = await db
      .insert(servers)
      .values({
        name: value.name,
        hostname: value.hostname,
        ipAddress: value.ipAddress,
        port: value.port,
        type: value.type,
        username: value.username,
        encryptedPassword,
        operatingSystem: value.operatingSystem || null,
        osVersion: value.osVersion || null,
        groupId: value.groupId || null,
        pemKeyId: value.pemKeyId || null,
        organizationId: req.user!.organizationId,
        status: 'testing',
        metadata: value.metadata || null,
      })
      .returning();

    const connectionTest = await testServerConnection(
      newServer[0].ipAddress,
      newServer[0].port,
      newServer[0].username,
      newServer[0].type === 'linux' ? value.pemKeyId : null,
      req.user!.organizationId,
      newServer[0].type,
      newServer[0].type === 'windows' ? value.password : null
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
    const updateData: any = { updatedAt: new Date() };
    
    // Only update fields that are provided
    if (value.hasOwnProperty('name')) updateData.name = value.name;
    if (value.hasOwnProperty('hostname')) updateData.hostname = value.hostname;
    if (value.hasOwnProperty('ipAddress')) updateData.ipAddress = value.ipAddress;
    if (value.hasOwnProperty('port')) updateData.port = value.port;
    if (value.hasOwnProperty('type')) updateData.type = value.type;
    if (value.hasOwnProperty('username')) updateData.username = value.username;
    if (value.hasOwnProperty('metadata')) updateData.metadata = value.metadata;
    
    // Handle password for Windows servers
    if (value.hasOwnProperty('password') && value.password) {
      updateData.encryptedPassword = encryptPassword(value.password);
    }
    
    // Convert empty strings to null for optional fields
    if (value.hasOwnProperty('operatingSystem')) {
      updateData.operatingSystem = value.operatingSystem || null;
    }
    if (value.hasOwnProperty('osVersion')) {
      updateData.osVersion = value.osVersion || null;
    }
    if (value.hasOwnProperty('groupId')) {
      updateData.groupId = value.groupId === '' ? null : value.groupId;
    }
    if (value.hasOwnProperty('pemKeyId')) {
      updateData.pemKeyId = value.pemKeyId === '' ? null : value.pemKeyId;
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
    // Check if user has execute permission for servers
    const { hasPermission } = await import('../utils/rbacSeeder');
    const canExecute = await hasPermission(req.user!.id, 'servers', 'execute');
    
    if (!canExecute) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: { resource: 'servers', action: 'execute' }
      });
    }
    
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

    // Decrypt password for Windows servers if needed
    let password = null;
    if (server[0].type === 'windows' && server[0].encryptedPassword) {
      try {
        console.log(`🔐 Decrypting Windows password for server ${server[0].name}`);
        password = decryptPassword(server[0].encryptedPassword);
        console.log(`✅ Password decrypted successfully for ${server[0].name}`);
      } catch (error) {
        console.error('❌ Failed to decrypt server password:', error);
        return res.status(500).json({ error: 'Failed to decrypt server credentials' });
      }
    }

    const connectionTest = await testServerConnection(
      server[0].ipAddress,
      server[0].port,
      server[0].username,
      server[0].type === 'linux' ? server[0].pemKeyId : null,
      req.user!.organizationId,
      server[0].type,
      password
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