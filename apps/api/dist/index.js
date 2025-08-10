"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = require("dotenv");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const auth_1 = require("./routes/auth");
const servers_1 = require("./routes/servers");
const pemKeys_1 = require("./routes/pemKeys");
const serverGroups_1 = require("./routes/serverGroups");
const configurations_1 = require("./routes/configurations");
const deployments_1 = require("./routes/deployments");
const conversations_1 = require("./routes/conversations");
const ansible_1 = require("./routes/ansible");
const audit_1 = require("./routes/audit");
const roles_1 = require("./routes/roles");
const users_1 = require("./routes/users");
const auth_2 = require("./middleware/auth");
const rbacMiddleware_1 = require("./middleware/rbacMiddleware");
const audit_2 = require("./middleware/audit");
const errorHandler_1 = require("./middleware/errorHandler");
const handlers_1 = require("./socket/handlers");
const driftDetection_1 = require("./services/driftDetection");
const setup_ansible_1 = require("./scripts/setup-ansible");
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});
const port = process.env.PORT || 5005;
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = (0, postgres_1.default)(connectionString);
exports.db = (0, postgres_js_1.drizzle)(client);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', auth_1.authRoutes);
app.use('/api/servers', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, servers_1.serverRoutes);
app.use('/api/pem-keys', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, pemKeys_1.pemKeyRoutes);
app.use('/api/server-groups', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, serverGroups_1.serverGroupRoutes);
app.use('/api/configurations', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, configurations_1.configurationRoutes);
app.use('/api/deployments', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, deployments_1.deploymentRoutes);
app.use('/api/conversations', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, conversations_1.conversationRoutes);
app.use('/api/ansible', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, ansible_1.ansibleRoutes);
app.use('/api/audit', auth_2.authMiddleware, audit_2.auditMiddleware, audit_1.auditRoutes);
app.use('/api/roles', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, roles_1.roleRoutes);
app.use('/api/users', auth_2.authMiddleware, (0, rbacMiddleware_1.rbacMiddleware)(), audit_2.auditMiddleware, users_1.userRoutes);
app.use(errorHandler_1.errorHandler);
(0, handlers_1.setupSocketHandlers)(io);
(0, driftDetection_1.startDriftDetectionService)(exports.db);
// Setup Ansible on startup
// Initialize RBAC system
const rbacSeeder_1 = require("./utils/rbacSeeder");
// Setup platform components
Promise.all([
    (0, setup_ansible_1.ensureAnsibleInstalled)(),
    (0, rbacSeeder_1.seedRBACData)(),
]).then(([ansibleInstalled]) => {
    if (ansibleInstalled) {
        console.log('🔧 Platform ready with Ansible integration and RBAC');
    }
    else {
        console.log('⚠️  Platform running in simulation mode with RBAC');
    }
}).catch((error) => {
    console.warn('⚠️  Platform setup warning:', error);
});
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
});
//# sourceMappingURL=index.js.map