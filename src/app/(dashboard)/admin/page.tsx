'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Plus,
  Building,
  Users,
  Car,
  X,
  UserPlus,
  Info,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  subscription_plan: string;
  owner_id: string;
  created_at: string;
}

interface TenantRequest {
  id: string;
  company_name: string;
  full_name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  created_at: string;
}

export default function SuperAdminPage() {
  const { user, isSuperAdmin, loading } = useTenant();
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // Tab state
  const [activeSection, setActiveSection] = useState<'requests' | 'tenants'>('requests');

  // Modal states
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Form inputs
  const [newTenant, setNewTenant] = useState({
    name: '',
    owner_email: '',
    subscription_plan: 'free'
  });

  const [newMember, setNewMember] = useState({
    tenant_id: '',
    user_email: '',
    role: 'admin'
  });

  // Guard routing
  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push('/');
    }
  }, [user, isSuperAdmin, loading, router]);

  const loadPlatformData = useCallback(async () => {
    setDataLoading(true);
    try {
      // 1. Fetch tenants
      const { data: tData } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (tData) setTenants(tData as Tenant[]);

      // 2. Fetch join requests
      const { data: reqData } = await supabase.from('tenant_requests').select('*').order('created_at', { ascending: false });
      if (reqData) setRequests(reqData as TenantRequest[]);

      // 3. Fetch count of all vehicles on the platform
      const { count: vCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
      setTotalVehicles(vCount || 0);

      // 4. Fetch count of all drivers on the platform
      const { count: dCount } = await supabase.from('drivers').select('*', { count: 'exact', head: true });
      setTotalDrivers(dCount || 0);
    } catch (err) {
      console.error('Error loading super admin data:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      loadPlatformData();
    }
  }, [isSuperAdmin, loadPlatformData]);

  // Handlers
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.owner_email) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      // Resolve email to UUID
      const { data: resolvedUid, error: rpcError } = await supabase
        .rpc('get_user_id_by_email', { email_address: newTenant.owner_email.trim() });

      if (rpcError || !resolvedUid) {
        alert('فشل العثور على هذا البريد الإلكتروني للمالك. تأكد من أن المستخدم قام بالتسجيل أولاً.');
        return;
      }

      // Create Tenant
      const { data: createdTenant, error: tError } = await supabase
        .from('tenants')
        .insert({
          name: newTenant.name,
          owner_id: resolvedUid,
          subscription_plan: newTenant.subscription_plan
        })
        .select()
        .single();

      if (tError) throw tError;

      // Automatically add the owner to tenant_members
      const { error: mError } = await supabase
        .from('tenant_members')
        .upsert({
          tenant_id: createdTenant.id,
          user_id: resolvedUid,
          role: 'owner'
        });

      if (mError) throw mError;

      alert('تم إنشاء المكتب وتعيين المالك بنجاح!');
      setShowAddTenantModal(false);
      setNewTenant({ name: '', owner_email: '', subscription_plan: 'free' });
      loadPlatformData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      alert(`فشل إنشاء المكتب: ${errMsg}`);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.tenant_id || !newMember.user_email) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      // Resolve email to UUID
      const { data: resolvedUid, error: rpcError } = await supabase
        .rpc('get_user_id_by_email', { email_address: newMember.user_email.trim() });

      if (rpcError || !resolvedUid) {
        alert('فشل العثور على البريد الإلكتروني للمستخدم. تأكد من تسجيله بالمنصة أولاً.');
        return;
      }

      const { error } = await supabase
        .from('tenant_members')
        .upsert({
          tenant_id: newMember.tenant_id,
          user_id: resolvedUid,
          role: newMember.role
        });

      if (error) throw error;

      alert('تم ربط المستخدم بالمكتب بنجاح!');
      setShowAddMemberModal(false);
      setNewMember({ tenant_id: '', user_email: '', role: 'admin' });
      loadPlatformData();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      alert(`فشل إضافة العضو: ${errMsg}`);
    }
  };

  // Approve Onboarding Join Request
  const handleApproveRequest = async (req: TenantRequest) => {
    if (!confirm(`هل أنت متأكد من تفعيل مكتب "${req.company_name}" وتعيين "${req.full_name}" كمالك له؟\n\nرقم جوال العميل: ${req.phone}`)) return;
    setDataLoading(true);
    try {
      // 1. Create the tenant/office
      const { data: createdTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: req.company_name,
          owner_id: req.user_id,
          subscription_plan: 'free'
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Add owner to tenant_members
      const { error: memberError } = await supabase
        .from('tenant_members')
        .upsert({
          tenant_id: createdTenant.id,
          user_id: req.user_id,
          role: 'owner'
        });

      if (memberError) throw memberError;

      // 3. Mark request as approved
      const { error: reqError } = await supabase
        .from('tenant_requests')
        .update({ status: 'approved' })
        .eq('id', req.id);

      if (reqError) throw reqError;

      alert(`تم تفعيل وتأسيس مكتب "${req.company_name}" بنجاح!`);
      loadPlatformData();
    } catch (err) {
      console.error('Approve error:', err);
      alert('حدث خطأ أثناء تفعيل وتأسيس الشركة.');
    } finally {
      setDataLoading(false);
    }
  };

  // Reject Onboarding Join Request
  const handleRejectRequest = async (requestId: string) => {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    setDataLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      alert('تم رفض طلب الانضمام.');
      loadPlatformData();
    } catch (err) {
      console.error('Reject error:', err);
      alert('حدث خطأ أثناء رفض الطلب.');
    } finally {
      setDataLoading(false);
    }
  };

  if (loading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        جاري التحقق من صلاحيات المشرف...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right" style={{ direction: 'rtl' }}>
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-rose-500" />
            لوحة السوبر أدمن (سند كار)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة المكاتب، وتفعيل طلبات الانضمام، وتعيين صلاحيات المدراء
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddMemberModal(true)}
            variant="outline"
            className="border-slate-800 text-slate-300 hover:bg-slate-900/60 font-bold gap-2 px-4"
          >
            <UserPlus className="w-4 h-4 text-rose-450" />
            إضافة مدير لمكتب
          </Button>

          <Button
            onClick={() => setShowAddTenantModal(true)}
            className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-slate-950 font-bold gap-2 px-5 shadow-lg shadow-rose-500/10"
          >
            <Plus className="w-5 h-5 text-slate-950" />
            إضافة مكتب جديد يدوي
          </Button>
        </div>
      </header>

      {/* SYSTEM SUMMARY METRICS */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">إجمالي المكاتب (المستأجرين)</CardTitle>
            <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Building className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-100">{tenants.length}</div>
            <p className="text-[10px] text-slate-500 mt-1">مساحات عمل سحابية معزولة</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">إجمالي السيارات بالمنصة</CardTitle>
            <div className="p-2 rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-400">
              <Car className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-100">{totalVehicles}</div>
            <p className="text-[10px] text-slate-500 mt-1">سيارة مسجلة في كافة الشركات</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">إجمالي السائقين</CardTitle>
            <div className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-100">{totalDrivers}</div>
            <p className="text-[10px] text-slate-500 mt-1">سائق مفوض بالمنصة</p>
          </CardContent>
        </Card>
      </section>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-850 gap-2">
        <button
          onClick={() => setActiveSection('requests')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeSection === 'requests'
              ? 'border-rose-500 text-rose-450'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          طلبات الانضمام المعلقة
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-rose-500 text-slate-950 text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
              {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('tenants')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeSection === 'tenants'
              ? 'border-rose-500 text-rose-450'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          سجل المكاتب والشركات النشطة
        </button>
      </div>

      {/* REQUESTS LIST SECTION */}
      {activeSection === 'requests' && (
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-100">مراجعة طلبات الانضمام الجديدة</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              الطلبات المقدمة من مديري المكاتب لتأسيس وبناء مساحات العمل الخاصة بهم
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">جاري تحميل الطلبات...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">لا توجد طلبات انضمام مقدمة حالياً.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="pb-3 pt-2 px-4 font-bold">اسم المكتب المقترح</th>
                      <th className="pb-3 pt-2 px-4 font-bold">الاسم الكامل لمدير الطلب</th>
                      <th className="pb-3 pt-2 px-4 font-bold">رقم الجوال</th>
                      <th className="pb-3 pt-2 px-4 font-bold">البريد الإلكتروني</th>
                      <th className="pb-3 pt-2 px-4 font-bold">حالة الطلب</th>
                      <th className="pb-3 pt-2 px-4 font-bold text-center">إجراء تفعيل المكتب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {requests.map((req) => (
                      <tr key={req.id} className="text-slate-300 hover:bg-slate-950/20 transition-all">
                        <td className="py-4 px-4 font-bold text-slate-200">{req.company_name}</td>
                        <td className="py-4 px-4">{req.full_name}</td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-300 flex items-center gap-1.5 pt-4.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {req.phone}
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-400">{req.email}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : req.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {req.status === 'pending' && 'قيد الانتظار'}
                            {req.status === 'approved' && 'تم القبول والتفعيل'}
                            {req.status === 'rejected' && 'مرفوض'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {req.status === 'pending' ? (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleApproveRequest(req)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                قبول وتفعيل المكتب
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all border border-red-500/15"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 font-medium">مكتمل</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* OFFICE DIRECTORY SECTION */}
      {activeSection === 'tenants' && (
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-100">سجل مكاتب تأجير السيارات</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              عرض المكاتب النشطة وتفاصيل ملاك العمل ومفاتيح التعريف الخاصة بهم
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">جاري تحميل بيانات المكاتب...</div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">لا توجد مكاتب مسجلة بعد في قاعدة البيانات.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="pb-3 pt-2 px-4 font-bold">اسم المكتب / الشركة</th>
                      <th className="pb-3 pt-2 px-4 font-bold">معرّف المكتب (UUID)</th>
                      <th className="pb-3 pt-2 px-4 font-bold">معرّف المالك</th>
                      <th className="pb-3 pt-2 px-4 font-bold">الخطة</th>
                      <th className="pb-3 pt-2 px-4 font-bold">تاريخ الإنشاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {tenants.map((t) => (
                      <tr key={t.id} className="text-slate-300 hover:bg-slate-950/20 transition-all">
                        <td className="py-4 px-4 font-bold text-slate-200">{t.name}</td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-400">{t.id}</td>
                        <td className="py-4 px-4 font-mono text-xs text-slate-400">{t.owner_id}</td>
                        <td className="py-4 px-4">
                          <Badge className="bg-emerald-500/10 text-emerald-450 border-emerald-500/20 capitalize font-bold">
                            {t.subscription_plan === 'free' ? 'مجانية' : t.subscription_plan}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-400">
                          {new Date(t.created_at).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL: ADD TENANT OFFICE */}
      {showAddTenantModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Building className="w-5 h-5 text-rose-500" />
                إضافة مكتب تأجير سيارات جديد
              </h3>
              <button onClick={() => setShowAddTenantModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">اسم الشركة / المكتب</label>
                <input
                  required
                  type="text"
                  placeholder="مثال: شركة الخليج للسيارات"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">البريد الإلكتروني للمالك</label>
                <input
                  required
                  type="email"
                  placeholder="مثال: owner@company.com"
                  value={newTenant.owner_email}
                  onChange={(e) => setNewTenant(prev => ({ ...prev, owner_email: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-slate-700 text-left"
                  style={{ direction: 'ltr' }}
                />
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  يجب أن يكون المستخدم قد قام بالتسجيل أولاً بالبريد الإلكتروني
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">خطة الاشتراك</label>
                <select
                  value={newTenant.subscription_plan}
                  onChange={(e) => setNewTenant(prev => ({ ...prev, subscription_plan: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="free">مجانية (Free)</option>
                  <option value="premium">متقدمة (Premium)</option>
                  <option value="enterprise">مؤسسات (Enterprise)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowAddTenantModal(false)}
                  variant="outline"
                  className="border-slate-800 text-slate-400 hover:bg-slate-950"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold px-5"
                >
                  إنشاء وتفعيل المكتب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LINK USER TO TENANT OFFICE */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-500" />
                تعيين وإضافة مدير لمكتب
              </h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">اختر المكتب / الشركة</label>
                <select
                  required
                  value={newMember.tenant_id}
                  onChange={(e) => setNewMember(prev => ({ ...prev, tenant_id: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="">-- اختر الشركة --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">البريد الإلكتروني للمستخدم</label>
                <input
                  required
                  type="email"
                  placeholder="مثال: manager@company.com"
                  value={newMember.user_email}
                  onChange={(e) => setNewMember(prev => ({ ...prev, user_email: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-slate-700 text-left"
                  style={{ direction: 'ltr' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">الدور والصلاحية</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="admin">مدير (Admin)</option>
                  <option value="owner">مالك (Owner)</option>
                  <option value="operator">موظف تشغيل (Operator)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  variant="outline"
                  className="border-slate-800 text-slate-400 hover:bg-slate-950"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold px-5"
                >
                  ربط وتفويض المستخدم
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
