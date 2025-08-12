import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  organizationId: uuid('organization_id').references(() => organizations.id),
  isActive: boolean('is_active').notNull().default(true),
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