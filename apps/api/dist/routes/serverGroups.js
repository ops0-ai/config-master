"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverGroupRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.serverGroupRoutes = router;
const serverGroupSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().allow('').optional(),
    defaultPemKeyId: joi_1.default.string().uuid().allow('', null).optional(),
});
const serverGroupUpdateSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    description: joi_1.default.string().allow('').optional(),
    defaultPemKeyId: joi_1.default.string().uuid().allow('', null).optional(),
});
router.get('/', async (req, res) => {
    try {
        const groups = await index_1.db
            .select()
            .from(database_1.serverGroups)
            .where((0, drizzle_orm_1.eq)(database_1.serverGroups.organizationId, req.user.organizationId));
        res.json(groups);
    }
    catch (error) {
        console.error('Error fetching server groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
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
            organizationId: req.user.organizationId,
        };
        const newGroup = await index_1.db
            .insert(database_1.serverGroups)
            .values(groupData)
            .returning();
        res.status(201).json(newGroup[0]);
    }
    catch (error) {
        console.error('Error creating server group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { error, value } = serverGroupUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const existingGroup = await index_1.db
            .select()
            .from(database_1.serverGroups)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.serverGroups.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.serverGroups.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingGroup[0]) {
            return res.status(404).json({ error: 'Server group not found' });
        }
        // Handle empty strings and null values properly
        const updateData = { ...value, updatedAt: new Date() };
        if (updateData.hasOwnProperty('description')) {
            updateData.description = updateData.description || null;
        }
        if (updateData.hasOwnProperty('defaultPemKeyId')) {
            updateData.defaultPemKeyId = updateData.defaultPemKeyId === '' ? null : updateData.defaultPemKeyId;
        }
        const updatedGroup = await index_1.db
            .update(database_1.serverGroups)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(database_1.serverGroups.id, req.params.id))
            .returning();
        res.json(updatedGroup[0]);
    }
    catch (error) {
        console.error('Error updating server group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const existingGroup = await index_1.db
            .select()
            .from(database_1.serverGroups)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.serverGroups.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.serverGroups.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingGroup[0]) {
            return res.status(404).json({ error: 'Server group not found' });
        }
        // Check if any servers are still in this group
        const serversInGroup = await index_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.groupId, req.params.id))
            .limit(1);
        if (serversInGroup.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete server group that contains servers. Please remove all servers from the group first.'
            });
        }
        await index_1.db.delete(database_1.serverGroups).where((0, drizzle_orm_1.eq)(database_1.serverGroups.id, req.params.id));
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting server group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=serverGroups.js.map