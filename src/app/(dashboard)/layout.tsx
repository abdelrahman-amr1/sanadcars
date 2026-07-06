'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { useTenant } from '@/lib/context/TenantContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isDemoMode, needsOnboarding } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isDemoMode && !user) {
        router.push('/login');
      } else if (!isDemoMode && user && needsOnboarding) {
        router.push('/setup-tenant');
      }
    }
  }, [user, loading, isDemoMode, needsOnboarding, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100" style={{ direction: 'rtl' }}>
        <div className="text-center flex flex-col gap-2">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-xs text-slate-500 mt-2">جاري التحقق من الصلاحيات...</span>
        </div>
      </div>
    );
  }

  // Render the dashboard if in demo mode OR user is authenticated and setup is completed
  if (isDemoMode || (user && !needsOnboarding)) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-slate-100" style={{ direction: 'rtl' }}>
        {/* Sidebar navigation */}
        <Sidebar />

        {/* Main content body */}
        <main className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16">
          <div className="flex-1 p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return null;
}

