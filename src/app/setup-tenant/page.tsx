'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, LogOut, ShieldAlert } from 'lucide-react';

export default function SetupTenantPage() {
  const { user, tenant, loading, createTenant, logout, needsOnboarding } = useTenant();
  const [companyName, setCompanyName] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (tenant && !needsOnboarding) {
        router.push('/');
      }
    }
  }, [user, tenant, loading, needsOnboarding, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSubmit(true);
    setErrorMsg('');

    if (companyName.trim().length < 3) {
      setErrorMsg('اسم الشركة يجب أن لا يقل عن 3 أحرف');
      setLoadingSubmit(false);
      return;
    }

    try {
      const created = await createTenant(companyName);
      if (created) {
        router.push('/');
      } else {
        setErrorMsg('فشل إعداد مساحة العمل الخاصة بك. يرجى إعادة المحاولة.');
      }
    } catch {
      setErrorMsg('حدث خطأ غير متوقع أثناء إعداد الحساب.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center flex flex-col gap-2">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-xs text-slate-450 mt-2">جاري تحميل الإعدادات...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[150px]" />

      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800 backdrop-blur-xl shadow-2xl relative">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg shadow-emerald-500/25 mb-4">
            FF
          </div>
          <CardTitle className="text-2xl font-black text-slate-100 flex justify-center items-center gap-2">
            إعداد مساحة عملك
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            مرحباً بك! يرجى إدخال اسم شركتك أو مكتب تأجير السيارات الخاص بك لبدء الخدمة
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pb-8">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-3 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">اسم مكتب أو شركة السيارات</label>
              <input
                required
                type="text"
                placeholder="مثال: شركة الوفاق لتأجير السيارات"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
              />
              <span className="text-[10px] text-slate-500">سيتم ربط هذا الاسم بكافة رخص السيارات وفواتير التشغيل.</span>
            </div>

            <Button
              type="submit"
              disabled={loadingSubmit}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-2.5 shadow-lg shadow-emerald-500/10 mt-2"
            >
              {loadingSubmit ? 'جاري تهيئة الشركة...' : 'إنشاء وحفظ الشركة'}
              <Briefcase className="w-4 h-4 mr-2" />
            </Button>
          </form>

          <div className="border-t border-slate-800 my-1" />

          <Button
            onClick={logout}
            variant="outline"
            className="w-full border-rose-500/20 text-rose-450 hover:bg-rose-500/10 hover:text-rose-400 font-bold gap-2 py-2.5"
          >
            <LogOut className="w-4 h-4" />
            تسجيل خروج من الحساب
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
