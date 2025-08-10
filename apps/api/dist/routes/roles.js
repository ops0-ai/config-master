"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.roleRoutes = router;
// Validation schemas
const createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().optional(),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().optional(),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().optional(),
});
const assignRoleSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    roleId: zod_1.z.string(),
});
// GET /api/roles - Get all roles for the organization
router.get('/', async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const organizationRoles = await index_1.db
            .select({
            id: database_1.roles.id,
            name: database_1.roles.name,
            description: database_1.roles.description,
            isSystem: database_1.roles.isSystem,
            isActive: database_1.roles.isActive,
            createdAt: database_1.roles.createdAt,
            updatedAt: database_1.roles.updatedAt,
        })
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId), (0, drizzle_orm_1.eq)(database_1.roles.isActive, true)))
            .orderBy(database_1.roles.name);
        // Get permissions for each role
        const rolesWithPermissions = await Promise.all(organizationRoles.map(async (role) => {
            const rolePerms = await index_1.db
                .select({
                id: database_1.permissions.id,
                resource: database_1.permissions.resource,
                action: database_1.permissions.action,
                description: database_1.permissions.description,
            })
                .from(database_1.rolePermissions)
                .innerJoin(database_1.permissions, (0, drizzle_orm_1.eq)(database_1.rolePermissions.permissionId, database_1.permissions.id))
                .where((0, drizzle_orm_1.eq)(database_1.rolePermissions.roleId, role.id));
            return {
                ...role,
                permissions: rolePerms,
            };
        }));
        res.json(rolesWithPermissions);
    }
    catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});
// GET /api/roles/:id - Get specific role
router.get('/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        const organizationId = req.user.organizationId;
        const role = await index_1.db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.id, roleId), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId)))
            .limit(1);
        if (role.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        // Get role permissions
        const rolePerms = await index_1.db
            .select({
            id: database_1.permissions.id,
            resource: database_1.permissions.resource,
            action: database_1.permissions.action,
            description: database_1.permissions.description,
        })
            .from(database_1.rolePermissions)
            .innerJoin(database_1.permissions, (0, drizzle_orm_1.eq)(database_1.rolePermissions.permissionId, database_1.permissions.id))
            .where((0, drizzle_orm_1.eq)(database_1.rolePermissions.roleId, roleId));
        // Get users with this role
        const roleUsers = await index_1.db
            .select({
            id: database_1.users.id,
            name: database_1.users.name,
            email: database_1.users.email,
            assignedAt: database_1.userRoles.assignedAt,
        })
            .from(database_1.userRoles)
            .innerJoin(database_1.users, (0, drizzle_orm_1.eq)(database_1.userRoles.userId, database_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.roleId, roleId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true)));
        res.json({
            ...role[0],
            permissions: rolePerms,
            users: roleUsers,
        });
    }
    catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ error: 'Failed to fetch role' });
    }
});
// POST /api/roles - Create new role
router.post('/', async (req, res) => {
    try {
        const validation = createRoleSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid role data', details: validation.error.errors });
        }
        const { name, description, permissions: permissionIds } = validation.data;
        const organizationId = req.user.organizationId;
        const createdBy = req.user.id;
        // Check if role name already exists
        const existingRole = await index_1.db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.name, name), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId)))
            .limit(1);
        if (existingRole.length > 0) {
            return res.status(400).json({ error: 'Role name already exists' });
        }
        // Create role
        const [newRole] = await index_1.db
            .insert(database_1.roles)
            .values({
            name,
            description,
            organizationId,
            createdBy,
            isSystem: false,
        })
            .returning();
        // Assign permissions if provided
        if (permissionIds && permissionIds.length > 0) {
            const permissionAssignments = permissionIds.map(permissionId => ({
                roleId: newRole.id,
                permissionId,
            }));
            await index_1.db
                .insert(database_1.rolePermissions)
                .values(permissionAssignments);
        }
        res.status(201).json(newRole);
    }
    catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Failed to create role' });
    }
});
// PUT /api/roles/:id - Update role
router.put('/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        const organizationId = req.user.organizationId;
        const validation = updateRoleSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid role data', details: validation.error.errors });
        }
        const { name, description, permissions: permissionIds, isActive } = validation.data;
        // Check if role exists and belongs to organization
        const role = await index_1.db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.id, roleId), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId)))
            .limit(1);
        if (role.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        // Prevent modification of system roles
        if (role[0].isSystem) {
            return res.status(400).json({ error: 'Cannot modify system roles' });
        }
        // Update role
        const updateData = { updatedAt: new Date() };
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        const [updatedRole] = await index_1.db
            .update(database_1.roles)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(database_1.roles.id, roleId))
            .returning();
        // Update permissions if provided
        if (permissionIds !== undefined) {
            // Remove existing permissions
            await index_1.db
                .delete(database_1.rolePermissions)
                .where((0, drizzle_orm_1.eq)(database_1.rolePermissions.roleId, roleId));
            // Add new permissions
            if (permissionIds.length > 0) {
                const permissionAssignments = permissionIds.map(permissionId => ({
                    roleId: roleId,
                    permissionId,
                }));
                await index_1.db
                    .insert(database_1.rolePermissions)
                    .values(permissionAssignments);
            }
        }
        res.json(updatedRole);
    }
    catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});
// DELETE /api/roles/:id - Delete role
router.delete('/:id', async (req, res) => {
    try {
        const roleId = req.params.id;
        const organizationId = req.user.organizationId;
        // Check if role exists and belongs to organization
        const role = await index_1.db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.id, roleId), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId)))
            .limit(1);
        if (role.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        // Prevent deletion of system roles
        if (role[0].isSystem) {
            return res.status(400).json({ error: 'Cannot delete system roles' });
        }
        // Check if any users have this role
        const assignedUsers = await index_1.db
            .select()
            .from(database_1.userRoles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.roleId, roleId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true)));
        if (assignedUsers.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete role with assigned users',
                assignedUsers: assignedUsers.length
            });
        }
        // Delete role permissions
        await index_1.db
            .delete(database_1.rolePermissions)
            .where((0, drizzle_orm_1.eq)(database_1.rolePermissions.roleId, roleId));
        // Delete role
        await index_1.db
            .delete(database_1.roles)
            .where((0, drizzle_orm_1.eq)(database_1.roles.id, roleId));
        res.json({ message: 'Role deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Failed to delete role' });
    }
});
// GET /api/roles/permissions - Get all available permissions
router.get('/permissions/all', async (_req, res) => {
    try {
        const allPermissions = await index_1.db
            .select()
            .from(database_1.permissions)
            .orderBy(database_1.permissions.resource, database_1.permissions.action);
        // Group permissions by resource
        const groupedPermissions = allPermissions.reduce((acc, permission) => {
            if (!acc[permission.resource]) {
                acc[permission.resource] = [];
            }
            acc[permission.resource].push(permission);
            return acc;
        }, {});
        res.json(groupedPermissions);
    }
    catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});
// POST /api/roles/assign - Assign role to user
router.post('/assign', async (req, res) => {
    try {
        const validation = assignRoleSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid assignment data', details: validation.error.errors });
        }
        const { userId, roleId } = validation.data;
        const organizationId = req.user.organizationId;
        const assignedBy = req.user.id;
        // Verify role belongs to organization
        const role = await index_1.db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.id, roleId), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId)))
            .limit(1);
        if (role.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        // Check if user already has this role
        const existingAssignment = await index_1.db
            .select()
            .from(database_1.userRoles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId), (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, roleId), (0, drizzle_orm_1.eq)(database_1.userRoles.isActive, true)))
            .limit(1);
        if (existingAssignment.length > 0) {
            return res.status(400).json({ error: 'User already has this role' });
        }
        // Assign role
        const [assignment] = await index_1.db
            .insert(database_1.userRoles)
            .values({
            userId,
            roleId,
            assignedBy,
        })
            .returning();
        res.status(201).json(assignment);
    }
    catch (error) {
        console.error('Error assigning role:', error);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});
// DELETE /api/roles/assign/:userId/:roleId - Remove role from user
router.delete('/assign/:userId/:roleId', async (req, res) => {
    try {
        const { userId, roleId } = req.params;
        const organizationId = req.user.organizationId;
        // Verify role belongs to organization
        const role = await index_1.db
            .select()
            .from(database_1.roles)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.roles.id, roleId), (0, drizzle_orm_1.eq)(database_1.roles.organizationId, organizationId)))
            .limit(1);
        if (role.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        // Remove role assignment
        await index_1.db
            .update(database_1.userRoles)
            .set({ isActive: false })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.userRoles.userId, userId), (0, drizzle_orm_1.eq)(database_1.userRoles.roleId, roleId)));
        res.json({ message: 'Role assignment removed successfully' });
    }
    catch (error) {
        console.error('Error removing role assignment:', error);
        res.status(500).json({ error: 'Failed to remove role assignment' });
    }
});
//# sourceMappingURL=roles.js.map