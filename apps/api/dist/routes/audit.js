"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRoutes = void 0;
const express_1 = require("express");
const index_1 = require("../index");
const database_1 = require("@config-management/database");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
exports.auditRoutes = router;
router.get('/', async (req, res) => {
    try {
        const logs = await index_1.db
            .select()
            .from(database_1.auditLogs)
            .where((0, drizzle_orm_1.eq)(database_1.auditLogs.organizationId, req.user.organizationId))
            .orderBy((0, drizzle_orm_1.desc)(database_1.auditLogs.createdAt))
            .limit(100);
        res.json(logs);
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=audit.js.map