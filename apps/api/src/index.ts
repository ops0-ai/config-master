import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { authRoutes } from './routes/auth';
import { serverRoutes } from './routes/servers';
import { pemKeyRoutes } from './routes/pemKeys';
import { serverGroupRoutes } from './routes/serverGroups';
import { configurationRoutes } from './routes/configurations';
import { deploymentRoutes } from './routes/deployments';
import { conversationRoutes } from './routes/conversations';
import { ansibleRoutes } from './routes/ansible';
import { auditRoutes } from './routes/audit';
import auditLogRoutes from './routes/auditLogs';
import { roleRoutes } from './routes/roles';
import { userRoutes } from './routes/users';
import { awsRoutes } from './routes/aws';
import { settingsRoutes, initializeSettings } from './routes/settings';
import { githubRoutes } from './routes/github';
import { dashboardRoutes } from './routes/dashboard';
import organizationRoutes from './routes/organizations';
import { mdmRoutes, mdmPublicRoutes } from './routes/mdm';
import { ensureAdminUser } from './auto-seed';

import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbacMiddleware';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './socket/handlers';
import { startDriftDetectionService } from './services/driftDetection';
import { ensureAnsibleInstalled } from './scripts/setup-ansible';
import { deploymentScheduler } from './services/deploymentScheduler';

config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 5005;

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
export const db = drizzle(client);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/servers', authMiddleware, rbacMiddleware(), auditMiddleware, serverRoutes);
app.use('/api/pem-keys', authMiddleware, rbacMiddleware(), auditMiddleware, pemKeyRoutes);
app.use('/api/server-groups', authMiddleware, rbacMiddleware(), auditMiddleware, serverGroupRoutes);
app.use('/api/configurations', authMiddleware, rbacMiddleware(), auditMiddleware, configurationRoutes);
app.use('/api/deployments', authMiddleware, rbacMiddleware(), auditMiddleware, deploymentRoutes);
app.use('/api/conversations', authMiddleware, rbacMiddleware(), auditMiddleware, conversationRoutes);
app.use('/api/ansible', authMiddleware, rbacMiddleware(), auditMiddleware, ansibleRoutes);
app.use('/api/audit', authMiddleware, auditMiddleware, auditRoutes);
app.use('/api/audit-logs', authMiddleware, rbacMiddleware(), auditMiddleware, auditLogRoutes);
app.use('/api/roles', authMiddleware, rbacMiddleware(), auditMiddleware, roleRoutes);
app.use('/api/users', authMiddleware, rbacMiddleware(), auditMiddleware, userRoutes);
app.use('/api/aws', authMiddleware, rbacMiddleware(), auditMiddleware, awsRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/organizations', authMiddleware, organizationRoutes);
app.use('/api/mdm', mdmPublicRoutes); // Public MDM endpoints (downloads with tokens)
app.use('/api/mdm', authMiddleware, rbacMiddleware(), auditMiddleware, mdmRoutes);

app.use(errorHandler);

setupSocketHandlers(io);
startDriftDetectionService(db);
deploymentScheduler.start();

// Setup Ansible on startup
// Initialize RBAC system
import { seedRBACData } from './utils/rbacSeeder';
import { populateUserOrganizations } from './migrations/populateUserOrganizations';

// Setup platform components
Promise.all([
  ensureAnsibleInstalled(),
  seedRBACData(),
  initializeSettings(), // Load API keys from database on startup
  populateUserOrganizations(), // Populate user organizations for multi-tenancy
  ensureAdminUser(), // Auto-create admin user on startup
]).then(([ansibleInstalled]) => {
  if (ansibleInstalled) {
    console.log('🔧 Platform ready with Ansible integration and RBAC');
  } else {
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