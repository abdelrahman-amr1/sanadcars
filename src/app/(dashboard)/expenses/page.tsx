'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { logActivity } from '@/lib/utils/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  X,
  Trash2,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Pencil
} from 'lucide-react';

interface Expense {
  id: string;
  tenant_id: string;
  order_id: string | null;
  amount: number;
  category: 'fuel' | 'toll' | 'parking' | 'cleaning' | 'other';
  description: string | null;
  created_at: string;
  order?: {
    customer_name: string;
  };
}

interface Order {
  id: string;
  customer_name: string;
  status: string;
}

const mockExpenses: Expense[] = [
  {
    id: 'e1',
    tenant_id: 't1',
    order_id: 'o2',
    amount: 50,
    category: 'fuel',
    description: 'وقود مكمل لتسليم العقد المالي للعميل فهد الحربي',
    created_at: '2026-06-29T10:30:00Z',
    order: { customer_name: 'فهد سليم الحربي' }
  },
  {
    id: 'e2',
    tenant_id: 't1',
    order_id: null,
    amount: 1500,
    category: 'other',
    description: 'إيجار مقر المكتب الرئيسي لشهر يونيو 2026',
    created_at: '2026-07-02T12:00:00Z'
  },
  {
    id: 'e3',
    tenant_id: 't1',
    order_id: null,
    amount: 250,
    category: 'cleaning',
    description: 'شراء مواد غسيل وتلميع لأسطول السيارات بالجراج',
    created_at: '2026-07-04T15:00:00Z'
  }
];

const mockOrders: Order[] = [
  { id: 'o1', customer_name: 'سليمان بن عبد العزيز', status: 'active' },
  { id: 'o2', customer_name: 'فهد سليم الحربي', status: 'closed' }
];

export default function ExpensesPage() {
  const { tenant, isDemoMode, currencySymbol } = useTenant();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Edit Expense States
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpenseToEdit, setSelectedExpenseToEdit] = useState<Expense | null>(null);
  const [editExpenseState, setEditExpenseState] = useState({
    amount: 0,
    category: 'other' as Expense['category'],
    description: '',
    order_id: ''
  });

  const handleOpenEditModal = (expense: Expense) => {
    setSelectedExpenseToEdit(expense);
    setEditExpenseState({
      amount: expense.amount || 0,
      category: expense.category || 'other',
      description: expense.description || '',
      order_id: expense.order_id || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseToEdit) return;

    if (editExpenseState.amount <= 0) {
      alert('يرجى إدخال قيمة صحيحة للمصروف');
      return;
    }

    const payload = {
      amount: editExpenseState.amount,
      category: editExpenseState.category,
      description: editExpenseState.description || null,
      order_id: editExpenseState.order_id ? editExpenseState.order_id : null
    };

    if (isDemoMode) {
      const selectedOrder = orders.find(o => o.id === payload.order_id);
      setExpenses(prev => prev.map(e => {
        if (e.id === selectedExpenseToEdit.id) {
          return {
            ...e,
            ...payload,
            order: selectedOrder ? { customer_name: selectedOrder.customer_name } : undefined
          };
        }
        return e;
      }));
    } else {
      if (tenant) {
        const { error } = await supabase.from('expenses')
          .update(payload)
          .eq('id', selectedExpenseToEdit.id)
          .eq('tenant_id', tenant.id);

        if (error) {
          alert('حدث خطأ أثناء تعديل بيانات المصروف: ' + error.message);
          return;
        }

        await logActivity({
          tenantId: tenant.id,
          action: 'update',
          entityType: 'maintenance',
          entityName: `تعديل سجل مصروف بقيمة ${payload.amount} ${currencySymbol} - ${payload.description || ''}`,
          details: payload
        });

        loadData();
      }
    }

    setShowEditModal(false);
    setSelectedExpenseToEdit(null);
  };

  // Form Inputs
  const [newExpense, setNewExpense] = useState({
    amount: 0,
    category: 'other' as Expense['category'],
    description: '',
    order_id: ''
  });

  // Sync Demo Mode changes at render time
  const [prevDemoMode, setPrevDemoMode] = useState(isDemoMode);
  if (isDemoMode !== prevDemoMode) {
    setPrevDemoMode(isDemoMode);
    if (isDemoMode) {
      setExpenses(mockExpenses);
      setOrders(mockOrders);
      setLoading(false);
    }
  }

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      // 1. Load expenses and join orders info
      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .select(`
          *,
          order:operation_orders(customer_name)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (expError) throw expError;

      // 2. Load active/recent orders to allow linking
      const { data: ordData } = await supabase
        .from('operation_orders')
        .select('id, customer_name, status')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (expData) setExpenses(expData as Expense[]);
      if (ordData) setOrders(ordData as Order[]);
    } catch (err) {
      console.error('Error loading expenses data:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (!isDemoMode && tenant) {
      loadData();
    } else if (isDemoMode) {
      setExpenses(mockExpenses);
      setOrders(mockOrders);
      setLoading(false);
    }
  }, [isDemoMode, tenant, loadData]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newExpense.amount <= 0) {
      alert('يرجى إدخال قيمة صحيحة للمصروف');
      return;
    }

    const payload = {
      amount: newExpense.amount,
      category: newExpense.category,
      description: newExpense.description || null,
      order_id: newExpense.order_id ? newExpense.order_id : null
    };

    if (isDemoMode) {
      const selectedOrder = orders.find(o => o.id === payload.order_id);
      const added: Expense = {
        id: `e_${Date.now()}`,
        tenant_id: 't1',
        order_id: payload.order_id,
        amount: payload.amount,
        category: payload.category,
        description: payload.description,
        created_at: new Date().toISOString(),
        order: selectedOrder ? { customer_name: selectedOrder.customer_name } : undefined
      };
      setExpenses(prev => [added, ...prev]);
    } else {
      if (tenant) {
        const { error } = await supabase.from('expenses').insert({
          tenant_id: tenant.id,
          ...payload
        });

        if (error) {
          alert('حدث خطأ أثناء حفظ المصروف: ' + error.message);
          return;
        }

        await logActivity({
          tenantId: tenant.id,
          action: 'create',
          entityType: 'maintenance',
          entityName: `تسجيل مصروف عام بقيمة ${payload.amount} ${currencySymbol} - ${payload.description || ''}`,
          details: payload
        });

        loadData();
      }
    }

    setNewExpense({
      amount: 0,
      category: 'other',
      description: '',
      order_id: ''
    });
    setShowAddModal(false);
  };

  const handleDeleteExpense = async (expenseId: string, expenseAmount: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل للمصروف نهائياً؟')) return;

    if (isDemoMode) {
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    } else {
      if (tenant) {
        const { error } = await supabase.from('expenses').delete().eq('id', expenseId).eq('tenant_id', tenant.id);
        if (error) {
          alert('فشل حذف المصروف.');
          return;
        }

        await logActivity({
          tenantId: tenant.id,
          action: 'delete',
          entityType: 'maintenance',
          entityName: `حذف سجل مصروف بقيمة ${expenseAmount} ${currencySymbol}`,
          details: { expense_id: expenseId }
        });

        loadData();
      }
    }
  };

  // Calculations
  const totalGeneralExpenses = expenses
    .filter(e => !e.order_id)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalTripExpenses = expenses
    .filter(e => e.order_id)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAllExpenses = totalGeneralExpenses + totalTripExpenses;

  // Category breakdown (ALL expenses combined)
  const categoryTotals: Record<string, number> = { fuel: 0, toll: 0, parking: 0, cleaning: 0, other: 0 };
  expenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  // Filter Logic
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description?.toLowerCase().includes(search.toLowerCase()) || false;
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    return (search === '' || matchesSearch) && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-6 text-right" style={{ direction: 'rtl' }}>
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-emerald-400" />
            المصاريف والنثريات العامة والتشغيلية
          </h2>
          <p className="text-slate-400 text-xs mt-1">تتبع كافة التكاليف والمصروفات الإدارية للمكتب والمصروفات النثرية لرحلات التشغيل</p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          تسجيل مصروف جديد
        </Button>
      </header>

      {/* METRICS CARDS - 5 cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* General */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-400">مصاريف إدارية</CardTitle>
            <div className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-slate-100 flex items-baseline gap-1">
              {totalGeneralExpenses.toLocaleString()}
              <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">بدون ارتباط برحلة</p>
          </CardContent>
        </Card>

        {/* Trip */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-400">نثريات رحلات</CardTitle>
            <div className="p-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-slate-100 flex items-baseline gap-1">
              {totalTripExpenses.toLocaleString()}
              <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">مرتبطة بأوامر تشغيل</p>
          </CardContent>
        </Card>

        {/* Fuel */}
        <Card className="bg-slate-900/60 border-orange-900/30 border backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-orange-400">وقود / بنزين</CardTitle>
            <div className="p-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-400">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-orange-400 flex items-baseline gap-1">
              {categoryTotals.fuel.toLocaleString()}
              <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {totalAllExpenses > 0 ? Math.round((categoryTotals.fuel / totalAllExpenses) * 100) : 0}% من الإجمالي
            </p>
          </CardContent>
        </Card>

        {/* Toll + Parking */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-400">رسوم ومواقف</CardTitle>
            <div className="p-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-blue-400 flex items-baseline gap-1">
              {(categoryTotals.toll + categoryTotals.parking).toLocaleString()}
              <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">طرق سريعة ومواقف سيارات</p>
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="bg-slate-900/60 border-emerald-900/40 border backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-emerald-400">إجمالي المصروفات</CardTitle>
            <div className="p-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-emerald-400 flex items-baseline gap-1">
              {totalAllExpenses.toLocaleString()}
              <span className="text-xs font-normal text-slate-500">{currencySymbol}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">كل مصاريف الفرع</p>
          </CardContent>
        </Card>
      </section>

      {/* FILTER & SEARCH */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="relative">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث في تفاصيل ووصف المصروف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-650 text-right"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">كل الفئات</option>
            <option value="fuel">بنزين / وقود</option>
            <option value="toll">كارتة / طريق</option>
            <option value="parking">مواقف</option>
            <option value="cleaning">غسيل</option>
            <option value="other">مصاريف إدارية / أخرى</option>
          </select>
        </div>
      </section>

      {/* EXPENSES TABLE LIST */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">جاري تحميل سجل المصروفات...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">لا توجد سجلات مصروفات مطابقة للبحث.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs bg-slate-950/20">
                  <th className="py-4 px-6 font-bold">الفئة</th>
                  <th className="py-4 px-6 font-bold">التفاصيل والبيان</th>
                  <th className="py-4 px-6 font-bold">نوع المصروف (الارتباط)</th>
                  <th className="py-4 px-6 font-bold">قيمة المصروف</th>
                  <th className="py-4 px-6 font-bold">التاريخ</th>
                  <th className="py-4 px-6 font-bold text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="text-slate-300 hover:bg-slate-950/10 transition-all">
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          exp.category === 'fuel'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : exp.category === 'toll'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : exp.category === 'cleaning'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {exp.category === 'fuel' && 'وقود / بنزين'}
                        {exp.category === 'toll' && 'طريق / كارتة'}
                        {exp.category === 'parking' && 'مواقف'}
                        {exp.category === 'cleaning' && 'غسيل'}
                        {exp.category === 'other' && 'مصروفات أخرى'}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-200 max-w-xs truncate">
                      {exp.description || '—'}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {exp.order_id ? (
                        <span className="text-amber-450 font-semibold">
                          رحلة تشغيل: {exp.order?.customer_name || 'عميل مسجل'}
                        </span>
                      ) : (
                        <span className="text-slate-500">مصروف إداري عام للمكتب</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-100">
                      {exp.amount.toLocaleString()} {currencySymbol}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                      {new Date(exp.created_at).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-4 px-6 text-left flex gap-1.5 justify-end">
                      <button
                        onClick={() => handleOpenEditModal(exp)}
                        className="text-emerald-450 hover:text-emerald-400 p-1.5 hover:bg-emerald-500/5 rounded-lg transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id, exp.amount)}
                        className="text-red-450 hover:text-red-400 p-1.5 hover:bg-red-500/5 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* EDIT EXPENSE MODAL */}
      {showEditModal && selectedExpenseToEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative text-right" style={{ direction: 'rtl' }}>
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedExpenseToEdit(null);
              }}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                تعديل بيانات المصروف
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                تعديل تفاصيل وقيمة المصروف في قاعدة البيانات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateExpense} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">فئة المصروفات</label>
                  <select
                    required
                    value={editExpenseState.category}
                    onChange={(e) => setEditExpenseState(prev => ({ ...prev, category: e.target.value as Expense['category'] }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="other">مصاريف إدارية / أخرى (رواتب، إيجار، إلخ)</option>
                    <option value="fuel">وقود / بنزين</option>
                    <option value="toll">طريق / كارتة</option>
                    <option value="parking">مواقف</option>
                    <option value="cleaning">غسيل</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">قيمة المصروف ({currencySymbol})</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editExpenseState.amount || ''}
                    onChange={(e) => setEditExpenseState(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">الارتباط بعقد تشغيل (اختياري)</label>
                  <select
                    value={editExpenseState.order_id}
                    onChange={(e) => setEditExpenseState(prev => ({ ...prev, order_id: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="">-- مصروف عام للمكتب (غير مرتبطة برحلة) --</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        عقد العميل: {o.customer_name} ({o.status === 'active' ? 'نشط بالخارج' : 'مغلق'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">تفاصيل وبيان المصروف</label>
                  <textarea
                    required
                    value={editExpenseState.description}
                    onChange={(e) => setEditExpenseState(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none min-h-16"
                  />
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  حفظ التعديلات
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
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
                <Receipt className="w-5 h-5 text-emerald-400" />
                سجل مصروف ونثريات جديدة
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل تكاليف الصرف الإداري العام أو النثريات الخاصة بفرعك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">فئة المصروفات</label>
                  <select
                    required
                    value={newExpense.category}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value as Expense['category'] }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="other">مصاريف إدارية / أخرى (رواتب، إيجار، إلخ)</option>
                    <option value="fuel">وقود / بنزين</option>
                    <option value="toll">طريق / كارتة</option>
                    <option value="parking">مواقف</option>
                    <option value="cleaning">غسيل</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">قيمة المصروف ({currencySymbol})</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={newExpense.amount || ''}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none text-right"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">الارتباط بعقد تشغيل (اختياري)</label>
                  <select
                    value={newExpense.order_id}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, order_id: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="">-- مصروف عام للمكتب (غير مرتبطة برحلة) --</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        عقد العميل: {o.customer_name} ({o.status === 'active' ? 'نشط بالخارج' : 'مغلق'})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    اربط هذا البند بعقد محدد ليتم إدراجه تلقائياً في حسابات وتصفية تلك الرحلة
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">تفاصيل وبيان المصروف</label>
                  <textarea
                    required
                    placeholder="مثال: فاتورة الكهرباء، إيجار المكتب لشهر يوليو، إلخ..."
                    value={newExpense.description}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none min-h-16"
                  />
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تسجيل المصروف
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
