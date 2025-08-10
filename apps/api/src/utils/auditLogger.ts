import { db } from '../index';
import { auditLogs } from '@config-management/database';

export interface AuditLogData {
  userId?: string;
  organizationId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Manual audit logging utility for important system events
 * that aren't captured by the middleware
 */
export async function logSystemEvent(data: AuditLogData): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: data.userId || null,
      organizationId: data.organizationId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
      details: data.details || {},
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  } catch (error) {
    console.error('Error logging system event:', error);
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: 'login_success' | 'login_failed' | 'logout' | 'password_changed' | 'account_locked',
  organizationId: string,
  userId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logSystemEvent({
    userId,
    organizationId,
    action,
    resource: 'authentication',
    details,
    ipAddress,
    userAgent,
  });
}

/**
 * Log role and permission changes
 */
export async function logRoleEvent(
  action: 'role_created' | 'role_updated' | 'role_deleted' | 'permission_granted' | 'permission_revoked',
  organizationId: string,
  userId: string,
  roleId: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logSystemEvent({
    userId,
    organizationId,
    action,
    resource: 'roles',
    resourceId: roleId,
    details,
    ipAddress,
    userAgent,
  });
}

/**
 * Log deployment and configuration events
 */
export async function logDeploymentEvent(
  action: 'deployment_started' | 'deployment_completed' | 'deployment_failed' | 'deployment_cancelled',
  organizationId: string,
  userId: string,
  deploymentId: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logSystemEvent({
    userId,
    organizationId,
    action,
    resource: 'deployments',
    resourceId: deploymentId,
    details,
    ipAddress,
    userAgent,
  });
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  action: 'unauthorized_access' | 'permission_denied' | 'key_uploaded' | 'key_deleted' | 'suspicious_activity',
  organizationId: string,
  userId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logSystemEvent({
    userId,
    organizationId,
    action,
    resource: 'security',
    details,
    ipAddress,
    userAgent,
  });
}

/**
 * Log system administration events
 */
export async function logSystemAdminEvent(
  action: 'system_settings_changed' | 'user_created' | 'user_deactivated' | 'organization_updated',
  organizationId: string,
  userId: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logSystemEvent({
    userId,
    organizationId,
    action,
    resource: 'system_admin',
    details,
    ipAddress,
    userAgent,
  });
}