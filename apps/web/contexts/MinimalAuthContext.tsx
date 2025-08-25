'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin?: boolean;
}

interface Organization {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (token: string, user: User, organization: Organization) => void;
  logout: () => void;
  isAuthenticated: boolean;
  setOrganization: (org: Organization | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicRoutes = ['/login', '/register', '/forgot-password', '/sso-callback'];

export function MinimalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizationState, setOrganizationState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const setOrganization = (org: Organization | null) => {
    setOrganizationState(org);
    if (org) {
      localStorage.setItem('organization', JSON.stringify(org));
    } else {
      localStorage.removeItem('organization');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      console.log('MinimalAuth: Checking auth...');
      checkAuth();
    }
  }, [mounted]);

  const checkAuth = () => {
    try {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('user');
      const orgData = localStorage.getItem('organization');

      console.log('MinimalAuth: Retrieved from localStorage', {
        hasToken: !!token,
        hasUserData: !!userData,
        hasOrgData: !!orgData,
        pathname,
        currentURL: typeof window !== 'undefined' ? window.location.href : 'server'
      });

      // Check if we have SSO callback parameters in URL hash (regardless of pathname)
      if (typeof window !== 'undefined' && window.location.hash.includes('token=')) {
        console.log('MinimalAuth: Detected SSO callback parameters in URL hash');
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlToken = hashParams.get('token');
        const urlUser = hashParams.get('user');
        const urlOrg = hashParams.get('org');
        
        if (urlToken && urlUser && urlOrg) {
          console.log('MinimalAuth: Processing SSO callback directly from URL hash');
          try {
            const userObj = JSON.parse(decodeURIComponent(urlUser));
            const orgObj = JSON.parse(decodeURIComponent(urlOrg));
            
            // Store in localStorage
            localStorage.setItem('authToken', urlToken);
            localStorage.setItem('user', JSON.stringify(userObj));
            localStorage.setItem('organization', JSON.stringify(orgObj));
            
            // Set state
            setUser(userObj);
            setOrganizationState(orgObj);
            
            console.log('MinimalAuth: SSO callback processed successfully, clearing hash and staying on page');
            // Clear hash without redirecting
            window.history.replaceState(null, '', window.location.pathname);
            
            setLoading(false);
            return;
          } catch (parseError) {
            console.error('MinimalAuth: Error parsing SSO callback parameters', parseError);
          }
        }
      }

      if (token && userData && orgData) {
        const parsedUser = JSON.parse(userData);
        const parsedOrg = JSON.parse(orgData);
        console.log('MinimalAuth: Setting user and org', { parsedUser, parsedOrg });
        setUser(parsedUser);
        setOrganizationState(parsedOrg);
      } else {
        console.log('MinimalAuth: No complete auth data found');
        
        // If we're on sso-callback, don't clear data yet - let the callback process first
        if (pathname === '/sso-callback') {
          console.log('MinimalAuth: On SSO callback page, preserving partial data');
          // Keep any existing user/org data, just clear user state for now
          setUser(null);
          setOrganizationState(null);
        } else {
          console.log('MinimalAuth: Incomplete auth data, but not clearing to avoid loops');
          // Don't clear data aggressively - just set state to null
          setUser(null);
          setOrganizationState(null);
        }
      }
    } catch (error) {
      console.error('MinimalAuth: Error checking auth', error);
      // Clear potentially corrupted data
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      setUser(null);
      setOrganizationState(null);
    } finally {
      console.log('MinimalAuth: Auth check completed, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Redirect logic
    if (!loading && mounted) {
      const isPublicRoute = publicRoutes.includes(pathname);
      const isAuthenticated = !!user;

      console.log('MinimalAuth: Redirect logic', { isAuthenticated, isPublicRoute, pathname });

      // If we're on sso-callback, wait a moment before applying redirect logic
      // to give the callback page time to process the URL parameters
      if (pathname === '/sso-callback') {
        console.log('MinimalAuth: On SSO callback page, delaying redirect logic');
        setTimeout(() => {
          // Re-check auth state after delay
          const token = localStorage.getItem('authToken');
          const userData = localStorage.getItem('user');
          const orgData = localStorage.getItem('organization');
          
          console.log('MinimalAuth: Delayed check on SSO callback', {
            hasToken: !!token,
            hasUserData: !!userData,
            hasOrgData: !!orgData
          });
          
          // If still no token after delay, redirect to login
          if (!token) {
            console.log('MinimalAuth: No token found after SSO callback delay, redirecting to login');
            router.push('/login?error=sso_timeout');
          }
        }, 2000); // Give 2 seconds for SSO callback to process
        return;
      }

      if (!isAuthenticated && !isPublicRoute) {
        router.push('/login');
      } else if (isAuthenticated && isPublicRoute) {
        router.push('/');
      }
    }
  }, [loading, user, pathname, router, mounted]);

  const login = (token: string, userData: User, orgData: Organization) => {
    console.log('MinimalAuth: Login called', { 
      userData, 
      orgData, 
      token: token ? `${token.substring(0, 20)}...` : 'NULL/UNDEFINED',
      tokenType: typeof token,
      tokenLength: token?.length
    });
    
    if (!token) {
      console.error('MinimalAuth: Token is null/undefined, cannot login');
      return;
    }
    
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('organization', JSON.stringify(orgData));
    
    setUser(userData);
    setOrganizationState(orgData);
    
    router.push('/');
  };

  const logout = () => {
    console.log('MinimalAuth: Logout called');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    
    setUser(null);
    setOrganizationState(null);
    
    router.push('/login');
  };

  const value: AuthContextType = {
    user,
    organization: organizationState,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    setOrganization,
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useMinimalAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useMinimalAuth must be used within a MinimalAuthProvider');
  }
  return context;
}