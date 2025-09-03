'use client';

import { ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useOrganizationFeatures, OrganizationFeatures } from '@/contexts/OrganizationFeaturesContext';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';

interface FeatureGuardProps {
  feature: keyof OrganizationFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  showWarning?: boolean;
  warningMessage?: string;
}

export default function FeatureGuard({ 
  feature, 
  children, 
  fallback = null,
  showWarning = true,
  warningMessage
}: FeatureGuardProps) {
  const { isFeatureEnabled } = useOrganizationFeatures();
  const { user } = useMinimalAuth();
  
  // Super admins always have access
  if (user?.isSuperAdmin) {
    return <>{children}</>;
  }
  
  const featureEnabled = isFeatureEnabled(feature);
  
  if (!featureEnabled) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showWarning) {
      const defaultMessage = `${feature.charAt(0).toUpperCase() + feature.slice(1)} feature is not enabled for your organization. Please reach out to the support team for assistance to enable this feature.`;
      
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>{warningMessage || defaultMessage}</strong>
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  }
  
  return <>{children}</>;
}

// Hook for checking features in components
export function useFeatureGuard(feature: keyof OrganizationFeatures) {
  const { isFeatureEnabled } = useOrganizationFeatures();
  const { user } = useMinimalAuth();
  
  const featureEnabled = user?.isSuperAdmin || isFeatureEnabled(feature);
  
  return {
    isEnabled: featureEnabled,
    isDisabled: !featureEnabled,
  };
}