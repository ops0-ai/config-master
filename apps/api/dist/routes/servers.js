"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const serverConnection_1 = require("../services/serverConnection");
const router = (0, express_1.Router)();
exports.serverRoutes = router;
const serverSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    hostname: joi_1.default.string().required(),
    ipAddress: joi_1.default.string().ip().required(),
    port: joi_1.default.number().integer().min(1).max(65535).default(22),
    username: joi_1.default.string().default('root'),
    operatingSystem: joi_1.default.string().allow('').optional(),
    osVersion: joi_1.default.string().allow('').optional(),
    groupId: joi_1.default.string().uuid().allow('').optional(),
    pemKeyId: joi_1.default.string().uuid().allow('').optional(),
    metadata: joi_1.default.object().optional(),
});
const serverUpdateSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    hostname: joi_1.default.string().optional(),
    ipAddress: joi_1.default.string().ip().optional(),
    port: joi_1.default.number().integer().min(1).max(65535).optional(),
    username: joi_1.default.string().optional(),
    operatingSystem: joi_1.default.string().allow('').optional(),
    osVersion: joi_1.default.string().allow('').optional(),
    groupId: joi_1.default.string().uuid().allow('', null).optional(),
    pemKeyId: joi_1.default.string().uuid().allow('', null).optional(),
    metadata: joi_1.default.object().optional(),
});
router.get('/', async (req, res) => {
    try {
        const serverList = await index_1.db
            .select({
            id: database_1.servers.id,
            name: database_1.servers.name,
            hostname: database_1.servers.hostname,
            ipAddress: database_1.servers.ipAddress,
            port: database_1.servers.port,
            username: database_1.servers.username,
            operatingSystem: database_1.servers.operatingSystem,
            osVersion: database_1.servers.osVersion,
            status: database_1.servers.status,
            lastSeen: database_1.servers.lastSeen,
            groupId: database_1.servers.groupId,
            pemKeyId: database_1.servers.pemKeyId,
            metadata: database_1.servers.metadata,
            createdAt: database_1.servers.createdAt,
            updatedAt: database_1.servers.updatedAt,
            group: {
                id: database_1.serverGroups.id,
                name: database_1.serverGroups.name,
            },
            pemKey: {
                id: database_1.pemKeys.id,
                name: database_1.pemKeys.name,
            },
        })
            .from(database_1.servers)
            .leftJoin(database_1.serverGroups, (0, drizzle_orm_1.eq)(database_1.servers.groupId, database_1.serverGroups.id))
            .leftJoin(database_1.pemKeys, (0, drizzle_orm_1.eq)(database_1.servers.pemKeyId, database_1.pemKeys.id))
            .where((0, drizzle_orm_1.eq)(database_1.servers.organizationId, req.user.organizationId));
        res.json(serverList);
    }
    catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const server = await index_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, req.user.organizationId)))
            .limit(1);
        if (!server[0]) {
            return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server[0]);
    }
    catch (error) {
        console.error('Error fetching server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = serverSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        if (value.groupId) {
            const group = await index_1.db
                .select()
                .from(database_1.serverGroups)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.serverGroups.id, value.groupId), (0, drizzle_orm_1.eq)(database_1.serverGroups.organizationId, req.user.organizationId)))
                .limit(1);
            if (!group[0]) {
                return res.status(400).json({ error: 'Invalid server group' });
            }
            if (!value.pemKeyId && group[0].defaultPemKeyId) {
                value.pemKeyId = group[0].defaultPemKeyId;
            }
        }
        if (value.pemKeyId) {
            const pemKey = await index_1.db
                .select()
                .from(database_1.pemKeys)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.pemKeys.id, value.pemKeyId), (0, drizzle_orm_1.eq)(database_1.pemKeys.organizationId, req.user.organizationId)))
                .limit(1);
            if (!pemKey[0]) {
                return res.status(400).json({ error: 'Invalid PEM key' });
            }
        }
        const newServer = await index_1.db
            .insert(database_1.servers)
            .values({
            ...value,
            operatingSystem: value.operatingSystem || null,
            osVersion: value.osVersion || null,
            groupId: value.groupId || null,
            pemKeyId: value.pemKeyId || null,
            organizationId: req.user.organizationId,
            status: 'testing',
        })
            .returning();
        const connectionTest = await (0, serverConnection_1.testServerConnection)(newServer[0].ipAddress, newServer[0].port, newServer[0].username, value.pemKeyId, req.user.organizationId);
        await index_1.db
            .update(database_1.servers)
            .set({
            status: connectionTest.success ? 'online' : 'offline',
            lastSeen: connectionTest.success ? new Date() : null,
            operatingSystem: connectionTest.osInfo?.platform,
            osVersion: connectionTest.osInfo?.release,
        })
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, newServer[0].id));
        res.status(201).json({
            ...newServer[0],
            connectionTest,
        });
    }
    catch (error) {
        console.error('Error creating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { error, value } = serverUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const existingServer = await index_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingServer[0]) {
            return res.status(404).json({ error: 'Server not found' });
        }
        // Handle empty strings and null values properly
        const updateData = { ...value, updatedAt: new Date() };
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
        const updatedServer = await index_1.db
            .update(database_1.servers)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, req.params.id))
            .returning();
        res.json(updatedServer[0]);
    }
    catch (error) {
        console.error('Error updating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const existingServer = await index_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingServer[0]) {
            return res.status(404).json({ error: 'Server not found' });
        }
        await index_1.db.delete(database_1.servers).where((0, drizzle_orm_1.eq)(database_1.servers.id, req.params.id));
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/test-connection', async (req, res) => {
    try {
        const server = await index_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, req.user.organizationId)))
            .limit(1);
        if (!server[0]) {
            return res.status(404).json({ error: 'Server not found' });
        }
        const connectionTest = await (0, serverConnection_1.testServerConnection)(server[0].ipAddress, server[0].port, server[0].username, server[0].pemKeyId, req.user.organizationId);
        await index_1.db
            .update(database_1.servers)
            .set({
            status: connectionTest.success ? 'online' : 'offline',
            lastSeen: connectionTest.success ? new Date() : null,
            operatingSystem: connectionTest.osInfo?.platform,
            osVersion: connectionTest.osInfo?.release,
        })
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, server[0].id));
        res.json(connectionTest);
    }
    catch (error) {
        console.error('Error testing server connection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=servers.js.map