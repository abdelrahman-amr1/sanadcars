'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { logActivity } from '@/lib/utils/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Plus,
  Search,
  X,
  User,
  Phone,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  Bookmark
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  license_number: string;
  license_expiry: string;
  phone: string;
  status: 'active' | 'inactive' | 'in_operation';
  avatar_url?: string | null;
}

const mockDrivers: Driver[] = [
  { id: 'd1', name: 'أحمد محمد عبد الله', license_number: 'L123456', license_expiry: '2026-09-15', phone: '0501234567', status: 'in_operation' },
  { id: 'd2', name: 'خالد وليد العتيبي', license_number: 'L789012', license_expiry: '2026-07-10', phone: '0547654321', status: 'active' },
  { id: 'd3', name: 'محمد علي الشهري', license_number: 'L345678', license_expiry: '2028-12-01', phone: '0569876543', status: 'active' },
  { id: 'd4', name: 'ياسر فهد السديري', license_number: 'L901234', license_expiry: '2026-06-01', phone: '0555554433', status: 'inactive' }
];

export default function DriversPage() {
  const { tenant, isDemoMode } = useTenant();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  // Edit Driver States
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDriverToEdit, setSelectedDriverToEdit] = useState<Driver | null>(null);
  const [editDriverState, setEditDriverState] = useState({
    name: '',
    license_number: '',
    license_expiry: '',
    phone: '',
    status: 'active' as Driver['status']
  });

  const handleOpenEditModal = (driver: Driver) => {
    setSelectedDriverToEdit(driver);
    setEditDriverState({
      name: driver.name || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      phone: driver.phone || '',
      status: driver.status || 'active'
    });
    setShowEditModal(true);
  };

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverToEdit) return;

    const payload = {
      name: editDriverState.name,
      license_number: editDriverState.license_number,
      license_expiry: editDriverState.license_expiry,
      phone: editDriverState.phone,
      status: editDriverState.status
    };

    if (isDemoMode) {
      setDrivers(prev => prev.map(d => d.id === selectedDriverToEdit.id ? { ...d, ...payload } : d));
    } else {
      if (tenant) {
        const { error } = await supabase.from('drivers')
          .update(payload)
          .eq('id', selectedDriverToEdit.id)
          .eq('tenant_id', tenant.id);
          
        if (error) {
          alert('حدث خطأ أثناء تعديل بيانات السائق: ' + error.message);
          return;
        }

        await logActivity({
          tenantId: tenant.id,
          action: 'update',
          entityType: 'driver',
          entityName: `تعديل بيانات السائق: ${editDriverState.name} (جوال: ${editDriverState.phone})`,
          details: payload
        });
        
        loadData();
      }
    }

    setShowEditModal(false);
    setSelectedDriverToEdit(null);
  };

  const [newDriver, setNewDriver] = useState({
    name: '',
    license_number: '',
    license_expiry: '',
    phone: '',
    status: 'active' as Driver['status']
  });

  // Sync Demo Mode changes at render time
  const [prevDemoMode, setPrevDemoMode] = useState(isDemoMode);
  if (isDemoMode !== prevDemoMode) {
    setPrevDemoMode(isDemoMode);
    if (isDemoMode) {
      setDrivers(mockDrivers);
    }
  }

  const loadData = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase.from('drivers').select('*').eq('tenant_id', tenant.id);
    if (data) setDrivers(data as Driver[]);
  }, [tenant]);

  useEffect(() => {
    if (!isDemoMode && tenant) {
      loadData();
    }
  }, [isDemoMode, tenant, loadData]);

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      const added: Driver = {
        id: `d_${Date.now()}`,
        name: newDriver.name,
        license_number: newDriver.license_number,
        license_expiry: newDriver.license_expiry,
        phone: newDriver.phone,
        status: newDriver.status
      };
      setDrivers(prev => [added, ...prev]);
    } else {
      if (tenant) {
        await supabase.from('drivers').insert({
          tenant_id: tenant.id,
          name: newDriver.name,
          license_number: newDriver.license_number,
          license_expiry: newDriver.license_expiry,
          phone: newDriver.phone,
          status: newDriver.status
        });

        await logActivity({
          tenantId: tenant.id,
          action: 'create',
          entityType: 'driver',
          entityName: `إضافة سائق جديد: ${newDriver.name} (جوال: ${newDriver.phone})`,
          details: newDriver
        });

        loadData();
      }
    }

    setNewDriver({
      name: '',
      license_number: '',
      license_expiry: '',
      phone: '',
      status: 'active'
    });
    setShowAddModal(false);
  };

  const isLicenseExpiredSoon = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30; // true if expires in less than 30 days or already expired
  };

  const isExpired = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const today = new Date();
    return expiry < today;
  };

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            إدارة السائقين
          </h2>
          <p className="text-slate-400 text-xs mt-1">تسجيل وتحديث بيانات سائقي السيارات ورخص القيادة وصلاحيتها</p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          إضافة سائق جديد
        </Button>
      </header>

      {/* FILTER & SEARCH */}
      <section className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث باسم السائق أو رقم الجوال..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-650"
          />
        </div>
      </section>

      {/* DRIVERS GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => {
          const expiredSoon = isLicenseExpiredSoon(driver.license_expiry);
          const expired = isExpired(driver.license_expiry);

          return (
            <Card key={driver.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div className="p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-200 text-lg flex items-center gap-3">
                      {driver.avatar_url ? (
                        <img
                          src={driver.avatar_url}
                          alt={driver.name}
                          className="w-10 h-10 rounded-full object-cover border border-emerald-500/20 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                          <User className="w-5 h-5 text-emerald-400" />
                        </div>
                      )}
                      <div>
                        <span>{driver.name}</span>
                        <span className="text-xs text-slate-450 block font-normal mt-0.5">رقم السائق الفريد: {driver.id.substring(0, 8)}...</span>
                      </div>
                    </h3>
                  </div>

                  {driver.status === 'active' && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25">نشط ومتاح</Badge>
                  )}
                  {driver.status === 'in_operation' && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/25">في رحلة عمل</Badge>
                  )}
                  {driver.status === 'inactive' && (
                    <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700">غير نشط</Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-850/40 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      رقم الجوال
                    </span>
                    <span className="font-bold text-slate-350 text-left">{driver.phone}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      رقم الرخصة
                    </span>
                    <span className="font-bold text-slate-350">{driver.license_number}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-900/60 pt-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      تاريخ انتهاء الرخصة
                    </span>
                    <span className={`font-bold ${expired ? 'text-rose-500' : expiredSoon ? 'text-amber-500' : 'text-slate-350'}`}>
                      {driver.license_expiry}
                    </span>
                  </div>
                </div>

                {expired && (
                  <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>رخصة القيادة منتهية تماماً! يرجى إيقاف السائق.</span>
                  </div>
                )}
                {!expired && expiredSoon && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>رخصة القيادة تنتهي قريباً (أقل من 30 يوم)!</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="text-xs h-8 border-slate-800 text-emerald-450 hover:text-emerald-400"
                  onClick={() => handleOpenEditModal(driver)}
                >
                  تعديل البيانات
                </Button>
              </div>
            </Card>
          );
        })}
      </section>

      {/* ADD DRIVER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                إضافة سائق جديد
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل سائق جديد في نظام مكاتب التأجير وعقد التشغيل
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddDriver} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم السائق بالكامل</label>
                  <input
                    required
                    type="text"
                    placeholder="مثال: صالح بن خالد الحربي"
                    value={newDriver.name}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم جوال السائق</label>
                  <input
                    required
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم رخصة القيادة</label>
                    <input
                      required
                      type="text"
                      placeholder="رقم الرخصة"
                      value={newDriver.license_number}
                      onChange={(e) => setNewDriver(prev => ({ ...prev, license_number: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ انتهاء الرخصة</label>
                    <input
                      required
                      type="date"
                      value={newDriver.license_expiry}
                      onChange={(e) => setNewDriver(prev => ({ ...prev, license_expiry: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تسجيل وإضافة السائق
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      {/* EDIT DRIVER MODAL */}
      {showEditModal && selectedDriverToEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative text-right" style={{ direction: 'rtl' }}>
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedDriverToEdit(null);
              }}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                تعديل بيانات السائق
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                تعديل تفاصيل السائق ورقم الرخصة والهاتف في قاعدة البيانات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateDriver} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم السائق بالكامل</label>
                  <input
                    required
                    type="text"
                    value={editDriverState.name}
                    onChange={(e) => setEditDriverState(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم جوال السائق</label>
                  <input
                    required
                    type="text"
                    value={editDriverState.phone}
                    onChange={(e) => setEditDriverState(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم رخصة القيادة</label>
                    <input
                      required
                      type="text"
                      value={editDriverState.license_number}
                      onChange={(e) => setEditDriverState(prev => ({ ...prev, license_number: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ انتهاء الرخصة</label>
                    <input
                      required
                      type="date"
                      value={editDriverState.license_expiry}
                      onChange={(e) => setEditDriverState(prev => ({ ...prev, license_expiry: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">حالة السائق</label>
                  <select
                    value={editDriverState.status}
                    onChange={(e) => setEditDriverState(prev => ({ ...prev, status: e.target.value as Driver['status'] }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="active">نشط ومتاح</option>
                    <option value="inactive">غير نشط / إجازة</option>
                    <option value="in_operation">في رحلة عمل</option>
                  </select>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  حفظ التعديلات
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
