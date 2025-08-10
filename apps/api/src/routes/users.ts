import { Router } from 'express';
import { db } from '../index';
import { users, userRoles, roles, permissions, rolePermissions } from '@config-management/database';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(6),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/users - Get all users for the organization
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const organizationId = req.user!.organizationId;
    
    const organizationUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.isActive, true)
        )
      )
      .orderBy(users.name);

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      organizationUsers.map(async (user) => {
        const userRolesList = await db
          .select({
            id: roles.id,
            name: roles.name,
            description: roles.description,
            assignedAt: userRoles.assignedAt,
          })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            and(
              eq(userRoles.userId, user.id),
              eq(userRoles.isActive, true)
            )
          );

        return {
          ...user,
          roles: userRolesList,
        };
      })
    );

    res.json(usersWithRoles);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get specific user
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id;
    const organizationId = req.user!.organizationId;

    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, organizationId)
        )
      )
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user roles
    const userRolesList = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        assignedAt: userRoles.assignedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.isActive, true)
        )
      );

    // Get user permissions (through roles)
    const userPermissions = await db
      .select({
        id: permissions.id,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.isActive, true)
        )
      );

    res.json({
      ...user[0],
      roles: userRolesList,
      permissions: userPermissions,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid user data', details: validation.error.errors });
    }

    const { name, email, password, isActive } = validation.data;
    const organizationId = req.user!.organizationId;

    // Check if user email already exists in the organization
    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hashedPassword,
        organizationId,
        isActive,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id;
    const organizationId = req.user!.organizationId;

    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid user data', details: validation.error.errors });
    }

    const { name, email, password, isActive } = validation.data;

    // Check if user exists and belongs to organization
    const user = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, organizationId)
        )
      )
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and already exists
    if (email && email !== user[0].email) {
      const existingUser = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, email),
            eq(users.organizationId, organizationId)
          )
        )
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password !== undefined) updateData.passwordHash = await bcrypt.hash(password, 10);

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id;
    const organizationId = req.user!.organizationId;
    const currentUserId = req.user!.id;

    // Prevent user from deleting themselves
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists and belongs to organization
    const user = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, organizationId)
        )
      )
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Deactivate user roles first
    await db
      .update(userRoles)
      .set({ isActive: false })
      .where(eq(userRoles.userId, userId));

    // Soft delete user (deactivate)
    await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export { router as userRoutes };