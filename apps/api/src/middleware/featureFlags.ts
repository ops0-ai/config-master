import { db } from '../index';
import { organizations, users } from '@config-management/database';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from './auth';

// Feature flag mapping to resources
const FEATURE_RESOURCE_MAP: Record<string, string[]> = {
  servers: ['servers'],
  serverGroups: ['server-groups'],
  pemKeys: ['pem-keys'],
  configurations: ['configurations'],
  deployments: ['deployments'],
  chat: ['chat'],
  training: ['training'],
  awsIntegrations: ['aws-integrations'],
  githubIntegrations: ['github-integrations'],
  mdm: ['mdm'],
  assets: ['asset', 'assets'],
  auditLogs: ['audit-logs'],
  hive: ['hive']
};

// Reverse mapping from resource to feature
const RESOURCE_FEATURE_MAP: Record<string, string> = {};
Object.entries(FEATURE_RESOURCE_MAP).forEach(([feature, resources]) => {
  resources.forEach(resource => {
    RESOURCE_FEATURE_MAP[resource] = feature;
  });
});

/**
 * Middleware to check if a feature is enabled for the user's organization
 */
export const featureFlagMiddleware = (requiredFeature?: string) => {
  return async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is super admin - they bypass all feature flags
      const user = await db
        .select({ isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user[0]?.isSuperAdmin) {
        return next(); // Super admins bypass feature flags
      }

      // Get organization's feature flags
      const org = await db
        .select({ 
          featuresEnabled: organizations.featuresEnabled,
          isActive: organizations.isActive 
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org[0]) {
        return res.status(403).json({ 
          error: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      // Check if organization is active
      if (!org[0].isActive) {
        return res.status(403).json({ 
          error: 'Organization is disabled',
          code: 'ORGANIZATION_DISABLED'
        });
      }

      const features = org[0].featuresEnabled || {};

      // If a specific feature is required, check it
      if (requiredFeature) {
        const featureKey = requiredFeature as keyof typeof features;
        if (features[featureKey] === false) {
          return res.status(403).json({ 
            error: `This feature is not enabled for your organization. Please reach out to the support team for assistance.`,
            code: 'FEATURE_DISABLED',
            feature: requiredFeature,
            message: `The '${requiredFeature}' feature is not available for your organization. Contact support to enable this feature.`
          });
        }
      }

      // Store features in request for use in RBAC middleware
      req.organizationFeatures = features;
      next();
    } catch (error) {
      console.error('Feature flag middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to automatically detect feature requirement based on route path
 */
export const autoFeatureFlagMiddleware = () => {
  return async (req: AuthenticatedRequest, res: any, next: any) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is super admin - they bypass all feature flags
      const user = await db
        .select({ isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user[0]?.isSuperAdmin) {
        return next(); // Super admins bypass feature flags
      }

      // Get organization's feature flags
      const org = await db
        .select({ 
          featuresEnabled: organizations.featuresEnabled,
          isActive: organizations.isActive 
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org[0]) {
        return res.status(403).json({ 
          error: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      // Check if organization is active
      if (!org[0].isActive) {
        return res.status(403).json({ 
          error: 'Organization is disabled',
          code: 'ORGANIZATION_DISABLED'
        });
      }

      const features = org[0].featuresEnabled || {};

      // Auto-detect feature from the request URL
      const path = req.path || req.url || '';
      let detectedFeature: string | null = null;

      // Check path segments to determine feature
      const pathSegments = path.split('/').filter(Boolean);
      
      for (const segment of pathSegments) {
        if (RESOURCE_FEATURE_MAP[segment]) {
          detectedFeature = RESOURCE_FEATURE_MAP[segment];
          break;
        }
      }

      // If we detected a feature, check if it's enabled
      if (detectedFeature) {
        const featureKey = detectedFeature as keyof typeof features;
        if (features[featureKey] === false) {
          return res.status(403).json({ 
            error: `This feature is not enabled for your organization. Please reach out to the support team for assistance.`,
            code: 'FEATURE_DISABLED',
            feature: detectedFeature,
            message: `The '${detectedFeature}' feature is not available for your organization. Contact support to enable this feature.`
          });
        }
      }

      // Store features in request for use in other middleware
      req.organizationFeatures = features;
      next();
    } catch (error) {
      console.error('Auto feature flag middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Export feature mappings for use in other parts of the application
export { FEATURE_RESOURCE_MAP, RESOURCE_FEATURE_MAP };