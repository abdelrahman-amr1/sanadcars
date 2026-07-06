'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const router = useRouter();
  const { setDemoMode } = useTenant();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSubmit(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message === 'Invalid login credentials' ? 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور' : error.message);
      } else {
        setDemoMode(false); // Switch out of demo mode upon successful login
        router.push('/');
      }
    } catch {
      setErrorMsg('حدث خطأ غير متوقع، يرجى المحاولة لاحقاً');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      {/* Background visual gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[150px]" />

      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800 backdrop-blur-xl shadow-2xl relative">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg shadow-emerald-500/25 mb-4">
            FF
          </div>
          <CardTitle className="text-2xl font-black text-slate-100 flex justify-center items-center gap-2">
            تسجيل الدخول إلى FleetFlow
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            أدخل حسابك لإدارة أساطيل حركة السيارات وتتبع الأرباح الحية
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pb-8">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-3 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">البريد الإلكتروني</label>
              <input
                required
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700 text-left"
                style={{ direction: 'ltr' }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">كلمة المرور</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700 text-left"
                style={{ direction: 'ltr' }}
              />
            </div>

            <Button
              type="submit"
              disabled={loadingSubmit}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-2.5 shadow-lg shadow-emerald-500/10"
            >
              {loadingSubmit ? 'جاري تسجيل الدخول...' : 'دخول'}
              <LogIn className="w-4 h-4 mr-2" />
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-2">
            ليس لديك حساب بعد؟{' '}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-500 font-bold underline">
              أنشئ حسابك الجديد الآن
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
