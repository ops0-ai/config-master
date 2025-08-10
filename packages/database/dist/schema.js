"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRolesRelations = exports.rolePermissionsRelations = exports.permissionsRelations = exports.rolesRelations = exports.auditLogsRelations = exports.messagesRelations = exports.conversationsRelations = exports.configurationStatesRelations = exports.deploymentsRelations = exports.configurationsRelations = exports.serversRelations = exports.serverGroupsRelations = exports.pemKeysRelations = exports.organizationsRelations = exports.usersRelations = exports.userRoles = exports.rolePermissions = exports.permissions = exports.roles = exports.auditLogs = exports.messages = exports.conversations = exports.configurationStates = exports.deployments = exports.configurations = exports.servers = exports.serverGroups = exports.pemKeys = exports.users = exports.organizations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.organizations = (0, pg_core_1.pgTable)('organizations', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    ownerId: (0, pg_core_1.uuid)('owner_id').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).unique().notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 50 }).notNull().default('user'),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.pemKeys = (0, pg_core_1.pgTable)('pem_keys', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    encryptedPrivateKey: (0, pg_core_1.text)('encrypted_private_key').notNull(),
    publicKey: (0, pg_core_1.text)('public_key'),
    fingerprint: (0, pg_core_1.varchar)('fingerprint', { length: 255 }),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.serverGroups = (0, pg_core_1.pgTable)('server_groups', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    defaultPemKeyId: (0, pg_core_1.uuid)('default_pem_key_id').references(() => exports.pemKeys.id),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.servers = (0, pg_core_1.pgTable)('servers', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    hostname: (0, pg_core_1.varchar)('hostname', { length: 255 }).notNull(),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }).notNull(),
    port: (0, pg_core_1.integer)('port').notNull().default(22),
    username: (0, pg_core_1.varchar)('username', { length: 255 }).notNull().default('root'),
    operatingSystem: (0, pg_core_1.varchar)('operating_system', { length: 100 }),
    osVersion: (0, pg_core_1.varchar)('os_version', { length: 100 }),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('unknown'),
    lastSeen: (0, pg_core_1.timestamp)('last_seen'),
    groupId: (0, pg_core_1.uuid)('group_id').references(() => exports.serverGroups.id),
    pemKeyId: (0, pg_core_1.uuid)('pem_key_id').references(() => exports.pemKeys.id),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.configurations = (0, pg_core_1.pgTable)('configurations', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    type: (0, pg_core_1.varchar)('type', { length: 100 }).notNull(),
    ansiblePlaybook: (0, pg_core_1.text)('ansible_playbook').notNull(),
    variables: (0, pg_core_1.jsonb)('variables'),
    tags: (0, pg_core_1.jsonb)('tags'),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    createdBy: (0, pg_core_1.uuid)('created_by').references(() => exports.users.id).notNull(),
    isTemplate: (0, pg_core_1.boolean)('is_template').notNull().default(false),
    version: (0, pg_core_1.integer)('version').notNull().default(1),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.deployments = (0, pg_core_1.pgTable)('deployments', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    section: (0, pg_core_1.varchar)('section', { length: 100 }).default('general'),
    version: (0, pg_core_1.integer)('version').notNull().default(1),
    parentDeploymentId: (0, pg_core_1.uuid)('parent_deployment_id'),
    configurationId: (0, pg_core_1.uuid)('configuration_id').references(() => exports.configurations.id).notNull(),
    targetType: (0, pg_core_1.varchar)('target_type', { length: 50 }).notNull(),
    targetId: (0, pg_core_1.uuid)('target_id').notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('pending'),
    startedAt: (0, pg_core_1.timestamp)('started_at'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    logs: (0, pg_core_1.text)('logs'),
    output: (0, pg_core_1.text)('output'),
    errorMessage: (0, pg_core_1.text)('error_message'),
    executedBy: (0, pg_core_1.uuid)('executed_by').references(() => exports.users.id).notNull(),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.configurationStates = (0, pg_core_1.pgTable)('configuration_states', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    serverId: (0, pg_core_1.uuid)('server_id').references(() => exports.servers.id).notNull(),
    configurationId: (0, pg_core_1.uuid)('configuration_id').references(() => exports.configurations.id).notNull(),
    expectedState: (0, pg_core_1.jsonb)('expected_state').notNull(),
    actualState: (0, pg_core_1.jsonb)('actual_state'),
    status: (0, pg_core_1.varchar)('status', { length: 50 }).notNull().default('unknown'),
    lastChecked: (0, pg_core_1.timestamp)('last_checked'),
    driftDetected: (0, pg_core_1.boolean)('drift_detected').notNull().default(false),
    driftDetails: (0, pg_core_1.jsonb)('drift_details'),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.conversations = (0, pg_core_1.pgTable)('conversations', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    conversationId: (0, pg_core_1.uuid)('conversation_id').references(() => exports.conversations.id).notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 20 }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    generatedConfiguration: (0, pg_core_1.text)('generated_configuration'),
    configurationId: (0, pg_core_1.uuid)('configuration_id').references(() => exports.configurations.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    action: (0, pg_core_1.varchar)('action', { length: 100 }).notNull(),
    resource: (0, pg_core_1.varchar)('resource', { length: 100 }).notNull(),
    resourceId: (0, pg_core_1.uuid)('resource_id'),
    details: (0, pg_core_1.jsonb)('details'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// RBAC Tables for Role-Based Access Control
exports.roles = (0, pg_core_1.pgTable)('roles', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    organizationId: (0, pg_core_1.uuid)('organization_id').references(() => exports.organizations.id).notNull(),
    isSystem: (0, pg_core_1.boolean)('is_system').notNull().default(false), // System roles cannot be deleted
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    createdBy: (0, pg_core_1.uuid)('created_by').references(() => exports.users.id),
});
exports.permissions = (0, pg_core_1.pgTable)('permissions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    resource: (0, pg_core_1.varchar)('resource', { length: 100 }).notNull(), // e.g., 'servers', 'deployments', 'settings'
    action: (0, pg_core_1.varchar)('action', { length: 50 }).notNull(), // e.g., 'read', 'write', 'delete', 'execute'
    description: (0, pg_core_1.text)('description'),
    isSystem: (0, pg_core_1.boolean)('is_system').notNull().default(true), // System permissions cannot be modified
});
exports.rolePermissions = (0, pg_core_1.pgTable)('role_permissions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    roleId: (0, pg_core_1.uuid)('role_id').references(() => exports.roles.id).notNull(),
    permissionId: (0, pg_core_1.uuid)('permission_id').references(() => exports.permissions.id).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.userRoles = (0, pg_core_1.pgTable)('user_roles', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    roleId: (0, pg_core_1.uuid)('role_id').references(() => exports.roles.id).notNull(),
    assignedBy: (0, pg_core_1.uuid)('assigned_by').references(() => exports.users.id),
    assignedAt: (0, pg_core_1.timestamp)('assigned_at').defaultNow().notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.users.organizationId], references: [exports.organizations.id] }),
    ownedOrganizations: many(exports.organizations),
    configurations: many(exports.configurations),
    deployments: many(exports.deployments),
    conversations: many(exports.conversations),
    auditLogs: many(exports.auditLogs),
    userRoles: many(exports.userRoles),
    createdRoles: many(exports.roles, { relationName: 'createdRoles' }),
    assignedRoles: many(exports.userRoles, { relationName: 'assignedRoles' }),
}));
exports.organizationsRelations = (0, drizzle_orm_1.relations)(exports.organizations, ({ many, one }) => ({
    owner: one(exports.users, { fields: [exports.organizations.ownerId], references: [exports.users.id] }),
    users: many(exports.users),
    pemKeys: many(exports.pemKeys),
    serverGroups: many(exports.serverGroups),
    servers: many(exports.servers),
    configurations: many(exports.configurations),
    deployments: many(exports.deployments),
    configurationStates: many(exports.configurationStates),
    conversations: many(exports.conversations),
    auditLogs: many(exports.auditLogs),
    roles: many(exports.roles),
}));
exports.pemKeysRelations = (0, drizzle_orm_1.relations)(exports.pemKeys, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.pemKeys.organizationId], references: [exports.organizations.id] }),
    servers: many(exports.servers),
    serverGroups: many(exports.serverGroups),
}));
exports.serverGroupsRelations = (0, drizzle_orm_1.relations)(exports.serverGroups, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.serverGroups.organizationId], references: [exports.organizations.id] }),
    defaultPemKey: one(exports.pemKeys, { fields: [exports.serverGroups.defaultPemKeyId], references: [exports.pemKeys.id] }),
    servers: many(exports.servers),
}));
exports.serversRelations = (0, drizzle_orm_1.relations)(exports.servers, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.servers.organizationId], references: [exports.organizations.id] }),
    group: one(exports.serverGroups, { fields: [exports.servers.groupId], references: [exports.serverGroups.id] }),
    pemKey: one(exports.pemKeys, { fields: [exports.servers.pemKeyId], references: [exports.pemKeys.id] }),
    configurationStates: many(exports.configurationStates),
}));
exports.configurationsRelations = (0, drizzle_orm_1.relations)(exports.configurations, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.configurations.organizationId], references: [exports.organizations.id] }),
    createdBy: one(exports.users, { fields: [exports.configurations.createdBy], references: [exports.users.id] }),
    deployments: many(exports.deployments),
    configurationStates: many(exports.configurationStates),
    messages: many(exports.messages),
}));
exports.deploymentsRelations = (0, drizzle_orm_1.relations)(exports.deployments, ({ one }) => ({
    configuration: one(exports.configurations, { fields: [exports.deployments.configurationId], references: [exports.configurations.id] }),
    executedBy: one(exports.users, { fields: [exports.deployments.executedBy], references: [exports.users.id] }),
    organization: one(exports.organizations, { fields: [exports.deployments.organizationId], references: [exports.organizations.id] }),
    parentDeployment: one(exports.deployments, {
        fields: [exports.deployments.parentDeploymentId],
        references: [exports.deployments.id],
        relationName: 'deploymentVersions'
    }),
}));
exports.configurationStatesRelations = (0, drizzle_orm_1.relations)(exports.configurationStates, ({ one }) => ({
    server: one(exports.servers, { fields: [exports.configurationStates.serverId], references: [exports.servers.id] }),
    configuration: one(exports.configurations, { fields: [exports.configurationStates.configurationId], references: [exports.configurations.id] }),
    organization: one(exports.organizations, { fields: [exports.configurationStates.organizationId], references: [exports.organizations.id] }),
}));
exports.conversationsRelations = (0, drizzle_orm_1.relations)(exports.conversations, ({ one, many }) => ({
    user: one(exports.users, { fields: [exports.conversations.userId], references: [exports.users.id] }),
    organization: one(exports.organizations, { fields: [exports.conversations.organizationId], references: [exports.organizations.id] }),
    messages: many(exports.messages),
}));
exports.messagesRelations = (0, drizzle_orm_1.relations)(exports.messages, ({ one }) => ({
    conversation: one(exports.conversations, { fields: [exports.messages.conversationId], references: [exports.conversations.id] }),
    configuration: one(exports.configurations, { fields: [exports.messages.configurationId], references: [exports.configurations.id] }),
}));
exports.auditLogsRelations = (0, drizzle_orm_1.relations)(exports.auditLogs, ({ one }) => ({
    user: one(exports.users, { fields: [exports.auditLogs.userId], references: [exports.users.id] }),
    organization: one(exports.organizations, { fields: [exports.auditLogs.organizationId], references: [exports.organizations.id] }),
}));
// RBAC Relations
exports.rolesRelations = (0, drizzle_orm_1.relations)(exports.roles, ({ one, many }) => ({
    organization: one(exports.organizations, { fields: [exports.roles.organizationId], references: [exports.organizations.id] }),
    createdBy: one(exports.users, { fields: [exports.roles.createdBy], references: [exports.users.id] }),
    rolePermissions: many(exports.rolePermissions),
    userRoles: many(exports.userRoles),
}));
exports.permissionsRelations = (0, drizzle_orm_1.relations)(exports.permissions, ({ many }) => ({
    rolePermissions: many(exports.rolePermissions),
}));
exports.rolePermissionsRelations = (0, drizzle_orm_1.relations)(exports.rolePermissions, ({ one }) => ({
    role: one(exports.roles, { fields: [exports.rolePermissions.roleId], references: [exports.roles.id] }),
    permission: one(exports.permissions, { fields: [exports.rolePermissions.permissionId], references: [exports.permissions.id] }),
}));
exports.userRolesRelations = (0, drizzle_orm_1.relations)(exports.userRoles, ({ one }) => ({
    user: one(exports.users, { fields: [exports.userRoles.userId], references: [exports.users.id] }),
    role: one(exports.roles, { fields: [exports.userRoles.roleId], references: [exports.roles.id] }),
    assignedBy: one(exports.users, { fields: [exports.userRoles.assignedBy], references: [exports.users.id] }),
}));
//# sourceMappingURL=schema.js.map