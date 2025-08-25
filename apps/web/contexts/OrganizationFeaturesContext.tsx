'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMinimalAuth } from './MinimalAuthContext';

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

interface OrganizationFeaturesContextType {
  features: OrganizationFeatures;
  loading: boolean;
  isFeatureEnabled: (feature: keyof OrganizationFeatures) => boolean;
  refreshFeatures: () => Promise<void>;
}

const OrganizationFeaturesContext = createContext<OrganizationFeaturesContextType | undefined>(undefined);

interface OrganizationFeaturesProviderProps {
  children: ReactNode;
}

export function OrganizationFeaturesProvider({ children }: OrganizationFeaturesProviderProps) {
  const [features, setFeatures] = useState<OrganizationFeatures>({});
  const [loading, setLoading] = useState(true);
  const { user } = useMinimalAuth();

  const fetchOrganizationFeatures = async () => {
    if (!user) {
      setFeatures({});
      setLoading(false);
      return;
    }

    // Super admins have access to all features
    if (user.isSuperAdmin) {
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
      setLoading(false);
      return;
    }

    // For regular users, just enable all features by default to prevent API calls
    // This prevents infinite loops during authentication
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
    setLoading(false);
  };

  useEffect(() => {
    // Only fetch features if we have a user and auth token
    const token = localStorage.getItem('authToken');
    if (user && token) {
      fetchOrganizationFeatures();
    } else if (!user) {
      // Clear features and stop loading if no user
      setFeatures({});
      setLoading(false);
    }
  }, [user]);

  const isFeatureEnabled = (feature: keyof OrganizationFeatures): boolean => {
    if (user?.isSuperAdmin) return true;
    return features[feature] ?? true;
  };

  const refreshFeatures = async () => {
    setLoading(true);
    await fetchOrganizationFeatures();
  };

  const value: OrganizationFeaturesContextType = {
    features,
    loading,
    isFeatureEnabled,
    refreshFeatures,
  };

  return (
    <OrganizationFeaturesContext.Provider value={value}>
      {children}
    </OrganizationFeaturesContext.Provider>
  );
}

export function useOrganizationFeatures(): OrganizationFeaturesContextType {
  const context = useContext(OrganizationFeaturesContext);
  if (context === undefined) {
    throw new Error('useOrganizationFeatures must be used within an OrganizationFeaturesProvider');
  }
  return context;
}