"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditMiddleware = void 0;
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const auditMiddleware = async (req, res, next) => {
    try {
        const originalSend = res.send;
        const startTime = Date.now();
        res.send = function (data) {
            res.send = originalSend;
            // Log the action after response is sent
            if (req.user && res.statusCode < 400) {
                const action = `${req.method} ${req.originalUrl}`;
                const resource = req.originalUrl.split('/')[2]; // Extract resource from URL
                index_1.db.insert(database_1.auditLogs)
                    .values({
                    userId: req.user.id,
                    organizationId: req.user.organizationId,
                    action,
                    resource: resource || 'unknown',
                    resourceId: req.params.id || null,
                    details: {
                        method: req.method,
                        path: req.originalUrl,
                        statusCode: res.statusCode,
                        duration: Date.now() - startTime,
                        body: req.method !== 'GET' ? req.body : undefined,
                    },
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('user-agent'),
                })
                    .catch(error => {
                    console.error('Error logging audit:', error);
                });
            }
            return originalSend.call(this, data);
        };
        next();
    }
    catch (error) {
        console.error('Audit middleware error:', error);
        next();
    }
};
exports.auditMiddleware = auditMiddleware;
//# sourceMappingURL=audit.js.map