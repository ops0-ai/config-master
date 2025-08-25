'use client';

import { useEffect } from 'react';

export default function TestSSOPage() {
  useEffect(() => {
    console.log('TestSSO: Page loaded');
    console.log('TestSSO: Current URL:', window.location.href);
    console.log('TestSSO: Search params:', window.location.search);
    
    // Test if we can detect SSO parameters
    if (window.location.search.includes('token=')) {
      console.log('TestSSO: Found token in URL!');
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const user = urlParams.get('user');
      const org = urlParams.get('organization');
      
      console.log('TestSSO: Extracted params:', {
        token: token ? token.substring(0, 20) + '...' : null,
        user: user ? user.substring(0, 50) + '...' : null,
        org: org ? org.substring(0, 50) + '...' : null
      });
    }
    
    // Test localStorage access
    console.log('TestSSO: Current localStorage:', {
      token: localStorage.getItem('authToken'),
      user: localStorage.getItem('user'),
      org: localStorage.getItem('organization')
    });
  }, []);

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold">SSO Test Page</h1>
      <p>Check browser console for debug information</p>
      <div className="mt-4">
        <p>Current URL: {typeof window !== 'undefined' ? window.location.href : 'Loading...'}</p>
      </div>
    </div>
  );
}