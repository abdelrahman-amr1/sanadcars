'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/context/TenantContext';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { logActivity } from '@/lib/utils/audit';
import {
  Settings,
  Users,
  History,
  Palette,
  Moon,
  Sun,
  UserPlus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Shield,
  Clock
} from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'operator';
  created_at: string;
  user_email?: string;
}

interface AuditLog {
  id: string;
  user_email: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_name: string;
  created_at: string;
}

export default function SettingsPage() {
  const { tenant, refreshTenant, setPrimaryColor, setDarkMode: setContextDarkMode } = useTenant();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'audit'>('general');
  const [loading, setLoading] = useState(false);

  // General settings state
  const [themeColor, setThemeColor] = useState('emerald');
  const [darkMode, setDarkMode] = useState(true);

  // User management state
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'operator'>('operator');
  const [usersLoading, setUsersLoading] = useState(false);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Change password states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('كلمتا المرور غير متطابقتين');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('تم تحديث كلمة المرور الخاصة بك بنجاح!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'فشل تحديث كلمة المرور';
      alert(`خطأ: ${errMsg}`);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Sync settings state from active tenant
  useEffect(() => {
    if (tenant) {
      setThemeColor(tenant.primary_color || 'emerald');
      setDarkMode(tenant.dark_mode !== false);
    }
  }, [tenant]);

  const handleColorChange = (color: string) => {
    setThemeColor(color);
    setPrimaryColor(color);
  };

  const handleDarkModeChange = (dark: boolean) => {
    setDarkMode(dark);
    setContextDarkMode(dark);
  };

  // Load tenant members
  const loadMembers = useCallback(async () => {
    if (!tenant) return;
    setUsersLoading(true);
    try {
      // First try to load from view (with emails)
      const { data, error } = await supabase
        .from('tenant_members_with_emails')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to table if view doesn't exist yet
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('tenant_members')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        setMembers(fallbackData as Member[]);
      } else {
        setMembers(data as Member[]);
      }
    } catch (err) {
      console.error('Error loading members:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [tenant]);

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    if (!tenant) return;
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAuditLogs(data as AuditLog[]);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [tenant]);

  // Load data based on tab
  useEffect(() => {
    if (activeTab === 'users') {
      loadMembers();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadMembers, loadAuditLogs]);

  // Save General Theme Settings
  const handleSaveGeneral = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          primary_color: themeColor,
          dark_mode: darkMode
        })
        .eq('id', tenant.id);

      if (error) throw error;

      await logActivity({
        tenantId: tenant.id,
        action: 'update',
        entityType: 'member',
        entityName: `إعدادات المظهر (${themeColor})`,
        details: { primary_color: themeColor, dark_mode: darkMode }
      });

      await refreshTenant();
      alert('تم حفظ إعدادات المظهر واللون بنجاح!');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('فشل حفظ الإعدادات، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  // Add Member by Email/Password directly
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !newMemberEmail.trim() || !newMemberPassword.trim()) {
      alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    if (newMemberPassword.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setUsersLoading(true);
    try {
      // Create user and add as tenant member via SQL RPC function
      const { data: success, error: rpcError } = await supabase
        .rpc('create_and_add_tenant_member', {
          user_email: newMemberEmail.trim(),
          user_password: newMemberPassword.trim(),
          target_tenant_id: tenant.id,
          target_role: newMemberRole
        });

      if (rpcError) throw rpcError;

      await logActivity({
        tenantId: tenant.id,
        action: 'create',
        entityType: 'member',
        entityName: `إضافة موظف جديد بالبريد: ${newMemberEmail.trim()}`,
        details: { email: newMemberEmail.trim(), role: newMemberRole }
      });

      alert('تم إنشاء حساب الموظف وإضافته بنجاح!');
      setNewMemberEmail('');
      setNewMemberPassword('');
      loadMembers();
    } catch (err) {
      console.error('Error adding member:', err);
      const errMsg = err instanceof Error ? err.message : 'فشل إضافة العضو';
      alert(`فشل إضافة الموظف: ${errMsg}`);
    } finally {
      setUsersLoading(false);
    }
  };

  // Delete/Remove Member
  const handleRemoveMember = async (memberId: string, userUid: string) => {
    if (!tenant) return;
    if (!confirm('هل أنت متأكد من إزالة هذا المستخدم وسحب صلاحياته من المكتب؟')) return;
    setUsersLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await logActivity({
        tenantId: tenant.id,
        action: 'delete',
        entityType: 'member',
        entityName: `إزالة العضو: ${userUid}`,
        details: { user_id: userUid }
      });

      alert('تم إزالة المستخدم بنجاح.');
      loadMembers();
    } catch (err) {
      console.error('Error removing member:', err);
      alert('حدث خطأ أثناء إزالة العضو.');
    } finally {
      setUsersLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-right" style={{ direction: 'rtl' }}>
      {/* HEADER */}
      <header className="border-b border-slate-800/60 pb-5">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-emerald-500" />
          إعدادات المكتب والمنصة
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          إدارة ألوان مكتبك الحالي، التحكم بصلاحيات الموظفين، ومتابعة سجل الحركات التفصيلي
        </p>
      </header>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-850 gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'general'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          المظهر والتخصيص
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          إدارة موظفي المكتب
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'audit'
              ? 'border-emerald-500 text-emerald-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          سجل الحركة (Audit Log)
        </button>
      </div>

      {/* TAB CONTENT: GENERAL & CUSTOMIZATION */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-slate-900/60 border-slate-800 backdrop-blur-lg">
              <CardHeader>
                <CardTitle className="text-base font-black text-slate-100">ألوان المنصة وموضوع العرض</CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  خصص لون الواجهة الرئيسي ليعبر عن الهوية البصرية الخاصة بشركتك
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Color Select */}
                <div className="space-y-3">
                  <label className="text-xs text-slate-400 font-bold">اللون الرئيسي للشركة</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'emerald', name: 'الأخضر الزمردي', hex: '#10b981' },
                      { id: 'blue', name: 'الأزرق الملكي', hex: '#3b82f6' },
                      { id: 'rose', name: 'الأحمر الياقوتي', hex: '#f43f5e' },
                      { id: 'amber', name: 'الذهبي / البرتقالي', hex: '#f59e0b' },
                      { id: 'indigo', name: 'النيلي الداكن', hex: '#6366f1' },
                      { id: 'violet', name: 'البنفسجي الإمبراطوري', hex: '#8b5cf6' }
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleColorChange(c.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-right transition-all ${
                          themeColor === c.id
                            ? 'border-emerald-500 bg-emerald-500/10 text-slate-100 shadow-md'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="w-4.5 h-4.5 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="text-xs font-semibold">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dark mode toggle */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-5">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-200">الوضع الداكن (Dark Mode)</h4>
                    <p className="text-[10px] text-slate-500">تفعيل خلفية العرض الليلية المريحة للعين</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDarkModeChange(true)}
                      className={`p-2 rounded-lg border transition-all ${
                        darkMode
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                          : 'border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Moon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDarkModeChange(false)}
                      className={`p-2 rounded-lg border transition-all ${
                        !darkMode
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                          : 'border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Sun className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <Button
                    onClick={handleSaveGeneral}
                    disabled={loading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-8"
                  >
                    {loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Theme Preview Card */}
            <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-sm font-black text-slate-300">معاينة مباشرة لمكتبك</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="w-full max-w-[200px] bg-slate-950 border border-slate-850 rounded-2xl p-4 shadow-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 font-bold">اسم الفرع</span>
                    <span className="text-[10px] text-slate-200 font-black">{tenant?.name || 'شركة السيارات'}</span>
                  </div>
                  <div className="h-2.5 rounded bg-slate-900 w-full" />
                  <div className="h-6 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    زر تجريبي نشط
                  </div>
                  <div className="flex gap-2">
                    <div className="w-full h-8 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold flex items-center justify-center">
                      تقارير حية
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PASSWORD CHANGE FORM */}
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-100">أمان الحساب وتغيير كلمة المرور</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                تحديث كلمة المرور الحالية لحماية صلاحيات الدخول الخاصة بمدير الكيان
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">كلمة المرور الجديدة</label>
                    <input
                      required
                      type="password"
                      minLength={6}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left placeholder:text-slate-800"
                      style={{ direction: 'ltr' }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-bold">تأكيد كلمة المرور</label>
                    <input
                      required
                      type="password"
                      minLength={6}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left placeholder:text-slate-800"
                      style={{ direction: 'ltr' }}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={passwordLoading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6"
                  >
                    {passwordLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB CONTENT: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Add user form */}
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-100">إضافة موظف أو مدير جديد للفرع</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                تستطيع تفويض مستخدم جديد بالمنظومة للتحكم في السيارات، السائقين، وعقود التشغيل الخاصة بفرعك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <label className="text-xs text-slate-400 font-bold">البريد الإلكتروني للموظف بالمنصة</label>
                  <input
                    required
                    type="email"
                    placeholder="مثال: employee@example.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-800 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <label className="text-xs text-slate-400 font-bold">كلمة المرور للحساب</label>
                  <input
                    required
                    type="password"
                    minLength={6}
                    placeholder="مثال: 123456"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-800 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5 w-full sm:w-48">
                  <label className="text-xs text-slate-455 font-bold">الصلاحية والدور</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'operator')}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="operator">موظف تشغيل (Operator)</option>
                    <option value="admin">مدير فرع (Admin)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={usersLoading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 shrink-0 w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4 ml-1.5" />
                  تفويض وإضافة العضو
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Members table */}
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-100">سجل موظفي المكتب المعتمدين</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-center py-8 text-slate-500 text-sm">جاري تحميل قائمة الموظفين...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">لا يوجد موظفون مسجلون في هذا المكتب.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="pb-3 pt-2 px-4 font-bold">البريد الإلكتروني</th>
                        <th className="pb-3 pt-2 px-4 font-bold">معرّف الموظف (UUID)</th>
                        <th className="pb-3 pt-2 px-4 font-bold">دور الصلاحية بالمنصة</th>
                        <th className="pb-3 pt-2 px-4 font-bold text-left">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {members.map((m) => (
                        <tr key={m.id} className="text-slate-300 hover:bg-slate-950/20 transition-all">
                          <td className="py-4 px-4 font-semibold text-slate-200 text-left" style={{ direction: 'ltr' }}>
                            {m.user_email || 'غير متاح (يرجى تطبيق SQL)'}
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-400">{m.user_id}</td>
                          <td className="py-4 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                m.role === 'owner'
                                  ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                                  : m.role === 'admin'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {m.role === 'owner' ? 'مالك المكتب' : m.role === 'admin' ? 'مدير' : 'موظف تشغيل'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-left">
                            {m.role !== 'owner' && (
                              <button
                                onClick={() => handleRemoveMember(m.id, m.user_id)}
                                className="text-rose-450 hover:text-rose-400 p-1.5 hover:bg-rose-500/5 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        </div>
      )}

      {/* TAB CONTENT: AUDIT HISTORY LOG */}
      {activeTab === 'audit' && (
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base font-black text-slate-100">سجل حركة العمليات التفصيلي (Audit Log)</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              مراقبة حية لكافة عمليات الإضافة والحذف والتعديل التي يقوم بها الموظفون داخل فرعك
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="text-center py-8 text-slate-500 text-sm">جاري تحميل سجل الحركة...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">لا توجد حركات مسجلة بالنظام بعد.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="pb-3 pt-2 px-4 font-bold">المستخدم</th>
                      <th className="pb-3 pt-2 px-4 font-bold">نوع الإجراء</th>
                      <th className="pb-3 pt-2 px-4 font-bold">البيانات / العملية</th>
                      <th className="pb-3 pt-2 px-4 font-bold">التفاصيل</th>
                      <th className="pb-3 pt-2 px-4 font-bold">التاريخ والوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="text-slate-300 hover:bg-slate-950/20 transition-all">
                        <td className="py-4 px-4 text-xs font-semibold text-slate-300">{log.user_email}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              log.action === 'create'
                                ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                                : log.action === 'update'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {log.action === 'create' ? 'إضافة' : log.action === 'update' ? 'تعديل' : 'حذف'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-xs font-semibold text-slate-400">
                          {log.entity_type === 'vehicle' && 'سيارة 🚗'}
                          {log.entity_type === 'driver' && 'سائق 👤'}
                          {log.entity_type === 'order' && 'عقد تشغيل 📄'}
                          {log.entity_type === 'violation' && 'مخالفة مرورية ⚠️'}
                          {log.entity_type === 'maintenance' && 'صيانة سيارة 🔧'}
                          {log.entity_type === 'member' && 'موظف 👥'}
                        </td>
                        <td className="py-4 px-4 text-xs font-medium text-slate-200">{log.entity_name}</td>
                        <td className="py-4 px-4 text-xs text-slate-500">
                          {new Date(log.created_at).toLocaleString('ar-EG', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
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
    </div>
  );
}
