'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/auth/AuthContext';
import RestaurantDashboard from '../../src/components/RestaurantDashboard';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf7f2] text-sm text-[#817a74]">
        Loading dashboard...
      </div>
    );
  }

  if (!user) return null;

  return <RestaurantDashboard />;
}