"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const router = (0, express_1.Router)();
exports.userRoutes = router;
// Validation schemas
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    isActive: zod_1.z.boolean().optional().default(true),
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(6).optional(),
    isActive: zod_1.z.boolean().optional(),
});
// GET /api/users - Get all users for the organization
router.get('/', async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const organizationUsers = await index_1.db
            .select({
            id: database_1.users.id,
            name: database_1.users.name,
            email: database_1.users.email,
            isActive: database_1.users.isActive,
            createdAt: database_1.users.createdAt,
            updatedAt: database_1.users.updatedAt,
        })
            .from(database_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.organizationId, organizationId), (0, drizzle_orm_1.eq)(database_1.users.isActive, true)))
            .orderBy(database_1.users.name);
        // Get roles for each user
        const usersWithRoles = await Promise.all(organizationUsers.map(async (user) => {
            const userRolesList = await index_1.db
                .select({
                id: database_1.roles.id,
                name: database_1.roles.name,
                description: database_1.roles.description,
                assignedAt: database_1.userRoles.assignedAt,
            })
                .from(database_1.userRoles)
                .innerJoin(database_1.roles, (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, database_1.roles.id))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, user.id), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true)));
            return {
                ...user,
                roles: userRolesList,
            };
        }));
        res.json(usersWithRoles);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// GET /api/users/:id - Get specific user
router.get('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const organizationId = req.user.organizationId;
        const user = await index_1.db
            .select({
            id: database_1.users.id,
            name: database_1.users.name,
            email: database_1.users.email,
            isActive: database_1.users.isActive,
            createdAt: database_1.users.createdAt,
            updatedAt: database_1.users.updatedAt,
        })
            .from(database_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.id, userId), (0, drizzle_orm_1.eq)(database_1.users.organizationId, organizationId)))
            .limit(1);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Get user roles
        const userRolesList = await index_1.db
            .select({
            id: database_1.roles.id,
            name: database_1.roles.name,
            description: database_1.roles.description,
            assignedAt: database_1.userRoles.assignedAt,
        })
            .from(database_1.userRoles)
            .innerJoin(database_1.roles, (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, database_1.roles.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true)));
        // Get user permissions (through roles)
        const userPermissions = await index_1.db
            .select({
            id: database_1.permissions.id,
            resource: database_1.permissions.resource,
            action: database_1.permissions.action,
            description: database_1.permissions.description,
        })
            .from(database_1.userRoles)
            .innerJoin(database_1.roles, (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, database_1.roles.id))
            .innerJoin(database_1.rolePermissions, (0, drizzle_orm_1.eq)(database_1.roles.id, database_1.rolePermissions.roleId))
            .innerJoin(database_1.permissions, (0, drizzle_orm_1.eq)(database_1.rolePermissions.permissionId, database_1.permissions.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true)));
        res.json({
            ...user[0],
            roles: userRolesList,
            permissions: userPermissions,
        });
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});
// POST /api/users - Create new user
router.post('/', async (req, res) => {
    try {
        const validation = createUserSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid user data', details: validation.error.errors });
        }
        const { name, email, password, isActive } = validation.data;
        const organizationId = req.user.organizationId;
        // Check if user email already exists in the organization
        const existingUser = await index_1.db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.email, email), (0, drizzle_orm_1.eq)(database_1.users.organizationId, organizationId)))
            .limit(1);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        // Hash password
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Create user
        const [newUser] = await index_1.db
            .insert(database_1.users)
            .values({
            name,
            email,
            passwordHash: hashedPassword,
            organizationId,
            isActive,
        })
            .returning({
            id: database_1.users.id,
            name: database_1.users.name,
            email: database_1.users.email,
            isActive: database_1.users.isActive,
            createdAt: database_1.users.createdAt,
            updatedAt: database_1.users.updatedAt,
        });
        res.status(201).json(newUser);
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});
// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const organizationId = req.user.organizationId;
        const validation = updateUserSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid user data', details: validation.error.errors });
        }
        const { name, email, password, isActive } = validation.data;
        // Check if user exists and belongs to organization
        const user = await index_1.db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.id, userId), (0, drizzle_orm_1.eq)(database_1.users.organizationId, organizationId)))
            .limit(1);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Check if email is being changed and already exists
        if (email && email !== user[0].email) {
            const existingUser = await index_1.db
                .select()
                .from(database_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.email, email), (0, drizzle_orm_1.eq)(database_1.users.organizationId, organizationId)))
                .limit(1);
            if (existingUser.length > 0) {
                return res.status(400).json({ error: 'User with this email already exists' });
            }
        }
        // Prepare update data
        const updateData = { updatedAt: new Date() };
        if (name !== undefined)
            updateData.name = name;
        if (email !== undefined)
            updateData.email = email;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (password !== undefined)
            updateData.passwordHash = await bcrypt_1.default.hash(password, 10);
        // Update user
        const [updatedUser] = await index_1.db
            .update(database_1.users)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userId))
            .returning({
            id: database_1.users.id,
            name: database_1.users.name,
            email: database_1.users.email,
            isActive: database_1.users.isActive,
            createdAt: database_1.users.createdAt,
            updatedAt: database_1.users.updatedAt,
        });
        res.json(updatedUser);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});
// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const organizationId = req.user.organizationId;
        const currentUserId = req.user.id;
        // Prevent user from deleting themselves
        if (userId === currentUserId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        // Check if user exists and belongs to organization
        const user = await index_1.db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.id, userId), (0, drizzle_orm_1.eq)(database_1.users.organizationId, organizationId)))
            .limit(1);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Deactivate user roles first
        await index_1.db
            .update(database_1.userRoles)
            .set({ isActive: false })
            .where((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId));
        // Soft delete user (deactivate)
        await index_1.db
            .update(database_1.users)
            .set({ isActive: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userId));
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
//# sourceMappingURL=users.js.map