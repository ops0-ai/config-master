"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
exports.authRoutes = router;
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    name: joi_1.default.string().required(),
    organizationName: joi_1.default.string().required(),
});
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
});
router.post('/register', async (req, res) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        // Check if user exists
        const existingUser = await index_1.db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.eq)(database_1.users.email, value.email))
            .limit(1);
        if (existingUser[0]) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const passwordHash = await bcryptjs_1.default.hash(value.password, 10);
        // Create user and organization in transaction
        const newUser = await index_1.db.insert(database_1.users).values({
            email: value.email,
            name: value.name,
            passwordHash,
            role: 'admin',
        }).returning();
        const newOrg = await index_1.db.insert(database_1.organizations).values({
            name: value.organizationName,
            ownerId: newUser[0].id,
        }).returning();
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({
            userId: newUser[0].id,
            email: newUser[0].email,
            organizationId: newOrg[0].id,
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: {
                id: newUser[0].id,
                email: newUser[0].email,
                name: newUser[0].name,
                role: newUser[0].role,
            },
            organization: {
                id: newOrg[0].id,
                name: newOrg[0].name,
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        // Find user
        const user = await index_1.db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.eq)(database_1.users.email, value.email))
            .limit(1);
        if (!user[0]) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(value.password, user[0].passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Get user's organization (either owned by user or user is a member)
        let org;
        if (user[0].organizationId) {
            // User has organizationId set, use that
            org = await index_1.db
                .select()
                .from(database_1.organizations)
                .where((0, drizzle_orm_1.eq)(database_1.organizations.id, user[0].organizationId))
                .limit(1);
        }
        else {
            // Fallback: find organization owned by user
            org = await index_1.db
                .select()
                .from(database_1.organizations)
                .where((0, drizzle_orm_1.eq)(database_1.organizations.ownerId, user[0].id))
                .limit(1);
        }
        if (!org[0]) {
            return res.status(500).json({ error: 'Organization not found' });
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({
            userId: user[0].id,
            email: user[0].email,
            organizationId: org[0].id,
        }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user[0].id,
                email: user[0].email,
                name: user[0].name,
                role: user[0].role,
            },
            organization: {
                id: org[0].id,
                name: org[0].name,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=auth.js.map