'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const router = useRouter();
  const { setDemoMode } = useTenant();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSubmit(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setErrorMsg(signUpError.message);
        setLoadingSubmit(false);
        return;
      }

      const currentUser = authData.user;
      const currentSession = authData.session;

      if (currentUser) {
        // If session is active (auto-confirm enabled on Supabase)
        if (currentSession) {
          setDemoMode(false);
          setSuccessMsg('تم تسجيل الحساب بنجاح! جاري تحويلك لتقديم طلب الانضمام...');
          setTimeout(() => {
            router.push('/setup-tenant');
          }, 1500);
        } else {
          // If email verification is required (default in some Supabase projects)
          setSuccessMsg('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب، ثم تسجيل الدخول لتقديم طلب الانضمام.');
          setEmail('');
          setPassword('');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('حدث خطأ غير متوقع، يرجى المحاولة لاحقاً');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[150px]" />

      <Card className="w-full max-w-md bg-slate-900/60 border-slate-800 backdrop-blur-xl shadow-2xl relative text-right">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg shadow-emerald-500/25 mb-4">
            SC
          </div>
          <CardTitle className="text-2xl font-black text-slate-100 flex justify-center items-center gap-2">
            إنشاء حساب جديد بالمنصة
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            سجل حسابك الآن لتتمكن من تقديم طلب الانضمام وتفعيل شركتك الخاصة
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pb-8">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl p-3 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-450 rounded-xl p-3 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-slate-200">{successMsg}</span>
            </div>
          )}

          {!successMsg && (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">البريد الإلكتروني للطلب</label>
                <input
                  required
                  type="email"
                  placeholder="admin@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700 text-left"
                  style={{ direction: 'ltr' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">كلمة المرور (6 خانات على الأقل)</label>
                <input
                  required
                  type="password"
                  minLength={6}
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
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black py-2.5 shadow-lg shadow-emerald-500/10 mt-2"
              >
                {loadingSubmit ? 'جاري تهيئة الحساب...' : 'تسجيل حساب جديد'}
                <UserPlus className="w-4 h-4 mr-2" />
              </Button>
            </form>
          )}

          <div className="border-t border-slate-800 my-1" />

          <p className="text-center text-xs text-slate-450">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-500 font-bold underline">
              تسجيل الدخول هنا
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
