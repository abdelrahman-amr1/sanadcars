'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTenant } from '@/lib/context/TenantContext';
import {
  LayoutDashboard,
  Car,
  Users,
  Activity,
  FileText,
  Wrench,
  LogOut,
  LogIn,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'عمليات التشغيل', href: '/operations', icon: Activity },
  { name: 'أسطول السيارات', href: '/vehicles', icon: Car },
  { name: 'السائقين', href: '/drivers', icon: Users },
  { name: 'المخالفات المرورية', href: '/violations', icon: FileText },
  { name: 'الصيانة والعدادات', href: '/maintenance', icon: Wrench },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const { user, tenant, isDemoMode, logout } = useTenant();

  const handleAuthAction = () => {
    if (user) {
      logout();
    } else {
      router.push('/login');
    }
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="flex md:hidden items-center justify-between bg-slate-900 border-b border-slate-800 p-4 h-16 w-full fixed top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-lg">
            F
          </div>
          <span className="font-extrabold text-slate-200 tracking-wider">FleetFlow</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-slate-200"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Container */}
      <aside
        className={cn(
          "bg-slate-900 border-l border-slate-800/80 fixed md:sticky top-0 right-0 h-screen z-50 flex flex-col justify-between transition-all duration-300 shadow-2xl",
          isOpen ? "w-64" : "w-20",
          !isOpen && "md:w-20",
          // Hide/show on mobile depending on state
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}
      >
        <div>
          {/* Header Logo */}
          <div className="p-6 flex items-center justify-between border-b border-slate-800/50">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
                FF
              </div>
              {isOpen && (
                <div className="flex flex-col">
                  <span className="font-black text-slate-100 tracking-wider text-base">FleetFlow</span>
                  <span className="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase">
                    {isDemoMode ? 'Sandbox Preview' : 'Pro SaaS'}
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="hidden md:flex items-center justify-center w-6 h-6 rounded-full border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all absolute -left-3 top-8 bg-slate-900"
            >
              <ChevronLeft className={cn("w-4 h-4 transition-transform", !isOpen && "rotate-180")} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 flex flex-col gap-1.5 mt-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group relative",
                    isActive
                      ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-400 border border-emerald-500/15"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
                  )}
                >
                  <Icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200")} />
                  {isOpen && <span>{item.name}</span>}

                  {/* Tooltip on collapse */}
                  {!isOpen && (
                    <div className="absolute right-full mr-3 bg-slate-950 text-slate-200 text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl border border-slate-800 z-50 whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="flex flex-col">

          {/* Footer User Info */}
          <div className="p-4 border-t border-slate-800/50 flex flex-col gap-2">
            {isOpen ? (
              <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-850/50">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20 shrink-0">
                  {isDemoMode ? "م" : tenant?.name ? tenant.name.substring(0, 1) : "م"}
                </div>
                <div className="flex flex-col overflow-hidden text-right">
                  <span className="text-xs font-bold text-slate-200 truncate">
                    {isDemoMode ? "مكتب المعاينة التجريبي" : (tenant?.name || "جاري جلب البيانات...")}
                  </span>
                  <span className="text-[10px] text-slate-550 truncate" style={{ direction: 'ltr' }}>
                    {isDemoMode ? "demo@fleetflow.com" : (user?.email || "غير متصل")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20 mx-auto">
                {isDemoMode ? "م" : tenant?.name ? tenant.name.substring(0, 1) : "م"}
              </div>
            )}

            <button
              onClick={handleAuthAction}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border border-transparent mt-2",
                user 
                  ? "text-rose-450 hover:bg-rose-500/10 hover:text-rose-400" 
                  : "text-emerald-450 hover:bg-emerald-500/10 hover:text-emerald-400",
                !isOpen && "justify-center"
              )}
            >
              {user ? <LogOut className="w-4 h-4 shrink-0" /> : <LogIn className="w-4 h-4 shrink-0" />}
              {isOpen && <span>{user ? "تسجيل الخروج" : "تسجيل الدخول"}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-45"
        />
      )}
    </>
  );
}

