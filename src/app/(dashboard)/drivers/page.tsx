'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { logActivity } from '@/lib/utils/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Plus, Search, X, User, Phone, CreditCard,
  Calendar, AlertCircle, Camera, Trash2, Upload, Loader2
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

// ─── Image Upload Helper ───────────────────────────────────────────────────
async function uploadDriverImage(file: File, tenantId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `drivers/${tenantId}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('Upload error:', error); return null; }
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Image Picker Component ────────────────────────────────────────────────
function ImagePicker({
  currentUrl,
  onFileSelected,
  uploading
}: {
  currentUrl: string | null | undefined;
  onFileSelected: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFileSelected(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-emerald-500/40 bg-slate-950 cursor-pointer group hover:border-emerald-400 transition"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="صورة السائق" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-10 h-10 text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-emerald-400" />
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? 'جاري الرفع...' : preview ? 'تغيير الصورة' : 'رفع صورة'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function DriversPage() {
  const { tenant, isDemoMode } = useTenant();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingAdd, setUploadingAdd] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  // ── Add state ──────────────────────────────────────────────────────────
  const [newDriver, setNewDriver] = useState({
    name: '', license_number: '', license_expiry: '', phone: '', status: 'active' as Driver['status']
  });
  const [newDriverImageFile, setNewDriverImageFile] = useState<File | null>(null);

  // ── Edit state ─────────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDriverToEdit, setSelectedDriverToEdit] = useState<Driver | null>(null);
  const [editDriverState, setEditDriverState] = useState({
    name: '', license_number: '', license_expiry: '', phone: '', status: 'active' as Driver['status']
  });
  const [editDriverImageFile, setEditDriverImageFile] = useState<File | null>(null);

  // ── Demo mode sync ─────────────────────────────────────────────────────
  const [prevDemoMode, setPrevDemoMode] = useState(isDemoMode);
  if (isDemoMode !== prevDemoMode) {
    setPrevDemoMode(isDemoMode);
    if (isDemoMode) { setDrivers(mockDrivers); setLoading(false); }
  }

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name', { ascending: true });
    if (data) setDrivers(data as Driver[]);
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    if (!isDemoMode && tenant) loadData();
    else if (isDemoMode) { setDrivers(mockDrivers); setLoading(false); }
  }, [isDemoMode, tenant, loadData]);

  // ── Open edit modal ────────────────────────────────────────────────────
  const handleOpenEditModal = (driver: Driver) => {
    setSelectedDriverToEdit(driver);
    setEditDriverState({
      name: driver.name || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry || '',
      phone: driver.phone || '',
      status: driver.status || 'active'
    });
    setEditDriverImageFile(null);
    setShowEditModal(true);
  };

  // ── Add driver ─────────────────────────────────────────────────────────
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      setDrivers(prev => [{ id: `d_${Date.now()}`, ...newDriver }, ...prev]);
    } else if (tenant) {
      setUploadingAdd(true);
      let avatar_url: string | null = null;
      if (newDriverImageFile) {
        avatar_url = await uploadDriverImage(newDriverImageFile, tenant.id);
      }
      setUploadingAdd(false);

      const { error } = await supabase.from('drivers').insert({
        tenant_id: tenant.id,
        name: newDriver.name,
        license_number: newDriver.license_number,
        license_expiry: newDriver.license_expiry,
        phone: newDriver.phone,
        status: newDriver.status,
        avatar_url
      });
      if (error) { alert('خطأ في الإضافة: ' + error.message); return; }

      await logActivity({
        tenantId: tenant.id, action: 'create', entityType: 'driver',
        entityName: `إضافة سائق: ${newDriver.name}`, details: newDriver
      });
      loadData();
    }
    setNewDriver({ name: '', license_number: '', license_expiry: '', phone: '', status: 'active' });
    setNewDriverImageFile(null);
    setShowAddModal(false);
  };

  // ── Update driver ──────────────────────────────────────────────────────
  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverToEdit) return;

    if (isDemoMode) {
      setDrivers(prev => prev.map(d =>
        d.id === selectedDriverToEdit.id ? { ...d, ...editDriverState } : d
      ));
    } else if (tenant) {
      setUploadingEdit(true);
      let avatar_url = selectedDriverToEdit.avatar_url ?? null;
      if (editDriverImageFile) {
        const uploaded = await uploadDriverImage(editDriverImageFile, tenant.id);
        if (uploaded) avatar_url = uploaded;
      }
      setUploadingEdit(false);

      const payload = { ...editDriverState, avatar_url, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('drivers')
        .update(payload)
        .eq('id', selectedDriverToEdit.id)
        .eq('tenant_id', tenant.id);

      if (error) { alert('خطأ في التعديل: ' + error.message); return; }

      await logActivity({
        tenantId: tenant.id, action: 'update', entityType: 'driver',
        entityName: `تعديل سائق: ${editDriverState.name}`, details: payload
      });
      loadData();
    }
    setShowEditModal(false);
    setSelectedDriverToEdit(null);
    setEditDriverImageFile(null);
  };

  // ── Delete driver ──────────────────────────────────────────────────────
  const handleDeleteDriver = async (driver: Driver) => {
    if (!confirm(`هل أنت متأكد من حذف السائق "${driver.name}" نهائياً؟`)) return;
    if (isDemoMode) {
      setDrivers(prev => prev.filter(d => d.id !== driver.id));
      return;
    }
    if (!tenant) return;
    const { error } = await supabase.from('drivers').delete()
      .eq('id', driver.id).eq('tenant_id', tenant.id);
    if (error) { alert('فشل الحذف: ' + error.message); return; }
    loadData();
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const isLicenseExpiredSoon = (s: string) => {
    const diff = new Date(s).getTime() - Date.now();
    return diff <= 30 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (s: string) => new Date(s) < new Date();

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );

  // ── JSX ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6" style={{ direction: 'rtl' }}>
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            إدارة السائقين
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {drivers.length} سائق — تسجيل وتحديث بيانات السائقين وصورهم ورخصهم
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          إضافة سائق جديد
        </Button>
      </header>

      {/* SEARCH */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="البحث باسم السائق أو رقم الجوال..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-slate-500"
        />
      </div>

      {/* DRIVERS GRID */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-slate-300">لا يوجد سائقون</h3>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => {
            const expiredSoon = isLicenseExpiredSoon(driver.license_expiry);
            const expired = isExpired(driver.license_expiry);
            return (
              <Card key={driver.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all flex flex-col">
                <div className="p-5 flex flex-col gap-4">
                  {/* Top: avatar + name + badge */}
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {driver.avatar_url ? (
                        <img
                          src={driver.avatar_url}
                          alt={driver.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500/30 shadow-lg"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                          <User className="w-7 h-7 text-emerald-400" />
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                        driver.status === 'active' ? 'bg-emerald-500' :
                        driver.status === 'in_operation' ? 'bg-amber-500' : 'bg-slate-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-100 text-sm leading-tight truncate">{driver.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {driver.status === 'active' && <Badge variant="outline" className="text-[10px] py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/25">نشط ومتاح</Badge>}
                        {driver.status === 'in_operation' && <Badge variant="outline" className="text-[10px] py-0 bg-amber-500/10 text-amber-400 border-amber-500/25">في رحلة</Badge>}
                        {driver.status === 'inactive' && <Badge variant="outline" className="text-[10px] py-0 bg-slate-800 text-slate-400 border-slate-700">غير نشط</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850/40 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5"><Phone className="w-3 h-3" />الجوال</span>
                      <span className="font-mono text-slate-300" style={{ direction: 'ltr' }}>{driver.phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5"><CreditCard className="w-3 h-3" />رقم الرخصة</span>
                      <span className="text-slate-300">{driver.license_number}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-900 pt-2">
                      <span className="text-slate-500 flex items-center gap-1.5"><Calendar className="w-3 h-3" />انتهاء الرخصة</span>
                      <span className={`font-bold ${expired ? 'text-rose-400' : expiredSoon ? 'text-amber-400' : 'text-slate-300'}`}>
                        {driver.license_expiry}
                      </span>
                    </div>
                  </div>

                  {/* Alerts */}
                  {expired && (
                    <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      رخصة القيادة منتهية!
                    </div>
                  )}
                  {!expired && expiredSoon && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      الرخصة تنتهي خلال 30 يوم
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-3 bg-slate-950/30 border-t border-slate-800/60 flex justify-end gap-2 mt-auto">
                  <button
                    onClick={() => handleDeleteDriver(driver)}
                    className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-rose-500 text-slate-400 hover:text-white border border-slate-700 transition text-xs"
                    title="حذف السائق"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <Button
                    variant="outline"
                    className="text-xs h-8 border-slate-700 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
                    onClick={() => handleOpenEditModal(driver)}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    تعديل البيانات
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* ── ADD MODAL ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative text-right max-h-[90vh] overflow-y-auto" style={{ direction: 'rtl' }}>
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                إضافة سائق جديد
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs">
                تسجيل سائق جديد مع صورته الشخصية ورخصة القيادة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddDriver} className="flex flex-col gap-4">
                {/* Photo */}
                <ImagePicker
                  currentUrl={null}
                  onFileSelected={(f) => setNewDriverImageFile(f)}
                  uploading={uploadingAdd}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم السائق بالكامل</label>
                  <input required type="text" placeholder="مثال: صالح بن خالد الحربي"
                    value={newDriver.name}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم جوال السائق</label>
                  <input required type="tel" placeholder="05xxxxxxxx"
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم رخصة القيادة</label>
                    <input required type="text" placeholder="رقم الرخصة"
                      value={newDriver.license_number}
                      onChange={(e) => setNewDriver(prev => ({ ...prev, license_number: e.target.value }))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ انتهاء الرخصة</label>
                    <input required type="date"
                      value={newDriver.license_expiry}
                      onChange={(e) => setNewDriver(prev => ({ ...prev, license_expiry: e.target.value }))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={uploadingAdd}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-1 gap-2"
                >
                  {uploadingAdd && <Loader2 className="w-4 h-4 animate-spin" />}
                  تسجيل وإضافة السائق
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── EDIT MODAL ────────────────────────────────────────────────── */}
      {showEditModal && selectedDriverToEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative text-right max-h-[90vh] overflow-y-auto" style={{ direction: 'rtl' }}>
            <button
              onClick={() => { setShowEditModal(false); setSelectedDriverToEdit(null); }}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                تعديل بيانات السائق
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs">
                يمكنك تغيير الصورة الشخصية وكل البيانات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateDriver} className="flex flex-col gap-4">
                {/* Photo picker with current photo shown */}
                <ImagePicker
                  currentUrl={selectedDriverToEdit.avatar_url}
                  onFileSelected={(f) => setEditDriverImageFile(f)}
                  uploading={uploadingEdit}
                />
                {selectedDriverToEdit.avatar_url && !editDriverImageFile && (
                  <p className="text-center text-xs text-slate-500 -mt-2">الصورة الحالية معروضة — اضغط لتغييرها</p>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم السائق بالكامل</label>
                  <input required type="text"
                    value={editDriverState.name}
                    onChange={(e) => setEditDriverState(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم جوال السائق</label>
                  <input required type="text"
                    value={editDriverState.phone}
                    onChange={(e) => setEditDriverState(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم رخصة القيادة</label>
                    <input required type="text"
                      value={editDriverState.license_number}
                      onChange={(e) => setEditDriverState(prev => ({ ...prev, license_number: e.target.value }))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ انتهاء الرخصة</label>
                    <input required type="date"
                      value={editDriverState.license_expiry}
                      onChange={(e) => setEditDriverState(prev => ({ ...prev, license_expiry: e.target.value }))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">حالة السائق</label>
                  <select
                    value={editDriverState.status}
                    onChange={(e) => setEditDriverState(prev => ({ ...prev, status: e.target.value as Driver['status'] }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="active">نشط ومتاح</option>
                    <option value="inactive">غير نشط / إجازة</option>
                    <option value="in_operation">في رحلة عمل</option>
                  </select>
                </div>

                <Button type="submit" disabled={uploadingEdit}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-1 gap-2"
                >
                  {uploadingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
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
