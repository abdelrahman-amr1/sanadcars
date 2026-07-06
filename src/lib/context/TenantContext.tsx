'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/database.types';
import { User } from '@supabase/supabase-js';

type Tenant = Database['public']['Tables']['tenants']['Row'];

interface TenantContextType {
  user: User | null;
  tenant: Tenant | null;
  isDemoMode: boolean;
  loading: boolean;
  needsOnboarding: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (val: boolean) => void;
  logout: () => Promise<void>;
  refreshTenant: () => Promise<void>;
  createTenant: (name: string) => Promise<Tenant | null>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isDemoMode, setIsDemoModeState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const storedDemo = localStorage.getItem('fleetflow_demo_mode');
      return storedDemo !== null ? storedDemo === 'true' : true;
    }
    return true;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const router = useRouter();

  const toggleDemoMode = () => {
    setIsDemoModeState((prev) => {
      const newVal = !prev;
      localStorage.setItem('fleetflow_demo_mode', String(newVal));
      return newVal;
    });
  };

  const setDemoMode = (val: boolean) => {
    setIsDemoModeState(val);
    localStorage.setItem('fleetflow_demo_mode', String(val));
  };

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
      setTenant(tenantData as Tenant);
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
      setNeedsOnboarding(false);
      // Automatically keep demo mode on logout so they can still browse the sandbox
      setDemoMode(true);
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
      setDemoMode(false); // Move out of demo mode immediately when creating a workspace

      return tenantData as Tenant;
    } catch (err) {
      console.error('Failed to create tenant:', err);
      alert('حدث خطأ أثناء إنشاء الشركة، يرجى المحاولة لاحقاً');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        user,
        tenant,
        isDemoMode,
        loading,
        needsOnboarding,
        toggleDemoMode,
        setDemoMode,
        logout,
        refreshTenant,
        createTenant,
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
