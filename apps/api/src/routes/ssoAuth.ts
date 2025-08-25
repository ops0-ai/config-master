import { Router } from 'express';
import { db } from '../index';
import { 
  ssoProviders, 
  ssoDomainMappings, 
  userSsoMappings, 
  users, 
  organizations,
  roles,
  userRoles,
  permissions,
  rolePermissions
} from '@config-management/database';
import { eq, and, sql } from 'drizzle-orm';
import { Issuer, generators, Client } from 'openid-client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const router = Router();

// Store state tokens temporarily (in production, use Redis)
const stateStore = new Map<string, { providerId: string; nonce: string; timestamp: number }>();

// Cleanup old states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      stateStore.delete(state);
    }
  }
}, 5 * 60 * 1000);

// Decrypt helper (from sso.ts)
function decrypt(encryptedData: string): string {
  const algorithm = 'aes-256-gcm';
  const ENCRYPTION_KEY = process.env.SSO_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key';
  
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

// Initiate SSO login
router.get('/login/:providerId', async (req, res): Promise<any> => {
  try {
    const { providerId } = req.params;

    // Get provider configuration
    const [provider] = await db
      .select()
      .from(ssoProviders)
      .where(and(
        eq(ssoProviders.id, providerId),
        eq(ssoProviders.isActive, true)
      ))
      .limit(1);

    if (!provider) {
      return res.status(404).json({ error: 'SSO provider not found or inactive' });
    }

    // Create OIDC client
    let issuer;
    if (provider.discoveryUrl) {
      console.log(`🔍 Attempting to discover OIDC from: ${provider.discoveryUrl}`);
      try {
        issuer = await Issuer.discover(provider.discoveryUrl);
        console.log(`✅ OIDC discovery successful for ${provider.name}`);
      } catch (discoveryError: any) {
        console.error(`❌ OIDC discovery failed for ${provider.name}:`, discoveryError.message);
        return res.status(400).json({ 
          error: 'SSO provider configuration error', 
          details: `Discovery failed: ${discoveryError.message}` 
        });
      }
    } else {
      console.log(`🔧 Using manual OIDC configuration for ${provider.name}`);
      issuer = new Issuer({
        issuer: provider.issuerUrl,
        authorization_endpoint: provider.authorizationUrl,
        token_endpoint: provider.tokenUrl,
        userinfo_endpoint: provider.userinfoUrl,
        jwks_uri: provider.jwksUri || undefined,
      });
    }

    const client = new issuer.Client({
      client_id: provider.clientId,
      client_secret: decrypt(provider.clientSecret),
      redirect_uris: [`${process.env.API_URL || 'http://localhost:5005'}/api/sso/callback`],
      response_types: ['code'],
    });

    // Generate state and nonce
    const state = generators.state();
    const nonce = generators.nonce();

    // Store state and nonce for validation
    stateStore.set(state, { providerId, nonce, timestamp: Date.now() });

    // Generate authorization URL
    const authorizationUrl = client.authorizationUrl({
      scope: provider.scopes?.join(' ') || 'openid profile email',
      state,
      nonce,
    });

    // Redirect to SSO provider
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Error initiating SSO login:', error);
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

// SSO callback handler
router.get('/callback', async (req, res): Promise<any> => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=missing_params`);
    }

    // Validate state
    const stateData = stateStore.get(state as string);
    if (!stateData) {
      return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=invalid_state`);
    }

    stateStore.delete(state as string);
    const { providerId, nonce } = stateData;

    // Get provider configuration
    const [provider] = await db
      .select()
      .from(ssoProviders)
      .where(eq(ssoProviders.id, providerId))
      .limit(1);

    if (!provider) {
      return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=provider_not_found`);
    }

    // Create OIDC client
    let issuer;
    if (provider.discoveryUrl) {
      try {
        issuer = await Issuer.discover(provider.discoveryUrl);
      } catch (discoveryError: any) {
        console.error(`❌ OIDC discovery failed in callback for ${provider.name}:`, discoveryError.message);
        return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=sso_failed`);
      }
    } else {
      issuer = new Issuer({
        issuer: provider.issuerUrl,
        authorization_endpoint: provider.authorizationUrl,
        token_endpoint: provider.tokenUrl,
        userinfo_endpoint: provider.userinfoUrl,
        jwks_uri: provider.jwksUri || undefined,
      });
    }

    const client = new issuer.Client({
      client_id: provider.clientId,
      client_secret: decrypt(provider.clientSecret),
      redirect_uris: [`${process.env.API_URL || 'http://localhost:5005'}/api/sso/callback`],
      response_types: ['code'],
    });

    // Exchange code for tokens
    const tokenSet = await client.callback(
      `${process.env.API_URL || 'http://localhost:5005'}/api/sso/callback`,
      { code: code as string, state: state as string },
      { state: state as string, nonce: nonce } // Provide state and nonce for validation
    );

    // Get user info
    const userinfo = await client.userinfo(tokenSet.access_token!);

    // Map claims
    const claimsMapping = provider.claimsMapping || {
      email: 'email',
      name: 'name',
      given_name: 'given_name',
      family_name: 'family_name'
    };

    const email = userinfo[claimsMapping.email] as string;
    const userName = (userinfo[claimsMapping.name] || 
                `${userinfo[claimsMapping.given_name] || ''} ${userinfo[claimsMapping.family_name] || ''}`.trim() ||
                email.split('@')[0]) as string;
    const externalUserId = userinfo.sub as string;

    if (!email) {
      return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=email_not_found`);
    }

    // Check if user exists
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let organizationId: string;
    let userRole = provider.defaultRole || 'viewer';

    if (user) {
      // Existing user - link SSO account
      organizationId = user.organizationId!;

      // Check if SSO mapping already exists
      const [existingMapping] = await db
        .select()
        .from(userSsoMappings)
        .where(and(
          eq(userSsoMappings.userId, user.id),
          eq(userSsoMappings.ssoProviderId, providerId)
        ))
        .limit(1);

      if (!existingMapping) {
        // Create SSO mapping
        await db.insert(userSsoMappings).values({
          userId: user.id,
          ssoProviderId: providerId,
          externalUserId,
          externalEmail: email,
          externalMetadata: userinfo as any,
          lastLoginAt: new Date(),
        });
      } else {
        // Update last login
        await db
          .update(userSsoMappings)
          .set({ 
            lastLoginAt: new Date(),
            externalMetadata: userinfo as any 
          })
          .where(eq(userSsoMappings.id, existingMapping.id));
      }

      // Update user auth method if needed
      if (user.authMethod === 'password') {
        await db
          .update(users)
          .set({ 
            authMethod: 'both',
            lastSsoLoginAt: new Date()
          })
          .where(eq(users.id, user.id));
      }
    } else {
      // New user - auto-provision if enabled
      if (!provider.autoProvisionUsers) {
        return res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=auto_provision_disabled`);
      }

      // Determine organization strategy
      const emailDomain = email.split('@')[1].toLowerCase();
      
      // For B2C platforms, common email domains should create individual organizations
      const commonB2CDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com'];
      const isB2CDomain = commonB2CDomains.includes(emailDomain);
      
      if (isB2CDomain) {
        // B2C flow - create a new organization for each user
        const userDisplayName = userName || email.split('@')[0];
        const tempOwnerId = crypto.randomUUID();
        const [newOrg] = await db.insert(organizations).values({
          name: `${userDisplayName}'s Organization`,
          ownerId: tempOwnerId, // Will be updated after user creation
          isActive: true,
        }).returning();

        organizationId = newOrg.id;
        
        // User becomes admin of their own organization
        userRole = 'administrator';
        
        console.log(`📧 B2C SSO: Created new organization for ${email}`);
      } else {
        // B2B flow - check for existing domain mapping
        const [domainMapping] = await db
          .select()
          .from(ssoDomainMappings)
          .where(and(
            eq(ssoDomainMappings.ssoProviderId, providerId),
            eq(ssoDomainMappings.domain, emailDomain)
          ))
          .limit(1);

        if (domainMapping) {
          organizationId = domainMapping.organizationId;
          
          // Check if this is the first user in the organization
          const userCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(users)
            .where(eq(users.organizationId, organizationId));
          
          if (userCount[0].count === 0) {
            // First user in org becomes admin
            userRole = provider.firstUserRole || 'administrator';
          }
        } else {
          // Check for default mapping
          const [defaultMapping] = await db
            .select()
            .from(ssoDomainMappings)
            .where(and(
              eq(ssoDomainMappings.ssoProviderId, providerId),
              eq(ssoDomainMappings.isDefault, true)
            ))
            .limit(1);

          if (defaultMapping) {
            organizationId = defaultMapping.organizationId;
          } else {
            // Create new organization for this business domain  
            const tempOwnerId = crypto.randomUUID();
            const [newOrg] = await db.insert(organizations).values({
              name: emailDomain,
              ownerId: tempOwnerId, // Will be updated after user creation
              isActive: true,
            }).returning();

            organizationId = newOrg.id;
            
            // First user becomes admin
            userRole = provider.firstUserRole || 'administrator';

            // Create domain mapping for future users from same company
            await db.insert(ssoDomainMappings).values({
              ssoProviderId: providerId,
              domain: emailDomain,
              organizationId,
              isDefault: false,
            });
          }
        }
      }

      // Check role mapping from SSO groups/roles
      if (provider.roleMapping && userinfo.groups) {
        const ssoGroups = Array.isArray(userinfo.groups) ? userinfo.groups : [userinfo.groups];
        for (const group of ssoGroups) {
          if (provider.roleMapping[group as string]) {
            userRole = provider.roleMapping[group as string];
            break;
          }
        }
      }

      // Create user
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUserData = {
        email: email,
        name: userName,
        passwordHash: hashedPassword,
        role: userRole,
        organizationId: organizationId,
        isActive: true,
        hasCompletedOnboarding: false,
        authMethod: 'sso' as const,
        ssoProviderId: providerId,
        externalUserId: externalUserId,
        lastSsoLoginAt: new Date(),
      };
      const [newUser] = await db.insert(users).values(newUserData).returning();

      user = newUser; // Assign to existing variable for consistency

      // Create SSO mapping
      await db.insert(userSsoMappings).values({
        userId: user.id,
        ssoProviderId: providerId,
        externalUserId,
        externalEmail: email,
        externalMetadata: userinfo as any,
        lastLoginAt: new Date(),
      });

      // Update organization ownerId if this was a newly created org
      if (userRole === 'administrator' || userRole === 'owner') {
        await db.update(organizations)
          .set({ ownerId: user.id })
          .where(eq(organizations.id, organizationId));
      }

      // Create user role in RBAC
      let orgRole = await db
        .select()
        .from(roles)
        .where(and(
          eq(roles.organizationId, organizationId),
          eq(roles.name, userRole === 'administrator' ? 'Administrator' : 'Viewer')
        ))
        .limit(1)
        .then(rows => rows[0]);

      // If role doesn't exist (new organization), create it
      if (!orgRole) {
        const roleName = userRole === 'administrator' ? 'Administrator' : 'Viewer';
        const [newRole] = await db.insert(roles).values({
          name: roleName,
          description: roleName === 'Administrator' ? 'Full system access' : 'Read-only access',
          organizationId,
          isSystem: false,
        }).returning();
        
        orgRole = newRole;
        
        // For Administrator role, add all permissions
        if (roleName === 'Administrator') {
          const allPermissions = await db.select().from(permissions);
          const rolePermissionData = allPermissions.map(perm => ({
            roleId: orgRole.id,
            permissionId: perm.id,
          }));
          
          if (rolePermissionData.length > 0) {
            await db.insert(rolePermissions).values(rolePermissionData);
          }
          console.log(`🔐 Created Administrator role with ${rolePermissionData.length} permissions for org ${organizationId}`);
        }
      }

      if (orgRole) {
        await db.insert(userRoles).values({
          userId: user.id,
          roleId: orgRole.id,
          assignedBy: user.id,
        });
      }

      console.log(`✅ Auto-provisioned SSO user ${email} in organization ${organizationId} with role ${userRole}`);
    }

    // Get organization
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId,
        isSuperAdmin: user.isSuperAdmin,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Create a simple HTML page that sets localStorage and redirects
    const userObj = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    };
    
    const orgObj = {
      id: organization.id,
      name: organization.name,
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Completing Sign In...</title>
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0;
            background: #f3f4f6;
        }
        .container { 
            text-align: center; 
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h2>Completing sign in...</h2>
        <p>Please wait while we redirect you.</p>
    </div>
    <script>
        console.log('SSO: Setting authentication data');
        
        // Set localStorage
        localStorage.setItem('authToken', ${JSON.stringify(token)});
        localStorage.setItem('user', ${JSON.stringify(JSON.stringify(userObj))});
        localStorage.setItem('organization', ${JSON.stringify(JSON.stringify(orgObj))});
        
        console.log('SSO: Authentication data set, redirecting to dashboard');
        
        // Redirect after a short delay
        setTimeout(function() {
            window.location.href = '/';
        }, 1000);
    </script>
</body>
</html>`;

    // Fuck this HTML approach, let's just use a simple redirect with the token in the URL hash
    console.log(`✅ SSO callback successful - redirecting user ${user.email} with token in URL hash`);
    res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/#token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(userObj))}&org=${encodeURIComponent(JSON.stringify(orgObj))}`);
  } catch (error) {
    console.error('❌ SSO callback error:', error);
    console.error('❌ SSO callback stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.redirect(`${process.env.WEB_URL || 'http://localhost:3000'}/login?error=sso_failed`);
  }
});

// Link existing account with SSO (authenticated endpoint)
router.post('/link-account', async (req: any, res): Promise<any> => {
  try {
    // This would be called after user logs in with password and wants to link SSO
    const { userId, providerId } = req.body;

    // Implementation would follow similar pattern to callback
    // but for already authenticated users

    res.json({ message: 'Account linking not yet implemented' });
  } catch (error) {
    console.error('Error linking account:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

export default router;