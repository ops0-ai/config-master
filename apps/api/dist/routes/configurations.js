"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurationRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.configurationRoutes = router;
const configurationSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().allow('').optional(),
    type: joi_1.default.string().valid('playbook', 'role', 'task').required(),
    content: joi_1.default.string().required(),
    variables: joi_1.default.object().optional(),
    tags: joi_1.default.array().items(joi_1.default.string()).optional(),
});
const configurationUpdateSchema = joi_1.default.object({
    name: joi_1.default.string().optional(),
    description: joi_1.default.string().allow('').optional(),
    type: joi_1.default.string().valid('playbook', 'role', 'task').optional(),
    content: joi_1.default.string().optional(),
    variables: joi_1.default.object().optional(),
    tags: joi_1.default.array().items(joi_1.default.string()).optional(),
});
router.get('/', async (req, res) => {
    try {
        const configs = await index_1.db
            .select()
            .from(database_1.configurations)
            .where((0, drizzle_orm_1.eq)(database_1.configurations.organizationId, req.user.organizationId));
        // Map database field names to frontend field names
        const mappedConfigs = configs.map(config => ({
            ...config,
            content: config.ansiblePlaybook
        }));
        res.json(mappedConfigs);
    }
    catch (error) {
        console.error('Error fetching configurations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const config = await index_1.db
            .select()
            .from(database_1.configurations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.configurations.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.configurations.organizationId, req.user.organizationId)))
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
    }
    catch (error) {
        console.error('Error fetching configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
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
            organizationId: req.user.organizationId,
            createdBy: req.user.id,
        };
        const newConfig = await index_1.db
            .insert(database_1.configurations)
            .values(configData)
            .returning();
        res.status(201).json(newConfig[0]);
    }
    catch (error) {
        console.error('Error creating configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { error, value } = configurationUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const existingConfig = await index_1.db
            .select()
            .from(database_1.configurations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.configurations.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.configurations.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingConfig[0]) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        const updateData = { updatedAt: new Date() };
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
        const updatedConfig = await index_1.db
            .update(database_1.configurations)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(database_1.configurations.id, req.params.id))
            .returning();
        res.json(updatedConfig[0]);
    }
    catch (error) {
        console.error('Error updating configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const existingConfig = await index_1.db
            .select()
            .from(database_1.configurations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.configurations.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.configurations.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingConfig[0]) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        await index_1.db.delete(database_1.configurations).where((0, drizzle_orm_1.eq)(database_1.configurations.id, req.params.id));
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=configurations.js.map