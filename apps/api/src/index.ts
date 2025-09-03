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
import aiAssistantRoutes from './routes/ai-assistant';
import { mdmRoutes, mdmPublicRoutes } from './routes/mdm';
import { assetsRoutes } from './routes/assets';
import { assetAssignmentsRoutes } from './routes/asset-assignments';
import { adminRoutes } from './routes/admin';
import systemSettingsRoutes from './routes/systemSettings';
import ssoRoutes from './routes/sso';
import ssoAuthRoutes from './routes/ssoAuth';
import { ensureAdminUser, ensureDefaultMDMProfiles } from './auto-seed-simple';

import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbacMiddleware';
import { auditMiddleware } from './middleware/audit';
import { autoFeatureFlagMiddleware } from './middleware/featureFlags';
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
    origin: function(origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Use same CORS logic as Express
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ].filter(Boolean);
      
      const isAllowed = allowedOrigins.includes(origin) || 
                       /^http:\/\/\d+\.\d+\.\d+\.\d+:3000$/.test(origin) ||
                       /^http:\/\/[^:]+:3000$/.test(origin);
      
      callback(null, isAllowed);
    },
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 5005;

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const client = postgres(connectionString);
export const db = drizzle(client);

// Dynamic CORS configuration for self-hosted deployments
const isProduction = process.env.NODE_ENV === 'production';
const allowSelfHosted = process.env.ALLOW_SELF_HOSTED_CORS === 'true';

console.log('🔧 CORS Configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   ALLOW_SELF_HOSTED_CORS: ${process.env.ALLOW_SELF_HOSTED_CORS}`);
console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL}`);

// IMPORTANT: CORS must be configured BEFORE helmet
// Allow ALL origins for self-hosted deployments
console.log('🌐 CORS: Allowing ALL origins');

app.use(cors());

// Apply helmet AFTER CORS with custom configuration
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/servers', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, serverRoutes);
app.use('/api/pem-keys', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, pemKeyRoutes);
app.use('/api/server-groups', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, serverGroupRoutes);
app.use('/api/configurations', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, configurationRoutes);
app.use('/api/deployments', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, deploymentRoutes);
app.use('/api/conversations', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, conversationRoutes);
app.use('/api/ansible', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, ansibleRoutes);
app.use('/api/audit', authMiddleware, auditMiddleware, auditRoutes);
app.use('/api/audit-logs', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, auditLogRoutes);
app.use('/api/roles', authMiddleware, rbacMiddleware(), auditMiddleware, roleRoutes);
app.use('/api/users', authMiddleware, rbacMiddleware(), auditMiddleware, userRoutes);
app.use('/api/aws', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, awsRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/github', authMiddleware, autoFeatureFlagMiddleware(), githubRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/organizations', authMiddleware, organizationRoutes);
app.use('/api/ai-assistant', authMiddleware, rbacMiddleware(), auditMiddleware, aiAssistantRoutes);
app.use('/api/assets', authMiddleware, autoFeatureFlagMiddleware(), assetsRoutes);
app.use('/api/asset-assignments', authMiddleware, autoFeatureFlagMiddleware(), assetAssignmentsRoutes);
app.use('/api/admin', adminRoutes); // Super admin routes
app.use('/api/system-settings', systemSettingsRoutes); // System settings management
app.use('/api/sso', ssoRoutes); // SSO provider management (super admin)
app.use('/api/sso', ssoAuthRoutes); // SSO authentication flow (public)
app.use('/api/mdm', mdmPublicRoutes); // Public MDM endpoints (downloads with tokens)
app.use('/api/mdm', authMiddleware, autoFeatureFlagMiddleware(), rbacMiddleware(), auditMiddleware, mdmRoutes);

app.use(errorHandler);

setupSocketHandlers(io);
startDriftDetectionService(db);
deploymentScheduler.start();

// Setup Ansible on startup
// Initialize RBAC system
import { seedRBACData } from './utils/rbacSeeder';
import { populateUserOrganizations } from './migrations/populateUserOrganizations';
import { initializeDatabase } from './services/databaseInitializer';

// Setup platform components with migrations first
async function initializePlatform() {
  try {
    console.log('🚀 Initializing Pulse platform...');
    
    // Initialize database schema FIRST
    await initializeDatabase();
    
    // Run column migrations before RBAC
    const { MigrationService } = await import('./services/migrationService');
    const migrationService = new MigrationService();
    await migrationService.runInitialMigrations();
    
    // Seed RBAC data AFTER migrations
    await seedRBACData();
    
    // Then setup all other components
    await Promise.all([
      initializeSettings(),
      populateUserOrganizations(),
      ensureAdminUser(),
      ensureDefaultMDMProfiles(),
    ]);
    
    // Verify installation
    const isValid = await migrationService.verifyInstallation();
    if (!isValid) {
      throw new Error('Installation verification failed');
    }
    
    console.log('✅ Pulse platform initialized successfully');
  } catch (error) {
    console.error('❌ Platform initialization failed:', error);
    process.exit(1);
  }
}

initializePlatform();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS test endpoint
app.options('*', (req, res) => {
  console.log(`OPTIONS request from: ${req.headers.origin}`);
  res.sendStatus(204);
});

app.get('/api/cors-test', (_req, res) => {
  res.json({ 
    status: 'CORS is working!', 
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      ALLOW_SELF_HOSTED_CORS: process.env.ALLOW_SELF_HOSTED_CORS,
      FRONTEND_URL: process.env.FRONTEND_URL
    }
  });
});

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});