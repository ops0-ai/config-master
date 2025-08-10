"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pemKeyRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const keyManagement_1 = require("../utils/keyManagement");
const router = (0, express_1.Router)();
exports.pemKeyRoutes = router;
const pemKeySchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().optional(),
    privateKey: joi_1.default.string().required(),
});
router.get('/', async (req, res) => {
    try {
        const pemKeyList = await index_1.db
            .select({
            id: database_1.pemKeys.id,
            name: database_1.pemKeys.name,
            description: database_1.pemKeys.description,
            fingerprint: database_1.pemKeys.fingerprint,
            createdAt: database_1.pemKeys.createdAt,
            updatedAt: database_1.pemKeys.updatedAt,
        })
            .from(database_1.pemKeys)
            .where((0, drizzle_orm_1.eq)(database_1.pemKeys.organizationId, req.user.organizationId));
        res.json(pemKeyList);
    }
    catch (error) {
        console.error('Error fetching PEM keys:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const pemKey = await index_1.db
            .select({
            id: database_1.pemKeys.id,
            name: database_1.pemKeys.name,
            description: database_1.pemKeys.description,
            fingerprint: database_1.pemKeys.fingerprint,
            createdAt: database_1.pemKeys.createdAt,
            updatedAt: database_1.pemKeys.updatedAt,
        })
            .from(database_1.pemKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.pemKeys.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.pemKeys.organizationId, req.user.organizationId)))
            .limit(1);
        if (!pemKey[0]) {
            return res.status(404).json({ error: 'PEM key not found' });
        }
        res.json(pemKey[0]);
    }
    catch (error) {
        console.error('Error fetching PEM key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = pemKeySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        if (!value.privateKey.includes('BEGIN') || !value.privateKey.includes('PRIVATE KEY')) {
            return res.status(400).json({ error: 'Invalid private key format' });
        }
        const keyManager = keyManagement_1.SecureKeyManager.getInstance();
        const encryptionResult = keyManager.encryptPemKey(value.privateKey, req.user.organizationId);
        const encryptedPrivateKey = encryptionResult.encryptedKey;
        const fingerprint = encryptionResult.fingerprint;
        const newPemKey = await index_1.db
            .insert(database_1.pemKeys)
            .values({
            name: value.name,
            description: value.description,
            encryptedPrivateKey,
            fingerprint,
            organizationId: req.user.organizationId,
        })
            .returning({
            id: database_1.pemKeys.id,
            name: database_1.pemKeys.name,
            description: database_1.pemKeys.description,
            fingerprint: database_1.pemKeys.fingerprint,
            createdAt: database_1.pemKeys.createdAt,
        });
        res.status(201).json(newPemKey[0]);
    }
    catch (error) {
        console.error('Error creating PEM key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const updateSchema = joi_1.default.object({
            name: joi_1.default.string().optional(),
            description: joi_1.default.string().optional(),
        });
        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const existingPemKey = await index_1.db
            .select()
            .from(database_1.pemKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.pemKeys.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.pemKeys.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingPemKey[0]) {
            return res.status(404).json({ error: 'PEM key not found' });
        }
        const updatedPemKey = await index_1.db
            .update(database_1.pemKeys)
            .set({
            ...value,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, req.params.id))
            .returning({
            id: database_1.pemKeys.id,
            name: database_1.pemKeys.name,
            description: database_1.pemKeys.description,
            fingerprint: database_1.pemKeys.fingerprint,
            createdAt: database_1.pemKeys.createdAt,
            updatedAt: database_1.pemKeys.updatedAt,
        });
        res.json(updatedPemKey[0]);
    }
    catch (error) {
        console.error('Error updating PEM key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const existingPemKey = await index_1.db
            .select()
            .from(database_1.pemKeys)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.pemKeys.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.pemKeys.organizationId, req.user.organizationId)))
            .limit(1);
        if (!existingPemKey[0]) {
            return res.status(404).json({ error: 'PEM key not found' });
        }
        // Check if the key is being used by servers or server groups
        const [serversUsingKey, groupsUsingKey] = await Promise.all([
            index_1.db.select({ id: database_1.servers.id }).from(database_1.servers).where((0, drizzle_orm_1.eq)(database_1.servers.pemKeyId, req.params.id)),
            index_1.db.select({ id: database_1.serverGroups.id }).from(database_1.serverGroups).where((0, drizzle_orm_1.eq)(database_1.serverGroups.defaultPemKeyId, req.params.id))
        ]);
        if (serversUsingKey.length > 0 || groupsUsingKey.length > 0) {
            return res.status(400).json({
                error: `Cannot delete PEM key. It is being used by ${serversUsingKey.length} server(s) and ${groupsUsingKey.length} server group(s). Please remove the key from those resources first.`
            });
        }
        await index_1.db.delete(database_1.pemKeys).where((0, drizzle_orm_1.eq)(database_1.pemKeys.id, req.params.id));
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting PEM key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=pemKeys.js.map