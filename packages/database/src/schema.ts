import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, varchar, date, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  isPrimary: boolean('is_primary').notNull().default(false), // First org created cannot be disabled
  // Feature flags for organization-level feature management
  featuresEnabled: jsonb('features_enabled').$type<{
    servers?: boolean;
    serverGroups?: boolean;
    pemKeys?: boolean;
    configurations?: boolean;
    deployments?: boolean;
    chat?: boolean;
    training?: boolean;
    awsIntegrations?: boolean;
    githubIntegrations?: boolean;
    mdm?: boolean;
    assets?: boolean;
    auditLogs?: boolean;
  }>().default({
    servers: true,
    serverGroups: true,
    pemKeys: true,
    configurations: true,
    deployments: true,
    chat: true,
    training: true,
    awsIntegrations: true,
    githubIntegrations: true,
    mdm: true,
    assets: true,
    auditLogs: true
  }),
  metadata: jsonb('metadata').$type<any>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userOrganizations = pgTable('user_organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'), // owner, admin, member
  isActive: boolean('is_active').notNull().default(true),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash'),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false), // Global super admin
  organizationId: uuid('organization_id').references(() => organizations.id),
  isActive: boolean('is_active').notNull().default(true),
  hasCompletedOnboarding: boolean('has_completed_onboarding').notNull().default(false),
  isSSO: boolean('is_sso').notNull().default(false), // True if user was created as SSO user
  authMethod: varchar('auth_method', { length: 50 }).notNull().default('password'), // password, sso, both
  ssoProviderId: uuid('sso_provider_id'),
  externalUserId: varchar('external_user_id', { length: 500 }),
  lastSsoLoginAt: timestamp('last_sso_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pemKeys = pgTable('pem_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  encryptedPrivateKey: text('encrypted_private_key').notNull(),
  publicKey: text('public_key'),
  fingerprint: varchar('fingerprint', { length: 255 }),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const serverGroups = pgTable('server_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).default('mixed'), // 'linux', 'windows', 'mixed'
  defaultPemKeyId: uuid('default_pem_key_id').references(() => pemKeys.id),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  hostname: varchar('hostname', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  port: integer('port').notNull().default(22),
  type: varchar('type', { length: 50 }).notNull().default('linux'), // 'linux', 'windows'
  username: varchar('username', { length: 255 }).notNull().default('root'),
  // For Windows servers - encrypted password storage
  encryptedPassword: text('encrypted_password'), // Encrypted password for Windows RDP
  operatingSystem: varchar('operating_system', { length: 100 }),
  osVersion: varchar('os_version', { length: 100 }),
  status: varchar('status', { length: 50 }).notNull().default('unknown'),
  lastSeen: timestamp('last_seen'),
  groupId: uuid('group_id').references(() => serverGroups.id),
  // For Linux servers - PEM key authentication
  pemKeyId: uuid('pem_key_id').references(() => pemKeys.id),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const configurations = pgTable('configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 100 }).notNull(),
  ansiblePlaybook: text('ansible_playbook').notNull(),
  variables: jsonb('variables'),
  tags: jsonb('tags'),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  isTemplate: boolean('is_template').notNull().default(false),
  version: integer('version').notNull().default(1),
  source: varchar('source', { length: 50 }).notNull().default('manual'), // 'manual', 'template', 'conversation'
  // Approval fields
  approvalStatus: varchar('approval_status', { length: 50 }).notNull().default('pending'), // 'pending', 'approved', 'rejected'
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  metadata: jsonb('metadata').$type<any>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  section: varchar('section', { length: 100 }).default('general'),
  version: integer('version').notNull().default(1),
  parentDeploymentId: uuid('parent_deployment_id'),
  configurationId: uuid('configuration_id').references(() => configurations.id).notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: uuid('target_id').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  logs: text('logs'),
  output: text('output'),
  errorMessage: text('error_message'),
  // Scheduling fields
  scheduleType: varchar('schedule_type', { length: 20 }).default('immediate'), // 'immediate', 'scheduled', 'recurring'
  scheduledFor: timestamp('scheduled_for'), // For one-time scheduled deployments
  cronExpression: varchar('cron_expression', { length: 100 }), // For recurring deployments
  timezone: varchar('timezone', { length: 50 }).default('UTC'), // Timezone for scheduling
  isActive: boolean('is_active').default(true), // For recurring deployments
  nextRunAt: timestamp('next_run_at'), // Next execution time for recurring deployments
  lastRunAt: timestamp('last_run_at'), // Last execution time for recurring deployments
  // Approval fields
  approvalStatus: varchar('approval_status', { length: 50 }).notNull().default('pending'), // 'pending', 'approved', 'rejected'
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  executedBy: uuid('executed_by').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const configurationStates = pgTable('configuration_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').references(() => servers.id).notNull(),
  configurationId: uuid('configuration_id').references(() => configurations.id).notNull(),
  expectedState: jsonb('expected_state').notNull(),
  actualState: jsonb('actual_state'),
  status: varchar('status', { length: 50 }).notNull().default('unknown'),
  lastChecked: timestamp('last_checked'),
  driftDetected: boolean('drift_detected').notNull().default(false),
  driftDetails: jsonb('drift_details'),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  generatedConfiguration: text('generated_configuration'),
  configurationId: uuid('configuration_id').references(() => configurations.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// AI Assistant Context and Conversations
export const aiAssistantSessions = pgTable('ai_assistant_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  contextPage: varchar('context_page', { length: 50 }).notNull(), // servers, configurations, deployments
  contextData: jsonb('context_data').$type<{
    pageUrl?: string;
    selectedItems?: string[];
    filters?: Record<string, any>;
    visibleData?: Record<string, any>;
  }>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
});

export const aiAssistantMessages = pgTable('ai_assistant_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => aiAssistantSessions.id).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id), // Link to main chat for history
  role: varchar('role', { length: 20 }).notNull(), // user, assistant, system
  content: text('content').notNull(),
  contextPage: varchar('context_page', { length: 50 }).notNull(),
  // AI Actions taken
  actions: jsonb('actions').$type<Array<{
    type: string; // create_config, modify_config, deploy, analyze, suggest
    status: string; // pending, approved, rejected, executed
    details: Record<string, any>;
    executedAt?: string;
  }>>().default([]),
  // Analysis results
  analysis: jsonb('analysis').$type<{
    configurationIssues?: Array<{
      severity: string;
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    driftDetection?: {
      hasDrift: boolean;
      differences: Array<any>;
    };
    recommendations?: string[];
  }>(),
  // Generated content
  generatedContent: jsonb('generated_content').$type<{
    configurations?: Array<{
      name: string;
      type: string;
      content: string;
    }>;
    deploymentPlan?: any;
    serverGroups?: any[];
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Configuration Drift Tracking
export const configurationDrifts = pgTable('configuration_drifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  configurationId: uuid('configuration_id').references(() => configurations.id).notNull(),
  serverId: uuid('server_id').references(() => servers.id),
  serverGroupId: uuid('server_group_id').references(() => serverGroups.id),
  expectedContent: text('expected_content').notNull(),
  actualContent: text('actual_content'),
  driftType: varchar('drift_type', { length: 50 }).notNull(), // content, missing, unauthorized
  differences: jsonb('differences').$type<Array<{
    path: string;
    expected: any;
    actual: any;
    type: string;
  }>>().default([]),
  severity: varchar('severity', { length: 20 }).notNull().default('medium'), // low, medium, high, critical
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolutionType: varchar('resolution_type', { length: 50 }), // manual, auto_fixed, ignored
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
});

// AI Proactive Suggestions
export const aiSuggestions = pgTable('ai_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id), // Who the suggestion is for
  type: varchar('type', { length: 50 }).notNull(), // optimization, security, drift, error, best_practice
  severity: varchar('severity', { length: 20 }).notNull().default('info'), // info, warning, error, critical
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  affectedResource: varchar('affected_resource', { length: 100 }), // servers, configurations, deployments
  affectedResourceId: uuid('affected_resource_id'),
  suggestedAction: jsonb('suggested_action').$type<{
    type: string;
    details: Record<string, any>;
    autoFixAvailable: boolean;
  }>(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, viewed, applied, dismissed
  viewedAt: timestamp('viewed_at'),
  appliedAt: timestamp('applied_at'),
  dismissedAt: timestamp('dismissed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// RBAC Tables for Role-Based Access Control
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  isSystem: boolean('is_system').notNull().default(false), // System roles cannot be deleted
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  resource: varchar('resource', { length: 100 }).notNull(), // e.g., 'servers', 'deployments', 'settings'
  action: varchar('action', { length: 50 }).notNull(), // e.g., 'read', 'write', 'delete', 'execute'
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(true), // System permissions cannot be modified
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  permissionId: uuid('permission_id').references(() => permissions.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }),
  ownedOrganizations: many(organizations),
  configurations: many(configurations),
  deployments: many(deployments),
  conversations: many(conversations),
  auditLogs: many(auditLogs),
  userRoles: many(userRoles),
  createdRoles: many(roles, { relationName: 'createdRoles' }),
  assignedRoles: many(userRoles, { relationName: 'assignedRoles' }),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  owner: one(users, { fields: [organizations.ownerId], references: [users.id] }),
  users: many(users),
  pemKeys: many(pemKeys),
  serverGroups: many(serverGroups),
  servers: many(servers),
  configurations: many(configurations),
  deployments: many(deployments),
  configurationStates: many(configurationStates),
  conversations: many(conversations),
  auditLogs: many(auditLogs),
  roles: many(roles),
}));

export const pemKeysRelations = relations(pemKeys, ({ one, many }) => ({
  organization: one(organizations, { fields: [pemKeys.organizationId], references: [organizations.id] }),
  servers: many(servers),
  serverGroups: many(serverGroups),
}));

export const serverGroupsRelations = relations(serverGroups, ({ one, many }) => ({
  organization: one(organizations, { fields: [serverGroups.organizationId], references: [organizations.id] }),
  defaultPemKey: one(pemKeys, { fields: [serverGroups.defaultPemKeyId], references: [pemKeys.id] }),
  servers: many(servers),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  organization: one(organizations, { fields: [servers.organizationId], references: [organizations.id] }),
  group: one(serverGroups, { fields: [servers.groupId], references: [serverGroups.id] }),
  pemKey: one(pemKeys, { fields: [servers.pemKeyId], references: [pemKeys.id] }),
  configurationStates: many(configurationStates),
}));

export const configurationsRelations = relations(configurations, ({ one, many }) => ({
  organization: one(organizations, { fields: [configurations.organizationId], references: [organizations.id] }),
  createdBy: one(users, { fields: [configurations.createdBy], references: [users.id] }),
  approvedBy: one(users, { fields: [configurations.approvedBy], references: [users.id] }),
  deployments: many(deployments),
  configurationStates: many(configurationStates),
  messages: many(messages),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  configuration: one(configurations, { fields: [deployments.configurationId], references: [configurations.id] }),
  executedBy: one(users, { fields: [deployments.executedBy], references: [users.id] }),
  organization: one(organizations, { fields: [deployments.organizationId], references: [organizations.id] }),
  parentDeployment: one(deployments, { 
    fields: [deployments.parentDeploymentId], 
    references: [deployments.id],
    relationName: 'deploymentVersions'
  }),
}));

export const configurationStatesRelations = relations(configurationStates, ({ one }) => ({
  server: one(servers, { fields: [configurationStates.serverId], references: [servers.id] }),
  configuration: one(configurations, { fields: [configurationStates.configurationId], references: [configurations.id] }),
  organization: one(organizations, { fields: [configurationStates.organizationId], references: [organizations.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  organization: one(organizations, { fields: [conversations.organizationId], references: [organizations.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  configuration: one(configurations, { fields: [messages.configurationId], references: [configurations.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  organization: one(organizations, { fields: [auditLogs.organizationId], references: [organizations.id] }),
}));

// RBAC Relations
export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, { fields: [roles.organizationId], references: [organizations.id] }),
  createdBy: one(users, { fields: [roles.createdBy], references: [users.id] }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  assignedBy: one(users, { fields: [userRoles.assignedBy], references: [users.id] }),
}));

// AWS Integration Tables
export const awsIntegrations = pgTable('aws_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  roleArn: text('role_arn').notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  regions: jsonb('regions').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const awsInstances = pgTable('aws_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationId: uuid('integration_id').references(() => awsIntegrations.id, { onDelete: 'cascade' }).notNull(),
  instanceId: varchar('instance_id', { length: 255 }).notNull(),
  region: varchar('region', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }),
  state: varchar('state', { length: 50 }),
  instanceType: varchar('instance_type', { length: 50 }),
  publicIp: varchar('public_ip', { length: 45 }),
  privateIp: varchar('private_ip', { length: 45 }),
  publicDns: text('public_dns'),
  privateDns: text('private_dns'),
  keyName: varchar('key_name', { length: 255 }),
  vpcId: varchar('vpc_id', { length: 255 }),
  subnetId: varchar('subnet_id', { length: 255 }),
  securityGroups: jsonb('security_groups').$type<any[]>().default([]),
  tags: jsonb('tags').$type<Record<string, string>>().default({}),
  platform: varchar('platform', { length: 50 }),
  launchTime: timestamp('launch_time'),
  metadata: jsonb('metadata').$type<any>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Organization Settings Table
export const organizationSettings = pgTable('organization_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull().unique(),
  claudeApiKey: text('claude_api_key'), // Encrypted
  defaultRegion: varchar('default_region', { length: 50 }).default('us-east-1'),
  maxConcurrentDeployments: integer('max_concurrent_deployments').default(5),
  deploymentTimeout: integer('deployment_timeout').default(300),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// AWS Integration Relations
export const awsIntegrationsRelations = relations(awsIntegrations, ({ one, many }) => ({
  organization: one(organizations, { fields: [awsIntegrations.organizationId], references: [organizations.id] }),
  instances: many(awsInstances),
}));

export const awsInstancesRelations = relations(awsInstances, ({ one }) => ({
  integration: one(awsIntegrations, { fields: [awsInstances.integrationId], references: [awsIntegrations.id] }),
}));

// Asset Management Tables
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetTag: varchar('asset_tag', { length: 100 }).notNull().unique(),
  serialNumber: varchar('serial_number', { length: 255 }),
  assetType: varchar('asset_type', { length: 50 }).notNull(), // laptop, desktop, tablet, phone, monitor, printer, etc.
  brand: varchar('brand', { length: 100 }).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('available'), // available, assigned, in_repair, retired, missing
  condition: varchar('condition', { length: 50 }).default('good'), // excellent, good, fair, poor
  purchaseDate: date('purchase_date'),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('USD'),
  supplier: varchar('supplier', { length: 255 }),
  warrantyStartDate: date('warranty_start_date'),
  warrantyEndDate: date('warranty_end_date'),
  warrantyProvider: varchar('warranty_provider', { length: 255 }),
  location: varchar('location', { length: 255 }),
  costCenter: varchar('cost_center', { length: 100 }),
  department: varchar('department', { length: 100 }),
  category: varchar('category', { length: 100 }), // IT Equipment, Office Equipment, Furniture, etc.
  subcategory: varchar('subcategory', { length: 100 }), // Laptop, Desktop, Mobile Device, etc.
  specifications: jsonb('specifications').$type<Record<string, any>>().default({}), // CPU, RAM, Storage, OS, etc.
  notes: text('notes'),
  barcode: varchar('barcode', { length: 255 }),
  qrCode: varchar('qr_code', { length: 255 }),
  imageUrl: varchar('image_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  mdmDeviceId: uuid('mdm_device_id').references(() => mdmDevices.id),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const assetAssignments = pgTable('asset_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  assignedBy: uuid('assigned_by').references(() => users.id).notNull(),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  returnedAt: timestamp('returned_at'),
  returnedBy: uuid('returned_by').references(() => users.id),
  assignmentType: varchar('assignment_type', { length: 50 }).default('permanent'), // permanent, temporary, loan
  expectedReturnDate: date('expected_return_date'),
  assignmentNotes: text('assignment_notes'),
  returnNotes: text('return_notes'),
  assignmentLocation: varchar('assignment_location', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const assetHistory = pgTable('asset_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 100 }).notNull(), // created, updated, assigned, returned, repaired, retired, etc.
  oldValues: jsonb('old_values').$type<Record<string, any>>(),
  newValues: jsonb('new_values').$type<Record<string, any>>(),
  performedBy: uuid('performed_by').references(() => users.id).notNull(),
  notes: text('notes'),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const assetMaintenance = pgTable('asset_maintenance', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  maintenanceType: varchar('maintenance_type', { length: 50 }).notNull(), // repair, upgrade, inspection, cleaning
  status: varchar('status', { length: 50 }).notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled
  scheduledDate: date('scheduled_date'),
  completedDate: date('completed_date'),
  cost: decimal('cost', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('USD'),
  vendor: varchar('vendor', { length: 255 }),
  description: text('description').notNull(),
  notes: text('notes'),
  performedBy: uuid('performed_by').references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const assetCategories = pgTable('asset_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentCategoryId: uuid('parent_category_id'),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const assetLocations = pgTable('asset_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  address: text('address'),
  parentLocationId: uuid('parent_location_id'),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Asset Relations
export const assetsRelations = relations(assets, ({ one, many }) => ({
  organization: one(organizations, { fields: [assets.organizationId], references: [organizations.id] }),
  createdBy: one(users, { fields: [assets.createdBy], references: [users.id] }),
  assignments: many(assetAssignments),
  history: many(assetHistory),
  maintenance: many(assetMaintenance),
}));

export const assetAssignmentsRelations = relations(assetAssignments, ({ one }) => ({
  asset: one(assets, { fields: [assetAssignments.assetId], references: [assets.id] }),
  user: one(users, { fields: [assetAssignments.userId], references: [users.id] }),
  assignedBy: one(users, { fields: [assetAssignments.assignedBy], references: [users.id] }),
  returnedBy: one(users, { fields: [assetAssignments.returnedBy], references: [users.id] }),
  organization: one(organizations, { fields: [assetAssignments.organizationId], references: [organizations.id] }),
}));

export const assetHistoryRelations = relations(assetHistory, ({ one }) => ({
  asset: one(assets, { fields: [assetHistory.assetId], references: [assets.id] }),
  performedBy: one(users, { fields: [assetHistory.performedBy], references: [users.id] }),
  organization: one(organizations, { fields: [assetHistory.organizationId], references: [organizations.id] }),
}));

export const assetMaintenanceRelations = relations(assetMaintenance, ({ one }) => ({
  asset: one(assets, { fields: [assetMaintenance.assetId], references: [assets.id] }),
  performedBy: one(users, { fields: [assetMaintenance.performedBy], references: [users.id] }),
  createdBy: one(users, { fields: [assetMaintenance.createdBy], references: [users.id] }),
  organization: one(organizations, { fields: [assetMaintenance.organizationId], references: [organizations.id] }),
}));

// GitHub Integration Tables
export const githubIntegrations = pgTable('github_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  githubUserId: varchar('github_user_id', { length: 255 }).notNull(),
  githubUsername: varchar('github_username', { length: 255 }).notNull(),
  accessToken: text('access_token').notNull(), // Encrypted
  refreshToken: text('refresh_token'), // Encrypted
  tokenExpiresAt: timestamp('token_expires_at'),
  repositoryId: varchar('repository_id', { length: 255 }).notNull(),
  repositoryName: varchar('repository_name', { length: 255 }).notNull(),
  repositoryFullName: varchar('repository_full_name', { length: 512 }).notNull(),
  defaultBranch: varchar('default_branch', { length: 255 }).notNull().default('main'),
  basePath: varchar('base_path', { length: 512 }).default('/configs'),
  isActive: boolean('is_active').notNull().default(true),
  autoFetch: boolean('auto_fetch').notNull().default(false),
  fetchInterval: integer('fetch_interval').default(300), // seconds
  lastFetchAt: timestamp('last_fetch_at'),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const configurationGithubMappings = pgTable('configuration_github_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  configurationId: uuid('configuration_id').references(() => configurations.id, { onDelete: 'cascade' }).notNull(),
  githubIntegrationId: uuid('github_integration_id').references(() => githubIntegrations.id, { onDelete: 'cascade' }).notNull(),
  relativePath: varchar('relative_path', { length: 512 }).notNull(),
  branch: varchar('branch', { length: 255 }).notNull(),
  autoSync: boolean('auto_sync').notNull().default(false),
  syncOnChange: boolean('sync_on_change').notNull().default(true),
  lastSyncedSha: varchar('last_synced_sha', { length: 40 }),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const githubPullRequests = pgTable('github_pull_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubIntegrationId: uuid('github_integration_id').references(() => githubIntegrations.id, { onDelete: 'cascade' }).notNull(),
  configurationId: uuid('configuration_id').references(() => configurations.id, { onDelete: 'cascade' }),
  prNumber: integer('pr_number').notNull(),
  prId: varchar('pr_id', { length: 255 }).notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  description: text('description'),
  headBranch: varchar('head_branch', { length: 255 }).notNull(),
  baseBranch: varchar('base_branch', { length: 255 }).notNull(),
  state: varchar('state', { length: 50 }).notNull(), // open, closed, merged
  htmlUrl: text('html_url').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  mergedAt: timestamp('merged_at'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// GitHub Integration Relations
export const githubIntegrationsRelations = relations(githubIntegrations, ({ one, many }) => ({
  organization: one(organizations, { fields: [githubIntegrations.organizationId], references: [organizations.id] }),
  configurationMappings: many(configurationGithubMappings),
  pullRequests: many(githubPullRequests),
}));

export const configurationGithubMappingsRelations = relations(configurationGithubMappings, ({ one }) => ({
  configuration: one(configurations, { fields: [configurationGithubMappings.configurationId], references: [configurations.id] }),
  githubIntegration: one(githubIntegrations, { fields: [configurationGithubMappings.githubIntegrationId], references: [githubIntegrations.id] }),
}));

export const githubPullRequestsRelations = relations(githubPullRequests, ({ one }) => ({
  githubIntegration: one(githubIntegrations, { fields: [githubPullRequests.githubIntegrationId], references: [githubIntegrations.id] }),
  configuration: one(configurations, { fields: [githubPullRequests.configurationId], references: [configurations.id] }),
  createdBy: one(users, { fields: [githubPullRequests.createdBy], references: [users.id] }),
}));

// MDM (Mobile Device Management) Tables
export const mdmProfiles = pgTable('mdm_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  profileType: varchar('profile_type', { length: 50 }).notNull().default('macos'), // 'macos', 'windows', 'ios', 'android'
  // Profile configuration
  allowRemoteCommands: boolean('allow_remote_commands').notNull().default(true),
  allowLockDevice: boolean('allow_lock_device').notNull().default(true),
  allowShutdown: boolean('allow_shutdown').notNull().default(false),
  allowRestart: boolean('allow_restart').notNull().default(true),
  allowWakeOnLan: boolean('allow_wake_on_lan').notNull().default(true),
  // Security settings
  requireAuthentication: boolean('require_authentication').notNull().default(true),
  maxSessionDuration: integer('max_session_duration').default(3600), // seconds
  allowedIpRanges: jsonb('allowed_ip_ranges').$type<string[]>().default([]),
  // Enrollment settings
  enrollmentKey: varchar('enrollment_key', { length: 255 }).notNull(),
  enrollmentExpiresAt: timestamp('enrollment_expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mdmDevices = pgTable('mdm_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').references(() => mdmProfiles.id, { onDelete: 'cascade' }), // Made optional for agent-only enrollment
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  // Device identification
  deviceName: varchar('device_name', { length: 255 }).notNull(),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(), // Unique device identifier
  serialNumber: varchar('serial_number', { length: 255 }),
  model: varchar('model', { length: 255 }),
  osVersion: varchar('os_version', { length: 100 }),
  architecture: varchar('architecture', { length: 50 }), // 'arm64', 'x86_64'
  // Network information
  ipAddress: varchar('ip_address', { length: 45 }),
  macAddress: varchar('mac_address', { length: 17 }),
  hostname: varchar('hostname', { length: 255 }),
  // Status and health
  status: varchar('status', { length: 50 }).notNull().default('offline'), // 'online', 'offline', 'locked', 'shutdown'
  lastSeen: timestamp('last_seen'),
  lastHeartbeat: timestamp('last_heartbeat'),
  batteryLevel: integer('battery_level'), // 0-100 for laptops/mobile devices
  isCharging: boolean('is_charging'),
  // Agent information
  agentVersion: varchar('agent_version', { length: 50 }),
  agentInstallPath: text('agent_install_path'),
  // Enrollment
  enrolledAt: timestamp('enrolled_at').notNull().defaultNow(),
  enrolledBy: uuid('enrolled_by').references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').$type<any>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mdmCommands = pgTable('mdm_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => mdmDevices.id, { onDelete: 'cascade' }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  // Command details
  commandType: varchar('command_type', { length: 50 }).notNull(), // 'lock', 'unlock', 'shutdown', 'restart', 'wake', 'custom'
  command: text('command'), // For custom commands
  parameters: jsonb('parameters').$type<any>().default({}),
  // Execution details
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'sent', 'executing', 'completed', 'failed', 'timeout'
  output: text('output'),
  errorMessage: text('error_message'),
  exitCode: integer('exit_code'),
  // Timing
  sentAt: timestamp('sent_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  timeout: integer('timeout').default(300), // seconds
  // Audit
  initiatedBy: uuid('initiated_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mdmSessions = pgTable('mdm_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => mdmDevices.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  sessionToken: varchar('session_token', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  lastActivity: timestamp('last_activity').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  isActive: boolean('is_active').notNull().default(true),
});

// MDM Relations
export const mdmProfilesRelations = relations(mdmProfiles, ({ one, many }) => ({
  organization: one(organizations, { fields: [mdmProfiles.organizationId], references: [organizations.id] }),
  createdBy: one(users, { fields: [mdmProfiles.createdBy], references: [users.id] }),
  devices: many(mdmDevices),
}));

export const mdmDevicesRelations = relations(mdmDevices, ({ one, many }) => ({
  profile: one(mdmProfiles, { fields: [mdmDevices.profileId!], references: [mdmProfiles.id] }), // Optional profile
  organization: one(organizations, { fields: [mdmDevices.organizationId], references: [organizations.id] }),
  enrolledBy: one(users, { fields: [mdmDevices.enrolledBy!], references: [users.id] }), // Optional enrolledBy
  commands: many(mdmCommands),
  sessions: many(mdmSessions),
}));

export const mdmCommandsRelations = relations(mdmCommands, ({ one }) => ({
  device: one(mdmDevices, { fields: [mdmCommands.deviceId], references: [mdmDevices.id] }),
  organization: one(organizations, { fields: [mdmCommands.organizationId], references: [organizations.id] }),
  initiatedBy: one(users, { fields: [mdmCommands.initiatedBy], references: [users.id] }),
}));

export const mdmSessionsRelations = relations(mdmSessions, ({ one }) => ({
  device: one(mdmDevices, { fields: [mdmSessions.deviceId], references: [mdmDevices.id] }),
  user: one(users, { fields: [mdmSessions.userId], references: [users.id] }),
  organization: one(organizations, { fields: [mdmSessions.organizationId], references: [organizations.id] }),
}));

// System Settings Table - Global platform settings
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: jsonb('value').$type<any>().notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }).notNull().default('general'), // general, security, features, etc.
  isReadonly: boolean('is_readonly').notNull().default(false), // Some settings can't be modified via UI
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  createdByUser: one(users, { fields: [systemSettings.createdBy], references: [users.id] }),
  updatedByUser: one(users, { fields: [systemSettings.updatedBy], references: [users.id] }),
}));

// SSO Provider Table - Global SSO configuration (placed at end to avoid circular deps)
export const ssoProviders = pgTable('sso_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  providerType: varchar('provider_type', { length: 50 }).notNull().default('oidc'),
  clientId: varchar('client_id', { length: 500 }).notNull(),
  clientSecret: text('client_secret').notNull(), // encrypted
  discoveryUrl: text('discovery_url'),
  issuerUrl: text('issuer_url').notNull(),
  authorizationUrl: text('authorization_url').notNull(),
  tokenUrl: text('token_url').notNull(),
  userinfoUrl: text('userinfo_url').notNull(),
  jwksUri: text('jwks_uri'),
  scopes: text('scopes').array().default(['openid', 'profile', 'email']),
  claimsMapping: jsonb('claims_mapping').$type<Record<string, string>>().default({
    email: 'email',
    name: 'name',
    given_name: 'given_name',
    family_name: 'family_name'
  }),
  autoProvisionUsers: boolean('auto_provision_users').notNull().default(true),
  defaultRole: varchar('default_role', { length: 100 }).default('viewer'), // Role for subsequent users in org
  firstUserRole: varchar('first_user_role', { length: 100 }).default('administrator'), // Role for first user in new org
  roleMapping: jsonb('role_mapping').$type<Record<string, string>>().default({}), // Map SSO groups/roles to app roles
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// SSO Domain Mappings - Map email domains to organizations
export const ssoDomainMappings = pgTable('sso_domain_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  ssoProviderId: uuid('sso_provider_id').notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  organizationId: uuid('organization_id').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// User SSO Mappings - Link SSO accounts to internal users
export const userSsoMappings = pgTable('user_sso_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  ssoProviderId: uuid('sso_provider_id').notNull(),
  externalUserId: varchar('external_user_id', { length: 500 }).notNull(),
  externalEmail: varchar('external_email', { length: 255 }).notNull(),
  externalMetadata: jsonb('external_metadata').$type<Record<string, any>>().default({}),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==============================
// HIVE AGENT TABLES
// ==============================

// Hive Agents Registry
export const hiveAgents = pgTable('hive_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  apiKey: varchar('api_key', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  hostname: varchar('hostname', { length: 255 }).notNull(),
  pulseUrl: varchar('pulse_url', { length: 512 }),
  ipAddress: text('ip_address'), // Using text for inet type
  osType: varchar('os_type', { length: 50 }),
  osVersion: varchar('os_version', { length: 100 }),
  arch: varchar('arch', { length: 20 }),
  status: varchar('status', { length: 50 }).default('offline'),
  lastHeartbeat: timestamp('last_heartbeat'),
  installedAt: timestamp('installed_at').defaultNow(),
  version: varchar('version', { length: 50 }),
  capabilities: jsonb('capabilities').$type<string[]>().default([]),
  systemInfo: jsonb('system_info').$type<{
    cpu?: { cores: number; model: string; usage: number };
    memory?: { total: number; used: number; free: number };
    disk?: { total: number; used: number; free: number };
  }>().default({}),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Hive Agent Configurations
export const hiveAgentConfigs = pgTable('hive_agent_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => hiveAgents.id).notNull(),
  configType: varchar('config_type', { length: 50 }).notNull(),
  configName: varchar('config_name', { length: 255 }).notNull(),
  enabled: boolean('enabled').default(true),
  config: jsonb('config').$type<any>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Hive Telemetry Data
export const hiveTelemetry = pgTable('hive_telemetry', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => hiveAgents.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  source: varchar('source', { length: 255 }),
  data: jsonb('data').$type<any>().notNull(),
  timestamp: timestamp('timestamp').notNull(),
  processed: boolean('processed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Hive Issues/Alerts
export const hiveIssues = pgTable('hive_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => hiveAgents.id).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  category: varchar('category', { length: 100 }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  errorPattern: text('error_pattern'),
  context: jsonb('context').$type<Record<string, any>>().default({}),
  suggestedFix: text('suggested_fix'),
  autoFixable: boolean('auto_fixable').default(false),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionDetails: text('resolution_details'),
});

// Hive Commands
export const hiveCommands = pgTable('hive_commands', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => hiveAgents.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id'),
  commandType: varchar('command_type', { length: 50 }).notNull(),
  command: text('command').notNull(),
  parameters: jsonb('parameters').$type<Record<string, any>>().default({}),
  response: text('response'),
  exitCode: integer('exit_code'),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: varchar('status', { length: 50 }).default('pending'),
  executionTimeMs: integer('execution_time_ms'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
});

// Hive Output Endpoints
export const hiveOutputEndpoints = pgTable('hive_output_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  endpointUrl: text('endpoint_url').notNull(),
  authType: varchar('auth_type', { length: 50 }),
  authConfig: jsonb('auth_config').$type<Record<string, any>>().default({}),
  headers: jsonb('headers').$type<Record<string, string>>().default({}),
  batchSize: integer('batch_size').default(1000),
  flushIntervalSeconds: integer('flush_interval_seconds').default(10),
  retryConfig: jsonb('retry_config').$type<{
    maxRetries: number;
    backoffSeconds: number;
  }>().default({ maxRetries: 3, backoffSeconds: 5 }),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Agent to Output mappings
export const hiveAgentOutputs = pgTable('hive_agent_outputs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => hiveAgents.id).notNull(),
  endpointId: uuid('endpoint_id').references(() => hiveOutputEndpoints.id).notNull(),
  dataTypes: jsonb('data_types').$type<string[]>().default(['logs', 'metrics']),
  filters: jsonb('filters').$type<Record<string, any>>().default({}),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});