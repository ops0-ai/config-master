'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicRoutes = ['/login', '/register', '/forgot-password'];

export function MinimalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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
        hasOrgData: !!orgData
      });

      if (token && userData && orgData) {
        const parsedUser = JSON.parse(userData);
        const parsedOrg = JSON.parse(orgData);
        console.log('MinimalAuth: Setting user and org', { parsedUser, parsedOrg });
        setUser(parsedUser);
        setOrganization(parsedOrg);
      } else {
        console.log('MinimalAuth: No auth data found, user not logged in');
        setUser(null);
        setOrganization(null);
      }
    } catch (error) {
      console.error('MinimalAuth: Error checking auth', error);
      // Clear potentially corrupted data
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      setUser(null);
      setOrganization(null);
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

      if (!isAuthenticated && !isPublicRoute) {
        router.push('/login');
      } else if (isAuthenticated && isPublicRoute) {
        router.push('/');
      }
    }
  }, [loading, user, pathname, router, mounted]);

  const login = (token: string, userData: User, orgData: Organization) => {
    console.log('MinimalAuth: Login called', { userData, orgData });
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('organization', JSON.stringify(orgData));
    
    setUser(userData);
    setOrganization(orgData);
    
    router.push('/');
  };

  const logout = () => {
    console.log('MinimalAuth: Logout called');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    
    setUser(null);
    setOrganization(null);
    
    router.push('/login');
  };

  const value: AuthContextType = {
    user,
    organization,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
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