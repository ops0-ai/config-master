import { Router } from 'express';
import { db } from '../index';
import { ssoProviders, ssoDomainMappings, userSsoMappings, users, organizations, systemSettings } from '@config-management/database';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Issuer, generators, Client } from 'openid-client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const router = Router();

// Encryption helpers
const ENCRYPTION_KEY = process.env.SSO_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key';
const algorithm = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  const encrypted = parts[3];
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Get all SSO providers (super admin only)
router.get('/providers', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can manage SSO providers' });
    }

    const providers = await db
      .select({
        id: ssoProviders.id,
        name: ssoProviders.name,
        providerType: ssoProviders.providerType,
        clientId: ssoProviders.clientId,
        discoveryUrl: ssoProviders.discoveryUrl,
        issuerUrl: ssoProviders.issuerUrl,
        autoProvisionUsers: ssoProviders.autoProvisionUsers,
        defaultRole: ssoProviders.defaultRole,
        firstUserRole: ssoProviders.firstUserRole,
        roleMapping: ssoProviders.roleMapping,
        isActive: ssoProviders.isActive,
        createdAt: ssoProviders.createdAt,
        updatedAt: ssoProviders.updatedAt,
      })
      .from(ssoProviders)
      .orderBy(ssoProviders.createdAt);

    res.json(providers);
  } catch (error) {
    console.error('Error fetching SSO providers:', error);
    res.status(500).json({ error: 'Failed to fetch SSO providers' });
  }
});

// Create SSO provider (super admin only)
router.post('/providers', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can create SSO providers' });
    }

    const {
      name,
      providerType = 'oidc',
      clientId,
      clientSecret,
      discoveryUrl,
      issuerUrl,
      authorizationUrl,
      tokenUrl,
      userinfoUrl,
      jwksUri,
      scopes = ['openid', 'profile', 'email'],
      autoProvisionUsers = true,
      defaultRole = 'viewer',
      firstUserRole = 'administrator',
      roleMapping = {}
    } = req.body;

    // Validate required fields
    if (!name || !clientId || !clientSecret) {
      return res.status(400).json({ error: 'Name, clientId, and clientSecret are required' });
    }

    // If discovery URL is provided, fetch OIDC configuration
    let oidcConfig: any = {};
    if (discoveryUrl) {
      try {
        const issuer = await Issuer.discover(discoveryUrl);
        oidcConfig = {
          issuerUrl: issuer.metadata.issuer,
          authorizationUrl: issuer.metadata.authorization_endpoint,
          tokenUrl: issuer.metadata.token_endpoint,
          userinfoUrl: issuer.metadata.userinfo_endpoint,
          jwksUri: issuer.metadata.jwks_uri,
        };
      } catch (error) {
        console.error('Failed to discover OIDC configuration:', error);
        return res.status(400).json({ error: 'Failed to discover OIDC configuration from discovery URL' });
      }
    }

    // Encrypt client secret
    const encryptedSecret = encrypt(clientSecret);

    const [provider] = await db.insert(ssoProviders).values({
      name,
      providerType,
      clientId,
      clientSecret: encryptedSecret,
      discoveryUrl,
      issuerUrl: oidcConfig.issuerUrl || issuerUrl,
      authorizationUrl: oidcConfig.authorizationUrl || authorizationUrl,
      tokenUrl: oidcConfig.tokenUrl || tokenUrl,
      userinfoUrl: oidcConfig.userinfoUrl || userinfoUrl,
      jwksUri: oidcConfig.jwksUri || jwksUri,
      scopes,
      autoProvisionUsers,
      defaultRole,
      firstUserRole,
      roleMapping,
      isActive: true,
      createdBy: req.user.id,
    }).returning();

    console.log(`✅ SSO provider '${name}' created by ${req.user.email}`);

    // Return provider without sensitive data
    const { clientSecret: _, ...safeProvider } = provider;
    res.json(safeProvider);
  } catch (error) {
    console.error('Error creating SSO provider:', error);
    res.status(500).json({ error: 'Failed to create SSO provider' });
  }
});

// Update SSO provider (super admin only)
router.put('/providers/:id', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can update SSO providers' });
    }

    const { id } = req.params;
    const body = req.body;

    // Filter and validate update fields
    const allowedFields = [
      'name', 'providerType', 'clientId', 'clientSecret', 'discoveryUrl',
      'issuerUrl', 'authorizationUrl', 'tokenUrl', 'userinfoUrl', 'jwksUri',
      'scopes', 'autoProvisionUsers', 'defaultRole', 'firstUserRole', 'roleMapping', 'isActive'
    ];

    const updates: any = {};

    // Only include allowed fields that are not undefined
    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== null) {
        updates[field] = body[field];
      }
    }

    // Remove fields that shouldn't be updated if they're empty/undefined
    if (!updates.clientSecret || updates.clientSecret === '') {
      delete updates.clientSecret;
    }

    // Encrypt client secret if provided
    if (updates.clientSecret) {
      updates.clientSecret = encrypt(updates.clientSecret);
    }

    // If discovery URL is updated, refresh OIDC config
    if (updates.discoveryUrl) {
      try {
        const issuer = await Issuer.discover(updates.discoveryUrl);
        updates.issuerUrl = issuer.metadata.issuer;
        updates.authorizationUrl = issuer.metadata.authorization_endpoint;
        updates.tokenUrl = issuer.metadata.token_endpoint;
        updates.userinfoUrl = issuer.metadata.userinfo_endpoint;
        updates.jwksUri = issuer.metadata.jwks_uri;
      } catch (error) {
        console.error('Failed to discover OIDC configuration:', error);
      }
    }

    // Always update the timestamp
    updates.updatedAt = new Date();

    const [provider] = await db
      .update(ssoProviders)
      .set(updates)
      .where(eq(ssoProviders.id, id))
      .returning();

    console.log(`✅ SSO provider updated by ${req.user.email}`);

    // Return provider without sensitive data
    const { clientSecret: _, ...safeProvider } = provider;
    res.json(safeProvider);
  } catch (error) {
    console.error('Error updating SSO provider:', error);
    res.status(500).json({ error: 'Failed to update SSO provider' });
  }
});

// Delete SSO provider (super admin only)
router.delete('/providers/:id', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can delete SSO providers' });
    }

    const { id } = req.params;

    await db.delete(ssoProviders).where(eq(ssoProviders.id, id));

    console.log(`✅ SSO provider deleted by ${req.user.email}`);
    res.json({ message: 'SSO provider deleted successfully' });
  } catch (error) {
    console.error('Error deleting SSO provider:', error);
    res.status(500).json({ error: 'Failed to delete SSO provider' });
  }
});

// Test SSO connection (super admin only)
router.post('/providers/:id/test', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can test SSO providers' });
    }

    const { id } = req.params;

    const [provider] = await db
      .select()
      .from(ssoProviders)
      .where(eq(ssoProviders.id, id))
      .limit(1);

    if (!provider) {
      return res.status(404).json({ error: 'SSO provider not found' });
    }

    try {
      // Attempt to discover OIDC configuration
      let issuer;
      if (provider.discoveryUrl) {
        try {
          issuer = await Issuer.discover(provider.discoveryUrl);
        } catch (discoveryError: any) {
          return res.json({
            success: false,
            message: 'OIDC Discovery failed',
            error: `Failed to discover OIDC configuration: ${discoveryError.message}`
          });
        }
      } else {
        // Validate required manual configuration
        if (!provider.issuerUrl || !provider.authorizationUrl || !provider.tokenUrl) {
          return res.json({
            success: false,
            message: 'Missing required OIDC endpoints',
            error: 'Manual configuration requires issuer URL, authorization URL, and token URL'
          });
        }

        issuer = new Issuer({
          issuer: provider.issuerUrl,
          authorization_endpoint: provider.authorizationUrl,
          token_endpoint: provider.tokenUrl,
          userinfo_endpoint: provider.userinfoUrl,
          jwks_uri: provider.jwksUri || undefined,
        });
      }

      // Validate issuer metadata
      if (!issuer.metadata.authorization_endpoint || !issuer.metadata.token_endpoint) {
        return res.json({
          success: false,
          message: 'Invalid OIDC configuration',
          error: 'Missing required endpoints in OIDC configuration'
        });
      }

      // Create client and validate
      try {
        const client = new issuer.Client({
          client_id: provider.clientId,
          client_secret: decrypt(provider.clientSecret),
        });

        // Test authorization URL generation (this validates the client configuration)
        const authUrl = client.authorizationUrl({
          scope: 'openid email profile',
          state: 'test-state',
          nonce: 'test-nonce',
        });

        if (!authUrl || !authUrl.includes('client_id')) {
          return res.json({
            success: false,
            message: 'Client configuration invalid',
            error: 'Failed to generate authorization URL with provided client credentials'
          });
        }

      } catch (clientError: any) {
        return res.json({
          success: false,
          message: 'Client creation failed',
          error: `Invalid client configuration: ${clientError.message}`
        });
      }

      res.json({
        success: true,
        message: 'SSO provider connection test successful',
        details: {
          issuer: issuer.metadata.issuer,
          authorizationEndpoint: issuer.metadata.authorization_endpoint,
          tokenEndpoint: issuer.metadata.token_endpoint,
          userinfoEndpoint: issuer.metadata.userinfo_endpoint,
          jwksUri: issuer.metadata.jwks_uri,
          supportedScopes: issuer.metadata.scopes_supported,
        }
      });
    } catch (error: any) {
      console.error('SSO connection test failed:', error);
      res.json({
        success: false,
        message: 'SSO provider connection test failed',
        error: `Unexpected error: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Error testing SSO provider:', error);
    res.status(500).json({ error: 'Failed to test SSO provider' });
  }
});

// Get SSO domain mappings
router.get('/domain-mappings', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can view domain mappings' });
    }

    const mappings = await db
      .select({
        id: ssoDomainMappings.id,
        ssoProviderId: ssoDomainMappings.ssoProviderId,
        domain: ssoDomainMappings.domain,
        organizationId: ssoDomainMappings.organizationId,
        organizationName: organizations.name,
        isDefault: ssoDomainMappings.isDefault,
      })
      .from(ssoDomainMappings)
      .leftJoin(organizations, eq(ssoDomainMappings.organizationId, organizations.id))
      .orderBy(ssoDomainMappings.domain);

    res.json(mappings);
  } catch (error) {
    console.error('Error fetching domain mappings:', error);
    res.status(500).json({ error: 'Failed to fetch domain mappings' });
  }
});

// Create domain mapping
router.post('/domain-mappings', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can create domain mappings' });
    }

    const { ssoProviderId, domain, organizationId, isDefault = false } = req.body;

    if (!ssoProviderId || !domain || !organizationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [mapping] = await db.insert(ssoDomainMappings).values({
      ssoProviderId,
      domain: domain.toLowerCase(),
      organizationId,
      isDefault,
    }).returning();

    console.log(`✅ Domain mapping created for ${domain} by ${req.user.email}`);
    res.json(mapping);
  } catch (error) {
    console.error('Error creating domain mapping:', error);
    res.status(500).json({ error: 'Failed to create domain mapping' });
  }
});

// Delete domain mapping
router.delete('/domain-mappings/:id', authMiddleware, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only super admins can delete domain mappings' });
    }

    const { id } = req.params;
    await db.delete(ssoDomainMappings).where(eq(ssoDomainMappings.id, id));

    console.log(`✅ Domain mapping deleted by ${req.user.email}`);
    res.json({ message: 'Domain mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting domain mapping:', error);
    res.status(500).json({ error: 'Failed to delete domain mapping' });
  }
});

// Get enabled SSO providers for login page (public endpoint)
router.get('/login-providers', async (req, res): Promise<any> => {
  try {
    const providers = await db
      .select({
        id: ssoProviders.id,
        name: ssoProviders.name,
        providerType: ssoProviders.providerType,
      })
      .from(ssoProviders)
      .where(eq(ssoProviders.isActive, true));

    res.json(providers);
  } catch (error) {
    console.error('Error fetching login providers:', error);
    res.status(500).json({ error: 'Failed to fetch login providers' });
  }
});

export default router;