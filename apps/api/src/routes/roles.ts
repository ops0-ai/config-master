import { Router } from 'express';
import { db } from '../index';
import { roles, permissions, rolePermissions, userRoles, users } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const assignRoleSchema = z.object({
  userId: z.string(),
  roleId: z.string(),
});

// GET /api/roles - Get all roles for the organization
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId;
    
    const organizationRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        isSystem: roles.isSystem,
        isActive: roles.isActive,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organizationId),
          eq(roles.isActive, true)
        )
      )
      .orderBy(roles.name);

    // Get permissions for each role
    const rolesWithPermissions = await Promise.all(
      organizationRoles.map(async (role) => {
        const rolePerms = await db
          .select({
            id: permissions.id,
            resource: permissions.resource,
            action: permissions.action,
            description: permissions.description,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(rolePermissions.roleId, role.id));

        return {
          ...role,
          permissions: rolePerms,
        };
      })
    );

    res.json(rolesWithPermissions);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// GET /api/roles/:id - Get specific role
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const roleId = req.params.id;
    const organizationId = req.user!.organizationId;

    const role = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Get role permissions
    const rolePerms = await db
      .select({
        id: permissions.id,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    // Get users with this role
    const roleUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, roleId),
          eq(userRoles.isActive, true)
        )
      );

    res.json({
      ...role[0],
      permissions: rolePerms,
      users: roleUsers,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// POST /api/roles - Create new role
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validation = createRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid role data', details: validation.error.issues });
    }

    const { name, description, permissions: permissionIds } = validation.data;
    const organizationId = req.user!.organizationId;
    const createdBy = req.user!.id;

    // Check if role name already exists
    const existingRole = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.name, name),
          eq(roles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existingRole.length > 0) {
      return res.status(400).json({ error: 'Role name already exists' });
    }

    // Create role
    const [newRole] = await db
      .insert(roles)
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

      await db
        .insert(rolePermissions)
        .values(permissionAssignments);
    }

    res.status(201).json(newRole);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/roles/:id - Update role
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const roleId = req.params.id;
    const organizationId = req.user!.organizationId;

    const validation = updateRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid role data', details: validation.error.issues });
    }

    const { name, description, permissions: permissionIds, isActive } = validation.data;

    // Check if role exists and belongs to organization
    const role = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Prevent modification of system roles
    if (role[0].isSystem) {
      return res.status(400).json({ error: 'Cannot modify system roles' });
    }

    // Update role
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updatedRole] = await db
      .update(roles)
      .set(updateData)
      .where(eq(roles.id, roleId))
      .returning();

    // Update permissions if provided
    if (permissionIds !== undefined) {
      // Remove existing permissions
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));

      // Add new permissions
      if (permissionIds.length > 0) {
        const permissionAssignments = permissionIds.map(permissionId => ({
          roleId: roleId,
          permissionId,
        }));

        await db
          .insert(rolePermissions)
          .values(permissionAssignments);
      }
    }

    res.json(updatedRole);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/roles/:id - Delete role
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const roleId = req.params.id;
    const organizationId = req.user!.organizationId;

    // Check if role exists and belongs to organization
    const role = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Prevent deletion of system roles
    if (role[0].isSystem) {
      return res.status(400).json({ error: 'Cannot delete system roles' });
    }

    // Check if any users have this role
    const assignedUsers = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.roleId, roleId),
          eq(userRoles.isActive, true)
        )
      );

    if (assignedUsers.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role with assigned users',
        assignedUsers: assignedUsers.length 
      });
    }

    // Delete role permissions
    await db
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    // Delete role
    await db
      .delete(roles)
      .where(eq(roles.id, roleId));

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// GET /api/roles/permissions - Get all available permissions
router.get('/permissions/all', async (_req, res) => {
  try {
    const allPermissions = await db
      .select()
      .from(permissions)
      .orderBy(permissions.resource, permissions.action);

    // Group permissions by resource
    const groupedPermissions = allPermissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, typeof allPermissions>);

    res.json(groupedPermissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// POST /api/roles/assign - Assign role to user
router.post('/assign', async (req: AuthenticatedRequest, res) => {
  try {
    const validation = assignRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid assignment data', details: validation.error.issues });
    }

    const { userId, roleId } = validation.data;
    const organizationId = req.user!.organizationId;
    const assignedBy = req.user!.id;

    // Verify role belongs to organization
    const role = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check if user already has this role
    const existingAssignment = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId),
          eq(userRoles.isActive, true)
        )
      )
      .limit(1);

    if (existingAssignment.length > 0) {
      return res.status(400).json({ error: 'User already has this role' });
    }

    // Assign role
    const [assignment] = await db
      .insert(userRoles)
      .values({
        userId,
        roleId,
        assignedBy,
      })
      .returning();

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// DELETE /api/roles/assign/:userId/:roleId - Remove role from user
router.delete('/assign/:userId/:roleId', async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, roleId } = req.params;
    const organizationId = req.user!.organizationId;

    // Verify role belongs to organization
    const role = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.organizationId, organizationId)
        )
      )
      .limit(1);

    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Remove role assignment
    await db
      .update(userRoles)
      .set({ isActive: false })
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      );

    res.json({ message: 'Role assignment removed successfully' });
  } catch (error) {
    console.error('Error removing role assignment:', error);
    res.status(500).json({ error: 'Failed to remove role assignment' });
  }
});

export { router as roleRoutes };