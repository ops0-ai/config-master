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

    // For regular users, fetch their organization's features directly from the API
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        // No token means no features should be enabled
        setFeatures({
          servers: false,
          serverGroups: false,
          pemKeys: false,
          configurations: false,
          deployments: false,
          chat: false,
          training: false,
          awsIntegrations: false,
          githubIntegrations: false,
          mdm: false,
          assets: false,
          auditLogs: false,
        });
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api'}/organizations/current/features`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFeatures(data.features);
      } else {
        // Default to all enabled on error
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
    } catch (error) {
      console.error('Failed to fetch organization features:', error);
      // Default to all enabled on error
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationFeatures();
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