'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/database.types';
import { User } from '@supabase/supabase-js';

export type Tenant = Database['public']['Tables']['tenants']['Row'] & {
  primary_color?: string;
  dark_mode?: boolean;
};

export interface TenantRequest {
  id: string;
  company_name: string;
  full_name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  created_at: string;
}

interface TenantContextType {
  user: User | null;
  tenant: Tenant | null;
  joinRequest: TenantRequest | null;
  isDemoMode: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  needsOnboarding: boolean;
  primaryColor: string;
  darkMode: boolean;
  setPrimaryColor: (color: string) => void;
  setDarkMode: (dark: boolean) => void;
  toggleDemoMode: () => void;
  setDemoMode: (val: boolean) => void;
  logout: () => Promise<void>;
  refreshTenant: () => Promise<void>;
  createTenant: (name: string) => Promise<Tenant | null>;
  submitJoinRequest: (companyName: string, fullName: string, phone: string) => Promise<TenantRequest | null>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [joinRequest, setJoinRequest] = useState<TenantRequest | null>(null);
  const isDemoMode = false; // Disabled completely as requested
  const [loading, setLoading] = useState<boolean>(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [primaryColor, setPrimaryColor] = useState<string>('emerald');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const router = useRouter();

  const toggleDemoMode = () => {};
  const setDemoMode = (val: boolean) => {};

  const fetchTenantData = async (userId: string) => {
    try {
      // Find tenant member record
      const { data: memberData, error: memberError } = await supabase
        .from('tenant_members')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) {
        console.error('Error fetching tenant member:', memberError);
        return null;
      }

      if (!memberData) {
        // Fetch join requests if any
        const { data: requestData } = await supabase
          .from('tenant_requests')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (requestData) {
          setJoinRequest(requestData as TenantRequest);
        } else {
          setJoinRequest(null);
        }

        setNeedsOnboarding(true);
        setTenant(null);
        return null;
      }

      // Fetch the actual tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', memberData.tenant_id)
        .single();

      if (tenantError) {
        console.error('Error fetching tenant details:', tenantError);
        return null;
      }

      setNeedsOnboarding(false);
      setJoinRequest(null);
      setTenant(tenantData as Tenant);
      setPrimaryColor(tenantData.primary_color || 'emerald');
      setDarkMode(tenantData.dark_mode !== false);
      return tenantData as Tenant;
    } catch (err) {
      console.error('Unexpected tenant query error:', err);
      return null;
    }
  };

  const refreshTenant = async () => {
    if (!user) return;
    await fetchTenantData(user.id);
  };

  // Dynamic Theme injector
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const color = primaryColor;
    const isDark = darkMode;

    // Toggle dark class on document element
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Color palettes mapping for styles overrides
    const palettes: Record<string, { base: string; hover: string; light: string; light10: string; light20: string; border: string; from: string; to: string }> = {
      emerald: { base: '#10b981', hover: '#059669', light: '#34d399', light10: '#10b9811a', light20: '#10b98133', border: '#10b98133', from: '#10b981', to: '#14b8a6' },
      blue: { base: '#3b82f6', hover: '#2563eb', light: '#60a5fa', light10: '#3b82f61a', light20: '#3b82f633', border: '#3b82f633', from: '#3b82f6', to: '#06b6d4' },
      rose: { base: '#f43f5e', hover: '#e11d48', light: '#f472b6', light10: '#f43f5e1a', light20: '#f43f5e33', border: '#f43f5e33', from: '#f43f5e', to: '#ec4899' },
      amber: { base: '#f59e0b', hover: '#d97706', light: '#fbbf24', light10: '#f59e0b1a', light20: '#f59e0b33', border: '#f59e0b33', from: '#f59e0b', to: '#f97316' },
      indigo: { base: '#6366f1', hover: '#4f46e5', light: '#818cf8', light10: '#6366f11a', light20: '#6366f133', border: '#6366f133', from: '#6366f1', to: '#a855f7' },
      violet: { base: '#8b5cf6', hover: '#7c3aed', light: '#a78bfa', light10: '#8b5cf61a', light20: '#8b5cf633', border: '#8b5cf633', from: '#8b5cf6', to: '#ec4899' }
    };

    const p = palettes[color] || palettes.emerald;

    let styleEl = document.getElementById('dynamic-tenant-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-tenant-theme';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      :root {
        --tenant-primary: ${p.base};
        --tenant-primary-hover: ${p.hover};
        --tenant-primary-light-10: ${p.light10};
        --tenant-primary-light-20: ${p.light20};
        --tenant-primary-border: ${p.border};
        --tenant-primary-from: ${p.from};
        --tenant-primary-to: ${p.to};

        /* Tailwind v4 core theme variables override */
        --color-emerald-400: ${p.light} !important;
        --color-emerald-500: ${p.base} !important;
        --color-emerald-600: ${p.hover} !important;
        --color-teal-400: ${p.to} !important;
        --color-teal-500: ${p.to} !important;
      }
      
      /* Override Tailwind utility classes on-the-fly */
      .text-emerald-500, .text-emerald-450 { color: var(--tenant-primary) !important; }
      .text-emerald-400 { color: var(--tenant-primary) !important; }
      .bg-emerald-500 { background-color: var(--tenant-primary) !important; }
      .bg-emerald-600 { background-color: var(--tenant-primary-hover) !important; }
      .bg-emerald-500\\/10 { background-color: var(--tenant-primary-light-10) !important; }
      .bg-emerald-500\\/20 { background-color: var(--tenant-primary-light-20) !important; }
      .border-emerald-500 { border-color: var(--tenant-primary) !important; }
      .border-emerald-500\\/20 { border-color: var(--tenant-primary-border) !important; }
      .from-emerald-500 { --tw-gradient-from: var(--tenant-primary-from) !important; --tw-gradient-to: transparent !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
      .to-teal-400 { --tw-gradient-to: var(--tenant-primary-to) !important; }
      .to-teal-500 { --tw-gradient-to: var(--tenant-primary-to) !important; }
      .hover\\:bg-emerald-600:hover { background-color: var(--tenant-primary-hover) !important; }
      .focus\\:ring-emerald-500:focus { --tw-ring-color: var(--tenant-primary) !important; }
      .shadow-emerald-500\\/10 { box-shadow: 0 10px 15px -3px var(--tenant-primary-light-10), 0 4px 6px -4px var(--tenant-primary-light-10) !important; }
      .shadow-emerald-500\\/25 { box-shadow: 0 10px 15px -3px var(--tenant-primary-light-20), 0 4px 6px -4px var(--tenant-primary-light-20) !important; }
    `;
  }, [primaryColor, darkMode]);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (mounted) {
            setUser(session.user);
            await fetchTenantData(session.user.id);
          }
        } else {
          if (mounted) {
            setUser(null);
            setTenant(null);
            setJoinRequest(null);
            setNeedsOnboarding(false);
          }
        }
      } catch (err) {
        console.error('Error checking auth session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setLoading(true);
        if (session?.user) {
          setUser(session.user);
          await fetchTenantData(session.user.id);
        } else {
          setUser(null);
          setTenant(null);
          setJoinRequest(null);
          setNeedsOnboarding(false);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setTenant(null);
      setJoinRequest(null);
      setNeedsOnboarding(false);
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTenant = async (name: string): Promise<Tenant | null> => {
    if (!user) {
      throw new Error('Must be logged in to create a tenant');
    }
    setLoading(true);
    try {
      // 1. Insert tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name,
          subscription_plan: 'free',
          owner_id: user.id,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Insert member as owner
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: tenantData.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      setTenant(tenantData as Tenant);
      setNeedsOnboarding(false);
      return tenantData as Tenant;
    } catch (err) {
      console.error('Failed to create tenant:', err);
      alert('حدث خطأ أثناء إنشاء الشركة، يرجى المحاولة لاحقاً');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const submitJoinRequest = async (companyName: string, fullName: string, phone: string): Promise<TenantRequest | null> => {
    if (!user) return null;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_requests')
        .insert({
          company_name: companyName,
          full_name: fullName,
          email: user.email || '',
          phone,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      setJoinRequest(data as TenantRequest);
      return data as TenantRequest;
    } catch (err) {
      console.error('Failed to submit join request:', err);
      alert('فشل تقديم طلب الانضمام. يرجى المحاولة لاحقاً.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = user?.email === 'abdelrahman.amr@gmail.com';

  return (
    <TenantContext.Provider
      value={{
        user,
        tenant,
        joinRequest,
        isDemoMode,
        isSuperAdmin,
        loading,
        needsOnboarding,
        primaryColor,
        darkMode,
        setPrimaryColor,
        setDarkMode,
        toggleDemoMode,
        setDemoMode,
        logout,
        refreshTenant,
        createTenant,
        submitJoinRequest,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
