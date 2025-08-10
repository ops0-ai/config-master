"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDeploymentExecution = exports.requireServerAccess = exports.requireAdmin = void 0;
exports.requirePermission = requirePermission;
exports.rbacMiddleware = rbacMiddleware;
const rbacSeeder_1 = require("../utils/rbacSeeder");
// Define resource mappings for routes
const routeResourceMap = {
    // Dashboard
    'GET:/api/dashboard': { resource: 'dashboard', action: 'read' },
    // Settings
    'GET:/api/settings': { resource: 'settings', action: 'read' },
    'PUT:/api/settings': { resource: 'settings', action: 'write' },
    'PATCH:/api/settings': { resource: 'settings', action: 'write' },
    // Users
    'GET:/api/users': { resource: 'users', action: 'read' },
    'POST:/api/users': { resource: 'users', action: 'write' },
    'PUT:/api/users': { resource: 'users', action: 'write' },
    'PATCH:/api/users': { resource: 'users', action: 'write' },
    'DELETE:/api/users': { resource: 'users', action: 'delete' },
    // Roles
    'GET:/api/roles': { resource: 'roles', action: 'read' },
    'POST:/api/roles': { resource: 'roles', action: 'write' },
    'PUT:/api/roles': { resource: 'roles', action: 'write' },
    'PATCH:/api/roles': { resource: 'roles', action: 'write' },
    'DELETE:/api/roles': { resource: 'roles', action: 'delete' },
    // Servers
    'GET:/api/servers': { resource: 'servers', action: 'read' },
    'POST:/api/servers': { resource: 'servers', action: 'write' },
    'PUT:/api/servers': { resource: 'servers', action: 'write' },
    'PATCH:/api/servers': { resource: 'servers', action: 'write' },
    'DELETE:/api/servers': { resource: 'servers', action: 'delete' },
    // Server Groups
    'GET:/api/server-groups': { resource: 'server-groups', action: 'read' },
    'POST:/api/server-groups': { resource: 'server-groups', action: 'write' },
    'PUT:/api/server-groups': { resource: 'server-groups', action: 'write' },
    'PATCH:/api/server-groups': { resource: 'server-groups', action: 'write' },
    'DELETE:/api/server-groups': { resource: 'server-groups', action: 'delete' },
    // PEM Keys
    'GET:/api/pem-keys': { resource: 'pem-keys', action: 'read' },
    'POST:/api/pem-keys': { resource: 'pem-keys', action: 'write' },
    'PUT:/api/pem-keys': { resource: 'pem-keys', action: 'write' },
    'PATCH:/api/pem-keys': { resource: 'pem-keys', action: 'write' },
    'DELETE:/api/pem-keys': { resource: 'pem-keys', action: 'delete' },
    // Configurations
    'GET:/api/configurations': { resource: 'configurations', action: 'read' },
    'POST:/api/configurations': { resource: 'configurations', action: 'write' },
    'PUT:/api/configurations': { resource: 'configurations', action: 'write' },
    'PATCH:/api/configurations': { resource: 'configurations', action: 'write' },
    'DELETE:/api/configurations': { resource: 'configurations', action: 'delete' },
    // Deployments
    'GET:/api/deployments': { resource: 'deployments', action: 'read' },
    'POST:/api/deployments': { resource: 'deployments', action: 'write' },
    'PUT:/api/deployments': { resource: 'deployments', action: 'write' },
    'PATCH:/api/deployments': { resource: 'deployments', action: 'write' },
    'DELETE:/api/deployments': { resource: 'deployments', action: 'delete' },
    // Deployment execution
    'POST:/api/deployments/*/execute': { resource: 'deployments', action: 'execute' },
    'POST:/api/deployments/*/redeploy': { resource: 'deployments', action: 'execute' },
    // Training
    'GET:/api/training': { resource: 'training', action: 'read' },
    // Chat
    'GET:/api/conversations': { resource: 'chat', action: 'read' },
    'POST:/api/conversations': { resource: 'chat', action: 'write' },
    'GET:/api/conversations/*': { resource: 'chat', action: 'read' },
    'POST:/api/conversations/*/messages': { resource: 'chat', action: 'write' },
};
// Routes that don't require authorization
const publicRoutes = [
    'POST:/api/auth/login',
    'POST:/api/auth/register',
    'POST:/api/auth/forgot-password',
    'GET:/api/health',
    'GET:/health',
];
function requirePermission(resource, action) {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const hasAccess = await (0, rbacSeeder_1.hasPermission)(user.id, resource, action);
            if (!hasAccess) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: { resource, action }
                });
            }
            next();
        }
        catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}
function rbacMiddleware() {
    return async (req, res, next) => {
        try {
            const route = `${req.method}:${req.originalUrl.split('?')[0]}`;
            // Skip public routes (though this middleware should not run on public routes)
            if (publicRoutes.some(publicRoute => {
                if (publicRoute.includes('*')) {
                    const pattern = publicRoute.replace('*', '.*');
                    const regex = new RegExp(`^${pattern}$`);
                    return regex.test(route);
                }
                return publicRoute === route;
            })) {
                return next();
            }
            // User should be authenticated by authMiddleware at this point
            const user = req.user;
            if (!user) {
                console.error('RBAC middleware: No user found - authMiddleware should run first');
                return res.status(500).json({ error: 'Internal authentication error' });
            }
            // Find matching route pattern
            let requiredPermission = null;
            for (const [routePattern, permission] of Object.entries(routeResourceMap)) {
                if (routePattern.includes('*')) {
                    // Handle wildcard routes
                    const pattern = routePattern.replace(/\*/g, '[^/]+');
                    const regex = new RegExp(`^${pattern}$`);
                    if (regex.test(route)) {
                        requiredPermission = permission;
                        break;
                    }
                }
                else if (routePattern === route) {
                    requiredPermission = permission;
                    break;
                }
            }
            // If no specific permission required, allow access (for now)
            if (!requiredPermission) {
                console.warn(`⚠️ No RBAC rule defined for route: ${route}`);
                return next();
            }
            // Check if user has required permission
            const hasAccess = await (0, rbacSeeder_1.hasPermission)(user.id, requiredPermission.resource, requiredPermission.action);
            if (!hasAccess) {
                console.warn(`🚫 Access denied for user ${user.id} to ${route} (required: ${requiredPermission.resource}:${requiredPermission.action})`);
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: requiredPermission
                });
            }
            // User has permission, continue
            next();
        }
        catch (error) {
            console.error('RBAC middleware error:', error);
            res.status(500).json({ error: 'Authorization check failed' });
        }
    };
}
// Helper middleware for specific permissions
exports.requireAdmin = requirePermission('users', 'write');
exports.requireServerAccess = requirePermission('servers', 'read');
exports.requireDeploymentExecution = requirePermission('deployments', 'execute');
//# sourceMappingURL=rbacMiddleware.js.map