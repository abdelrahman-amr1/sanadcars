'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Plus,
  X,
  Search,
  Phone,
  User,
  Trash2,
  Edit,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export default function CustomersPage() {
  const { tenant, isDemoMode } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true });
      if (error) throw error;
      if (data) setCustomers(data as Customer[]);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (!isDemoMode && tenant) loadData();
    else setLoading(false);
  }, [isDemoMode, tenant, loadData]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    try {
      const { error } = await supabase.from('customers').insert({
        tenant_id: tenant.id,
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
      });
      if (error) {
        if (error.code === '23505') {
          alert('رقم الجوال هذا مسجل بالفعل لعميل آخر.');
        } else {
          throw error;
        }
        return;
      }
      setShowAddModal(false);
      setNewCustomer({ name: '', phone: '' });
      loadData();
    } catch (err) {
      console.error('Error adding customer:', err);
      alert('حدث خطأ أثناء إضافة العميل.');
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !editingCustomer) return;
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: editingCustomer.name.trim(),
          phone: editingCustomer.phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingCustomer.id)
        .eq('tenant_id', tenant.id);
      if (error) {
        if (error.code === '23505') {
          alert('رقم الجوال هذا مسجل بالفعل لعميل آخر.');
        } else {
          throw error;
        }
        return;
      }
      setShowEditModal(false);
      setEditingCustomer(null);
      loadData();
    } catch (err) {
      console.error('Error editing customer:', err);
      alert('حدث خطأ أثناء تعديل بيانات العميل.');
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!tenant) return;
    if (!confirm(`هل أنت متأكد من حذف العميل "${name}" نهائياً؟`)) return;
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error deleting customer:', err);
      alert('فشل حذف العميل.');
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="flex flex-col gap-6 text-right" style={{ direction: 'rtl' }}>
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            العملاء المسجلين
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {customers.length} عميل مسجل — ابحث وعدّل بياناتهم بسهولة
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5 shadow-lg shadow-emerald-500/15"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          إضافة عميل جديد
        </Button>
      </header>

      {/* SEARCH */}
      <div className="relative w-full max-w-md">
        <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-500" />
        </span>
        <input
          type="text"
          placeholder="البحث باسم العميل أو رقم الجوال..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        />
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">جاري تحميل العملاء...</span>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-800/50 rounded-2xl">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-bold text-slate-300">لا يوجد عملاء</h3>
          <p className="text-xs text-slate-500 mt-1">
            لا يوجد عملاء يطابقون بحثك أو لم يتم تسجيل أي عملاء بعد.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => (
            <Card
              key={cust.id}
              className="bg-slate-900/60 border-slate-800/80 hover:border-emerald-500/20 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -ml-6 -mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-5 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200 text-sm group-hover:text-emerald-400 transition-colors">
                      {cust.name}
                    </span>
                    <span
                      className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"
                      style={{ direction: 'ltr' }}
                    >
                      {cust.phone}
                      <Phone className="w-3 h-3 text-slate-600" />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setEditingCustomer(cust);
                      setShowEditModal(true);
                    }}
                    className="p-1.5 bg-slate-800/50 hover:bg-emerald-500 hover:text-slate-950 text-slate-400 rounded-lg border border-slate-700 transition"
                    title="تعديل"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                    className="p-1.5 bg-slate-800/50 hover:bg-rose-500 hover:text-white text-slate-400 rounded-lg border border-slate-700 transition"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card
            className="w-full max-w-sm bg-slate-900 border-slate-800 shadow-2xl relative text-right"
            style={{ direction: 'rtl' }}
          >
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                إضافة عميل جديد
              </CardTitle>
              <CardDescription className="text-slate-500">
                تسجيل بيانات اتصال العميل في قاعدة البيانات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم العميل</label>
                  <input
                    required
                    type="text"
                    placeholder="مثال: محمد أحمد"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم الجوال</label>
                  <input
                    required
                    type="tel"
                    placeholder="05xxxxxxx"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 mt-1"
                >
                  تسجيل العميل
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card
            className="w-full max-w-sm bg-slate-900 border-slate-800 shadow-2xl relative text-right"
            style={{ direction: 'rtl' }}
          >
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingCustomer(null);
              }}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-400" />
                تعديل بيانات العميل
              </CardTitle>
              <CardDescription className="text-slate-500">
                تعديل الاسم أو رقم الجوال للعميل المحدد
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditCustomer} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم العميل</label>
                  <input
                    required
                    type="text"
                    value={editingCustomer.name}
                    onChange={(e) =>
                      setEditingCustomer((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم الجوال</label>
                  <input
                    required
                    type="tel"
                    value={editingCustomer.phone}
                    onChange={(e) =>
                      setEditingCustomer((prev) => (prev ? { ...prev, phone: e.target.value } : null))
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 mt-1"
                >
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
