import { Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { auditLogs } from '@config-management/database';
import { AuthenticatedRequest } from './auth';

export const auditMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function (data) {
      res.send = originalSend;
      
      // Log the action after response is sent
      if (req.user && res.statusCode < 500) {
        const { action, resource, resourceId } = parseRequestInfo(req);
        
        // Skip logging for certain read operations to reduce noise
        const skipLogging = shouldSkipLogging(req, res.statusCode);
        
        if (!skipLogging) {
          db.insert(auditLogs)
            .values({
              userId: req.user.id,
              organizationId: req.user.organizationId,
              action,
              resource,
              resourceId,
              details: {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                duration: Date.now() - startTime,
                body: shouldLogBody(req) ? sanitizeBody(req.body) : undefined,
                query: req.query,
              },
              ipAddress: getClientIP(req),
              userAgent: req.get('user-agent'),
            })
            .catch(error => {
              console.error('Error logging audit:', error);
            });
        }
      }

      return originalSend.call(this, data);
    };

    next();
  } catch (error) {
    console.error('Audit middleware error:', error);
    next();
  }
};

/**
 * Parse request information to extract meaningful action and resource names
 */
function parseRequestInfo(req: AuthenticatedRequest): { action: string; resource: string; resourceId: string | null } {
  const method = req.method;
  const path = req.originalUrl;
  const pathParts = path.split('/').filter(Boolean);
  
  let resource = 'unknown';
  let resourceId: string | null = null;
  let action = method.toLowerCase();
  
  if (pathParts.length >= 2 && pathParts[0] === 'api') {
    resource = pathParts[1].replace('-', '_'); // Convert kebab-case to snake_case
    
    // Extract resource ID if present
    if (pathParts.length >= 3 && /^[a-f0-9-]{36}$/.test(pathParts[2])) {
      resourceId = pathParts[2];
    }
    
    // Determine more specific action based on path and method
    if (method === 'POST') {
      if (path.includes('/test')) {
        action = 'tested';
      } else if (path.includes('/execute') || path.includes('/run')) {
        action = 'executed';
      } else if (path.includes('/deploy')) {
        action = 'deployed';
      } else {
        action = 'created';
      }
    } else if (method === 'PUT' || method === 'PATCH') {
      action = 'updated';
    } else if (method === 'DELETE') {
      action = 'deleted';
    } else if (method === 'GET') {
      action = 'viewed';
    }
    
    // Handle special endpoints
    if (path.includes('/login')) {
      action = 'logged_in';
      resource = 'auth';
    } else if (path.includes('/logout')) {
      action = 'logged_out';
      resource = 'auth';
    } else if (path.includes('/register')) {
      action = 'registered';
      resource = 'auth';
    }
  }
  
  return { action, resource, resourceId };
}

/**
 * Determine if the request should be logged
 */
function shouldSkipLogging(req: AuthenticatedRequest, statusCode: number): boolean {
  const path = req.originalUrl;
  
  // Skip health checks
  if (path.includes('/health')) {
    return true;
  }
  
  // Skip failed authentication attempts (handled separately)
  if (statusCode === 401 || statusCode === 403) {
    return true;
  }
  
  // Skip frequent GET requests that don't modify data
  if (req.method === 'GET' && (
    path.includes('/audit-logs') ||
    path.includes('/stats') ||
    path.endsWith('/') ||
    path.includes('/actions') ||
    path.includes('/resources')
  )) {
    return true;
  }
  
  return false;
}

/**
 * Determine if request body should be logged
 */
function shouldLogBody(req: AuthenticatedRequest): boolean {
  // Don't log GET requests
  if (req.method === 'GET') {
    return false;
  }
  
  // Don't log sensitive authentication data
  if (req.originalUrl.includes('/auth/')) {
    return false;
  }
  
  // Don't log large file uploads
  const contentLength = parseInt(req.get('content-length') || '0');
  if (contentLength > 10000) { // 10KB limit
    return false;
  }
  
  return true;
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = [
    'password', 'currentPassword', 'newPassword', 'confirmPassword',
    'token', 'accessToken', 'refreshToken', 'apiKey', 'secret',
    'encryptedPrivateKey', 'privateKey', 'publicKey'
  ];
  
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Get the real client IP address
 */
function getClientIP(req: AuthenticatedRequest): string | null {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    null
  );
}