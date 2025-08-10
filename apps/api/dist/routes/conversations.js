"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const ansible_engine_1 = require("@config-management/ansible-engine");
const router = (0, express_1.Router)();
exports.conversationRoutes = router;
const ansibleGenerator = process.env.OPENAI_API_KEY ? new ansible_engine_1.AnsibleGenerator(process.env.OPENAI_API_KEY) : null;
const messageSchema = joi_1.default.object({
    content: joi_1.default.string().required(),
    targetSystem: joi_1.default.string().valid('ubuntu', 'centos', 'debian', 'rhel', 'generic').default('ubuntu'),
    requirements: joi_1.default.array().items(joi_1.default.string()).optional(),
});
router.get('/', async (req, res) => {
    try {
        const conversationList = await index_1.db
            .select({
            id: database_1.conversations.id,
            title: database_1.conversations.title,
            isActive: database_1.conversations.isActive,
            createdAt: database_1.conversations.createdAt,
            updatedAt: database_1.conversations.updatedAt,
        })
            .from(database_1.conversations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.conversations.userId, req.user.id), (0, drizzle_orm_1.eq)(database_1.conversations.organizationId, req.user.organizationId)))
            .orderBy((0, drizzle_orm_1.desc)(database_1.conversations.updatedAt));
        res.json(conversationList);
    }
    catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', async (req, res) => {
    try {
        const newConversation = await index_1.db
            .insert(database_1.conversations)
            .values({
            userId: req.user.id,
            organizationId: req.user.organizationId,
            title: 'New Configuration Chat',
            isActive: true,
        })
            .returning();
        res.status(201).json(newConversation[0]);
    }
    catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id/messages', async (req, res) => {
    try {
        const conversation = await index_1.db
            .select()
            .from(database_1.conversations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.conversations.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.conversations.userId, req.user.id), (0, drizzle_orm_1.eq)(database_1.conversations.organizationId, req.user.organizationId)))
            .limit(1);
        if (!conversation[0]) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        const messageList = await index_1.db
            .select()
            .from(database_1.messages)
            .where((0, drizzle_orm_1.eq)(database_1.messages.conversationId, req.params.id))
            .orderBy(database_1.messages.createdAt);
        res.json(messageList);
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/messages', async (req, res) => {
    try {
        const { error, value } = messageSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const conversation = await index_1.db
            .select()
            .from(database_1.conversations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.conversations.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.conversations.userId, req.user.id), (0, drizzle_orm_1.eq)(database_1.conversations.organizationId, req.user.organizationId)))
            .limit(1);
        if (!conversation[0]) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        const userMessage = await index_1.db
            .insert(database_1.messages)
            .values({
            conversationId: req.params.id,
            role: 'user',
            content: value.content,
        })
            .returning();
        let title = conversation[0].title;
        if (title === 'New Configuration Chat') {
            title = value.content.substring(0, 50) + (value.content.length > 50 ? '...' : '');
            await index_1.db
                .update(database_1.conversations)
                .set({ title, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(database_1.conversations.id, req.params.id));
        }
        try {
            if (!ansibleGenerator) {
                throw new Error('OpenAI API key not configured');
            }
            const playbookGeneration = await ansibleGenerator.generatePlaybook({
                description: value.content,
                targetSystem: value.targetSystem,
                requirements: value.requirements || [],
            });
            const configuration = await index_1.db
                .insert(database_1.configurations)
                .values({
                name: `Config: ${title}`,
                description: value.content,
                type: 'generated',
                ansiblePlaybook: playbookGeneration.yaml,
                organizationId: req.user.organizationId,
                createdBy: req.user.id,
                isTemplate: false,
            })
                .returning();
            const assistantMessage = await index_1.db
                .insert(database_1.messages)
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
        }
        catch (aiError) {
            console.error('Error generating configuration:', aiError);
            const assistantMessage = await index_1.db
                .insert(database_1.messages)
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
    }
    catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const updateSchema = joi_1.default.object({
            title: joi_1.default.string().optional(),
            isActive: joi_1.default.boolean().optional(),
        });
        const { error, value } = updateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const conversation = await index_1.db
            .update(database_1.conversations)
            .set({
            ...value,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.conversations.id, req.params.id), (0, drizzle_orm_1.eq)(database_1.conversations.userId, req.user.id), (0, drizzle_orm_1.eq)(database_1.conversations.organizationId, req.user.organizationId)))
            .returning();
        if (!conversation[0]) {
            return res.status(404).json({ error: 'Conversation not found' });
        }
        res.json(conversation[0]);
    }
    catch (error) {
        console.error('Error updating conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=conversations.js.map