'use client';

import { useEffect } from 'react';
import { useMinimalAuth } from '@/contexts/MinimalAuthContext';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import OrganizationManagement from '@/components/OrganizationManagement';

export default function AdminOrganizationsPage() {
  const { user, loading } = useMinimalAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !user.isSuperAdmin)) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  // If not super admin, don't render anything (redirect will happen)
  if (!user || !user.isSuperAdmin) {
    return null;
  }

  return (
    <Layout>
      <OrganizationManagement />
    </Layout>
  );
}