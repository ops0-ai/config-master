"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.deploymentRoutes = router;
const deploymentSchema = joi_1.default.object({
    name: joi_1.default.string().required(),
    description: joi_1.default.string().allow('').optional(),
    section: joi_1.default.string().default('general'),
    configurationId: joi_1.default.string().uuid().required(),
    targetType: joi_1.default.string().valid('server', 'serverGroup').required(),
    targetId: joi_1.default.string().uuid().required(),
});
router.get('/', async (req, res) => {
    try {
        const deploys = await index_1.db
            .select({
            id: database_1.deployments.id,
            name: database_1.deployments.name,
            description: database_1.deployments.description,
            section: database_1.deployments.section,
            version: database_1.deployments.version,
            parentDeploymentId: database_1.deployments.parentDeploymentId,
            configurationId: database_1.deployments.configurationId,
            targetType: database_1.deployments.targetType,
            targetId: database_1.deployments.targetId,
            status: database_1.deployments.status,
            logs: database_1.deployments.logs,
            startedAt: database_1.deployments.startedAt,
            completedAt: database_1.deployments.completedAt,
            createdAt: database_1.deployments.createdAt,
            configuration: {
                id: database_1.configurations.id,
                name: database_1.configurations.name,
                type: database_1.configurations.type,
            },
            server: {
                id: database_1.servers.id,
                name: database_1.servers.name,
            },
            serverGroup: {
                id: database_1.serverGroups.id,
                name: database_1.serverGroups.name,
            },
        })
            .from(database_1.deployments)
            .leftJoin(database_1.configurations, (0, drizzle_orm_1.eq)(database_1.deployments.configurationId, database_1.configurations.id))
            .leftJoin(database_1.servers, (0, drizzle_orm_1.eq)(database_1.deployments.targetId, database_1.servers.id))
            .leftJoin(database_1.serverGroups, (0, drizzle_orm_1.eq)(database_1.deployments.targetId, database_1.serverGroups.id))
            .where((0, drizzle_orm_1.eq)(database_1.deployments.organizationId, req.user.organizationId))
            .orderBy(database_1.deployments.createdAt);
        // Format the response to include target info
        const formattedDeployments = deploys.map(deploy => ({
            ...deploy,
            target: deploy.targetType === 'server' && deploy.server?.id
                ? { id: deploy.server.id, name: deploy.server.name, type: 'server' }
                : deploy.targetType === 'serverGroup' && deploy.serverGroup?.id
                    ? { id: deploy.serverGroup.id, name: deploy.serverGroup.name, type: 'serverGroup' }
                    : null,
            server: undefined,
            serverGroup: undefined,
        }));
        res.json(formattedDeployments);
    }
    catch (error) {
        console.error('Error fetching deployments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const deploy = await index_1.db
            .select()
            .from(database_1.deployments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.deployments.organizationId, req.user.organizationId)))
            .limit(1);
        if (!deploy[0]) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        res.json(deploy[0]);
    }
    catch (error) {
        console.error('Error fetching deployment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = deploymentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        // Verify configuration exists
        const config = await index_1.db
            .select()
            .from(database_1.configurations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.configurations.id, value.configurationId), (0, drizzle_orm_1.eq)(database_1.configurations.organizationId, req.user.organizationId)))
            .limit(1);
        if (!config[0]) {
            return res.status(400).json({ error: 'Configuration not found' });
        }
        // Verify target exists
        if (value.targetType === 'server') {
            const server = await index_1.db
                .select()
                .from(database_1.servers)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.servers.id, value.targetId), (0, drizzle_orm_1.eq)(database_1.servers.organizationId, req.user.organizationId)))
                .limit(1);
            if (!server[0]) {
                return res.status(400).json({ error: 'Server not found' });
            }
        }
        else {
            const group = await index_1.db
                .select()
                .from(database_1.serverGroups)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.serverGroups.id, value.targetId), (0, drizzle_orm_1.eq)(database_1.serverGroups.organizationId, req.user.organizationId)))
                .limit(1);
            if (!group[0]) {
                return res.status(400).json({ error: 'Server group not found' });
            }
        }
        // Check if this is a redeploy (same name + config + target)
        const existingDeployments = await index_1.db
            .select()
            .from(database_1.deployments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.deployments.name, value.name), (0, drizzle_orm_1.eq)(database_1.deployments.configurationId, value.configurationId), (0, drizzle_orm_1.eq)(database_1.deployments.targetId, value.targetId), (0, drizzle_orm_1.eq)(database_1.deployments.organizationId, req.user.organizationId)))
            .orderBy(database_1.deployments.version);
        const nextVersion = existingDeployments.length > 0
            ? Math.max(...existingDeployments.map(d => d.version || 1)) + 1
            : 1;
        const parentDeploymentId = existingDeployments.length > 0
            ? existingDeployments[0].id
            : null;
        const deploymentData = {
            ...value,
            description: value.description || null,
            section: value.section || 'general',
            version: nextVersion,
            parentDeploymentId,
            organizationId: req.user.organizationId,
            executedBy: req.user.id,
            status: 'pending',
        };
        const newDeployment = await index_1.db
            .insert(database_1.deployments)
            .values(deploymentData)
            .returning();
        res.status(201).json(newDeployment[0]);
    }
    catch (error) {
        console.error('Error creating deployment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/run', async (req, res) => {
    try {
        // Check if user has execute permission for deployments
        const { hasPermission } = await Promise.resolve().then(() => __importStar(require('../utils/rbacSeeder')));
        const canExecute = await hasPermission(req.user.id, 'deployments', 'execute');
        if (!canExecute) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: { resource: 'deployments', action: 'execute' }
            });
        }
        const deployment = await index_1.db
            .select()
            .from(database_1.deployments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.deployments.organizationId, req.user.organizationId)))
            .limit(1);
        if (!deployment[0]) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        let targetDeployment = deployment[0];
        // If this is a redeployment (completed/failed), create a new version
        if (['completed', 'failed', 'cancelled'].includes(deployment[0].status)) {
            console.log(`Creating new deployment version for redeployment of ${deployment[0].name}`);
            const newVersion = deployment[0].version + 1;
            const newDeploymentData = {
                name: deployment[0].name,
                description: deployment[0].description,
                section: deployment[0].section,
                version: newVersion,
                parentDeploymentId: deployment[0].parentDeploymentId || deployment[0].id,
                configurationId: deployment[0].configurationId,
                targetType: deployment[0].targetType,
                targetId: deployment[0].targetId,
                status: 'running',
                startedAt: new Date(),
                logs: `🔄 Redeployment v${newVersion} started...\n`,
                executedBy: req.user.id,
                organizationId: req.user.organizationId,
            };
            const newDeployment = await index_1.db
                .insert(database_1.deployments)
                .values(newDeploymentData)
                .returning();
            targetDeployment = newDeployment[0];
        }
        else {
            // For pending deployments, just update the existing one
            if (deployment[0].status === 'running') {
                return res.status(400).json({ error: 'Deployment is already running' });
            }
            await index_1.db
                .update(database_1.deployments)
                .set({
                status: 'running',
                startedAt: new Date(),
                logs: 'Deployment started...\n',
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id));
        }
        // Execute actual Ansible deployment
        const { AnsibleExecutionService } = await Promise.resolve().then(() => __importStar(require('../services/ansibleExecution')));
        const ansibleService = AnsibleExecutionService.getInstance();
        // Run deployment asynchronously
        (async () => {
            try {
                await ansibleService.executePlaybook({
                    deploymentId: targetDeployment.id,
                    configurationId: targetDeployment.configurationId,
                    targetType: targetDeployment.targetType,
                    targetId: targetDeployment.targetId,
                    organizationId: targetDeployment.organizationId,
                    onProgress: async (logs) => {
                        try {
                            // Update logs in real-time
                            const currentDeployment = await index_1.db
                                .select()
                                .from(database_1.deployments)
                                .where((0, drizzle_orm_1.eq)(database_1.deployments.id, targetDeployment.id))
                                .limit(1);
                            if (currentDeployment[0]) {
                                await index_1.db
                                    .update(database_1.deployments)
                                    .set({
                                    logs: (currentDeployment[0].logs || '') + logs,
                                    updatedAt: new Date(),
                                })
                                    .where((0, drizzle_orm_1.eq)(database_1.deployments.id, targetDeployment.id));
                            }
                        }
                        catch (error) {
                            console.error('Error updating deployment logs:', error);
                        }
                    }
                });
                // Mark as completed
                await index_1.db
                    .update(database_1.deployments)
                    .set({
                    status: 'completed',
                    completedAt: new Date(),
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(database_1.deployments.id, targetDeployment.id));
            }
            catch (error) {
                console.error('Ansible execution error:', error);
                // Mark as failed with error message
                await index_1.db
                    .update(database_1.deployments)
                    .set({
                    status: 'failed',
                    completedAt: new Date(),
                    logs: `\n❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(database_1.deployments.id, targetDeployment.id));
            }
        })().catch((error) => {
            // Additional safety net to prevent uncaught promise rejections
            console.error('Deployment execution error:', error);
        });
        res.json({ message: 'Deployment started' });
    }
    catch (error) {
        console.error('Error running deployment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/cancel', async (req, res) => {
    try {
        // Check if user has execute permission for deployments
        const { hasPermission } = await Promise.resolve().then(() => __importStar(require('../utils/rbacSeeder')));
        const canExecute = await hasPermission(req.user.id, 'deployments', 'execute');
        if (!canExecute) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: { resource: 'deployments', action: 'execute' }
            });
        }
        const deployment = await index_1.db
            .select()
            .from(database_1.deployments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.deployments.organizationId, req.user.organizationId)))
            .limit(1);
        if (!deployment[0]) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        if (!['pending', 'running'].includes(deployment[0].status)) {
            return res.status(400).json({ error: 'Deployment cannot be cancelled' });
        }
        // Try to cancel running Ansible process
        const { AnsibleExecutionService } = await Promise.resolve().then(() => __importStar(require('../services/ansibleExecution')));
        const ansibleService = AnsibleExecutionService.getInstance();
        const processCancelled = ansibleService.cancelDeployment(req.params.id);
        await index_1.db
            .update(database_1.deployments)
            .set({
            status: 'cancelled',
            completedAt: new Date(),
            logs: (deployment[0].logs || '') +
                (processCancelled
                    ? '\n\n🛑 Deployment cancelled by user (process terminated)'
                    : '\n\n🛑 Deployment cancelled by user'),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id));
        res.json({ message: 'Deployment cancelled' });
    }
    catch (error) {
        console.error('Error cancelling deployment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const deployment = await index_1.db
            .select()
            .from(database_1.deployments)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.deployments.organizationId, req.user.organizationId)))
            .limit(1);
        if (!deployment[0]) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        if (deployment[0].status === 'running') {
            return res.status(400).json({ error: 'Cannot delete a running deployment' });
        }
        await index_1.db.delete(database_1.deployments).where((0, drizzle_orm_1.eq)(database_1.deployments.id, req.params.id));
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting deployment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=deployments.js.map