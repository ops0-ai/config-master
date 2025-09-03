import { useState, useEffect } from 'react';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';

// Feature name mappings
export const FEATURE_MAPPINGS = {
  '/servers': 'servers',
  '/server-groups': 'serverGroups',
  '/pem-keys': 'pemKeys',
  '/configurations': 'configurations',
  '/deployments': 'deployments',
  '/chat': 'chat',
  '/training': 'training',
  '/aws': 'awsIntegrations',
  '/github': 'githubIntegrations',
  '/mdm': 'mdm',
  '/assets': 'assets',
  '/audit': 'auditLogs',
  '/settings/integrations': 'githubIntegrations',
} as const;

export interface OrganizationFeatures {
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
}

export function useFeatureFlags() {
  const [features, setFeatures] = useState<OrganizationFeatures>({});
  const [loading, setLoading] = useState(true);
  const { user } = useMinimalAuth();

  useEffect(() => {
    // For now, we'll assume all features are enabled by default
    // In a real implementation, you would fetch this from the API
    // based on the user's organization
    if (user?.isSuperAdmin) {
      // Super admins have access to all features
      setFeatures({
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
        auditLogs: true,
      });
    } else {
      // For regular users, all features are enabled by default
      // The API will handle the actual blocking
      setFeatures({
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
        auditLogs: true,
      });
    }
    setLoading(false);
  }, [user]);

  const isFeatureEnabled = (featureName: keyof OrganizationFeatures): boolean => {
    if (user?.isSuperAdmin) return true;
    return features[featureName] ?? true;
  };

  const isPathEnabled = (path: string): boolean => {
    const featureName = FEATURE_MAPPINGS[path as keyof typeof FEATURE_MAPPINGS];
    if (!featureName) return true; // Allow access to unmapped paths
    return isFeatureEnabled(featureName);
  };

  return {
    features,
    loading,
    isFeatureEnabled,
    isPathEnabled,
  };
}