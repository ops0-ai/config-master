'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';

export default function SSOCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useMinimalAuth();
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Prevent processing multiple times
    if (processed) {
      console.log('SSO Callback: Already processed, skipping');
      return;
    }

    const token = searchParams.get('token');
    const userStr = searchParams.get('user');
    const orgStr = searchParams.get('organization');

    console.log('SSO Callback: Starting processing');
    console.log('SSO Callback: URL parameters', { 
      hasToken: !!token, 
      hasUserStr: !!userStr, 
      hasOrgStr: !!orgStr,
      tokenLength: token?.length,
      userStrLength: userStr?.length,
      orgStrLength: orgStr?.length,
      fullURL: window.location.href
    });

    if (token && userStr && orgStr) {
      try {
        console.log('SSO Callback: Parsing user and organization data');
        const user = JSON.parse(decodeURIComponent(userStr));
        const organization = JSON.parse(decodeURIComponent(orgStr));
        
        console.log('SSO Callback: Successfully parsed data', { 
          user: user.email, 
          org: organization.name,
          tokenPreview: token.substring(0, 50) + '...'
        });
        
        console.log('SSO Callback: Setting processed = true');
        setProcessed(true);
        
        console.log('SSO Callback: Calling login function');
        login(token, user, organization);
        
        console.log('SSO Callback: Scheduling redirect to dashboard');
        setTimeout(() => {
          console.log('SSO Callback: Redirecting to dashboard');
          router.push('/');
        }, 500);
      } catch (error) {
        console.error('SSO callback parsing error:', error);
        setProcessed(true);
        router.push('/login?error=sso_failed');
      }
    } else {
      console.log('SSO Callback: Missing parameters, redirecting to login');
      setProcessed(true);
      router.push('/login?error=missing_params');
    }
  }, [searchParams, processed, login, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-white">Completing sign in...</p>
      </div>
    </div>
  );
}