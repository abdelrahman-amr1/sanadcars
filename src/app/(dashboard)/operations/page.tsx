'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Plus,
  Search,
  Filter,
  X,
  Car,
  User,
  Calendar,
  Gauge,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRightLeft
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  current_mileage: number;
  status: 'available' | 'in_operation' | 'maintenance';
}

interface Driver {
  id: string;
  name: string;
  license_number: string;
  status: 'active' | 'inactive' | 'in_operation';
}

interface Expense {
  category: 'fuel' | 'toll' | 'parking' | 'cleaning' | 'other';
  amount: number;
  description: string;
}

interface OperationOrder {
  id: string;
  vehicle_id: string;
  driver_id: string;
  customer_name: string;
  customer_phone: string;
  expected_out_date: string;
  expected_return_date: string;
  actual_out_date?: string | null;
  actual_return_date?: string | null;
  out_mileage: number;
  return_mileage?: number | null;
  status: 'draft' | 'active' | 'pending_settlement' | 'closed';
  amount_received_from_customer: number;
  amount_paid_to_external_supplier: number;
  net_profit: number;
  vehicle?: Vehicle;
  driver?: Driver;
  expenses?: Expense[];
}

const mockVehicles: Vehicle[] = [
  { id: 'v1', plate_number: 'أ ب ج 1234', model: 'هيونداي إلنترا 2023', current_mileage: 45000, status: 'in_operation' },
  { id: 'v2', plate_number: 'د هـ و 5678', model: 'تويوتا كامري 2022', current_mileage: 72100, status: 'available' },
  { id: 'v3', plate_number: 'س ش ص 9012', model: 'كيا سبورتيج 2024', current_mileage: 12000, status: 'available' },
  { id: 'v4', plate_number: 'ق ر س 3456', model: 'نيسان صني 2021', current_mileage: 95400, status: 'maintenance' },
  { id: 'v5', plate_number: 'ط ظ ع 7890', model: 'مازدا 6 2023', current_mileage: 38200, status: 'available' }
];

const mockDrivers: Driver[] = [
  { id: 'd1', name: 'أحمد محمد عبد الله', license_number: 'L123456', status: 'in_operation' },
  { id: 'd2', name: 'خالد وليد العتيبي', license_number: 'L789012', status: 'active' },
  { id: 'd3', name: 'محمد علي الشهري', license_number: 'L345678', status: 'active' }
];

const mockOrders: OperationOrder[] = [
  {
    id: 'o1',
    vehicle_id: 'v1',
    driver_id: 'd1',
    customer_name: 'سليمان بن عبد العزيز',
    customer_phone: '0501234567',
    expected_out_date: '2026-07-01T08:00',
    expected_return_date: '2026-07-03T18:00',
    actual_out_date: '2026-07-01T08:15',
    out_mileage: 45000,
    status: 'active',
    amount_received_from_customer: 500,
    amount_paid_to_external_supplier: 0,
    net_profit: 500,
    vehicle: mockVehicles[0],
    driver: mockDrivers[0],
    expenses: []
  },
  {
    id: 'o2',
    vehicle_id: 'v4',
    driver_id: 'd2',
    customer_name: 'فهد سليم الحربي',
    customer_phone: '0547654321',
    expected_out_date: '2026-06-28T10:00',
    expected_return_date: '2026-06-29T10:00',
    actual_out_date: '2026-06-28T10:05',
    actual_return_date: '2026-06-29T10:30',
    out_mileage: 95100,
    return_mileage: 95400,
    status: 'closed',
    amount_received_from_customer: 300,
    amount_paid_to_external_supplier: 100,
    net_profit: 150,
    vehicle: mockVehicles[3],
    driver: mockDrivers[1],
    expenses: [
      { category: 'fuel', amount: 50, description: 'وقود مكمل' }
    ]
  }
];

export default function OperationsPage() {
  const { tenant, isDemoMode, currencySymbol } = useTenant();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<OperationOrder[]>([]);

  // Modal controls
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedOrderToSettle, setSelectedOrderToSettle] = useState<OperationOrder | null>(null);

  // Filter and search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // New order inputs
  const [newOrder, setNewOrder] = useState({
    vehicle_id: '',
    driver_id: '',
    customer_name: '',
    customer_phone: '',
    expected_out_date: '',
    expected_return_date: '',
    out_mileage: 0
  });

  // Settle inputs
  const [settlement, setSettlement] = useState({
    return_mileage: 0,
    amount_received: 0,
    amount_paid_supplier: 0,
    expenses: [] as Expense[],
    newExpense: { category: 'fuel' as Expense['category'], amount: 0, description: '' }
  });

  // Sync Demo Mode changes at render time
  const [prevDemoMode, setPrevDemoMode] = useState(isDemoMode);
  if (isDemoMode !== prevDemoMode) {
    setPrevDemoMode(isDemoMode);
    if (isDemoMode) {
      setVehicles(mockVehicles);
      setDrivers(mockDrivers);
      setOrders(mockOrders);
    }
  }

  const loadData = useCallback(async () => {
    if (!tenant) return;
    const { data: vData } = await supabase.from('vehicles').select('*').eq('tenant_id', tenant.id);
    const { data: dData } = await supabase.from('drivers').select('*').eq('tenant_id', tenant.id);
    const { data: oData } = await supabase.from('operation_orders').select(`
      *,
      vehicle:vehicles(*),
      driver:drivers(*)
    `).eq('tenant_id', tenant.id).order('created_at', { ascending: false });

    if (vData) setVehicles(vData as Vehicle[]);
    if (dData) setDrivers(dData as Driver[]);
    if (oData) {
      const ordersWithExpenses = await Promise.all(
        oData.map(async (order: { id: string }) => {
          const { data: expData } = await supabase
            .from('expenses')
            .select('*')
            .eq('order_id', order.id);
          return {
            ...order,
            expenses: expData || []
          };
        })
      );
      setOrders(ordersWithExpenses as OperationOrder[]);
    }
  }, [tenant]);

  useEffect(() => {
    if (!isDemoMode && tenant) {
      loadData();
    }
  }, [isDemoMode, tenant, loadData]);

  const handleVehicleChange = (vId: string) => {
    const veh = vehicles.find(v => v.id === vId);
    setNewOrder(prev => ({
      ...prev,
      vehicle_id: vId,
      out_mileage: veh ? veh.current_mileage : 0
    }));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      const selectedVehicle = vehicles.find(v => v.id === newOrder.vehicle_id);
      const selectedDriver = drivers.find(d => d.id === newOrder.driver_id);

      const created: OperationOrder = {
        id: `o_${Date.now()}`,
        vehicle_id: newOrder.vehicle_id,
        driver_id: newOrder.driver_id,
        customer_name: newOrder.customer_name,
        customer_phone: newOrder.customer_phone,
        expected_out_date: newOrder.expected_out_date,
        expected_return_date: newOrder.expected_return_date,
        actual_out_date: new Date().toISOString(),
        out_mileage: newOrder.out_mileage,
        status: 'active',
        amount_received_from_customer: 0,
        amount_paid_to_external_supplier: 0,
        net_profit: 0,
        vehicle: selectedVehicle,
        driver: selectedDriver,
        expenses: []
      };

      setVehicles(prev => prev.map(v => v.id === newOrder.vehicle_id ? { ...v, status: 'in_operation' } : v));
      setDrivers(prev => prev.map(d => d.id === newOrder.driver_id ? { ...d, status: 'in_operation' } : d));
      setOrders(prev => [created, ...prev]);
    } else {
      if (tenant) {
        await supabase.from('operation_orders').insert({
          tenant_id: tenant.id,
          vehicle_id: newOrder.vehicle_id,
          driver_id: newOrder.driver_id,
          customer_name: newOrder.customer_name,
          customer_phone: newOrder.customer_phone,
          expected_out_date: new Date(newOrder.expected_out_date).toISOString(),
          expected_return_date: new Date(newOrder.expected_return_date).toISOString(),
          actual_out_date: new Date().toISOString(),
          out_mileage: newOrder.out_mileage,
          status: 'active'
        });

        // Update vehicle and driver status
        await supabase.from('vehicles').update({ status: 'in_operation' }).eq('id', newOrder.vehicle_id).eq('tenant_id', tenant.id);
        await supabase.from('drivers').update({ status: 'in_operation' }).eq('id', newOrder.driver_id).eq('tenant_id', tenant.id);

        loadData();
      }
    }

    setNewOrder({
      vehicle_id: '',
      driver_id: '',
      customer_name: '',
      customer_phone: '',
      expected_out_date: '',
      expected_return_date: '',
      out_mileage: 0
    });
    setShowNewOrderModal(false);
  };

  const handleOpenSettleModal = (order: OperationOrder) => {
    setSelectedOrderToSettle(order);
    setSettlement({
      return_mileage: order.out_mileage,
      amount_received: 0,
      amount_paid_supplier: 0,
      expenses: [],
      newExpense: { category: 'fuel', amount: 0, description: '' }
    });
    setShowSettleModal(true);
  };

  const handleAddExpense = () => {
    if (settlement.newExpense.amount <= 0) return;
    setSettlement(prev => ({
      ...prev,
      expenses: [...prev.expenses, { ...prev.newExpense }],
      newExpense: { category: 'fuel', amount: 0, description: '' }
    }));
  };

  const handleRemoveExpense = (index: number) => {
    setSettlement(prev => ({
      ...prev,
      expenses: prev.expenses.filter((_, i) => i !== index)
    }));
  };

  const handleSettleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderToSettle) return;

    const totalExpenses = settlement.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = settlement.amount_received - settlement.amount_paid_supplier - totalExpenses;

    if (isDemoMode) {
      setOrders(prev => prev.map(o => {
        if (o.id === selectedOrderToSettle.id) {
          return {
            ...o,
            status: 'closed',
            actual_return_date: new Date().toISOString(),
            return_mileage: settlement.return_mileage,
            amount_received_from_customer: settlement.amount_received,
            amount_paid_to_external_supplier: settlement.amount_paid_supplier,
            net_profit: profit,
            expenses: settlement.expenses
          };
        }
        return o;
      }));

      setVehicles(prev => prev.map(v => v.id === selectedOrderToSettle.vehicle_id ? { ...v, status: 'available', current_mileage: settlement.return_mileage } : v));
      setDrivers(prev => prev.map(d => d.id === selectedOrderToSettle.driver_id ? { ...d, status: 'active' } : d));
    } else {
      if (tenant) {
        await supabase.from('operation_orders').update({
          status: 'closed',
          actual_return_date: new Date().toISOString(),
          return_mileage: settlement.return_mileage,
          amount_received_from_customer: settlement.amount_received,
          amount_paid_to_external_supplier: settlement.amount_paid_supplier,
          net_profit: profit
        }).eq('id', selectedOrderToSettle.id).eq('tenant_id', tenant.id);

        await supabase.from('vehicles').update({ 
          status: 'available', 
          current_mileage: settlement.return_mileage 
        }).eq('id', selectedOrderToSettle.vehicle_id).eq('tenant_id', tenant.id);

        await supabase.from('drivers').update({ 
          status: 'active' 
        }).eq('id', selectedOrderToSettle.driver_id).eq('tenant_id', tenant.id);

        if (settlement.expenses.length > 0) {
          const insertPayload = settlement.expenses.map(exp => ({
            tenant_id: tenant.id,
            order_id: selectedOrderToSettle.id,
            amount: exp.amount,
            category: exp.category,
            description: exp.description
          }));
          await supabase.from('expenses').insert(insertPayload);
        }
        loadData();
      }
    }

    setShowSettleModal(false);
    setSelectedOrderToSettle(null);
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customer_name.toLowerCase().includes(search.toLowerCase()) || 
                          o.vehicle?.model.toLowerCase().includes(search.toLowerCase()) || 
                          o.vehicle?.plate_number.includes(search);
    const matchesFilter = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400" />
            عمليات التشغيل وحركة السيارات
          </h2>
          <p className="text-slate-400 text-xs mt-1">تتبع كافة أذونات وأوامر خروج وعودة سيارات المكتب وتسويتها مالياً</p>
        </div>

        <Button
          onClick={() => setShowNewOrderModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          أمر تشغيل جديد
        </Button>
      </header>

      {/* FILTER & SEARCH */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="relative">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث باسم العميل أو السيارة أو اللوحة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-650"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="active">قيد التشغيل (بالخارج)</option>
            <option value="closed">مغلقة (في الجراج)</option>
          </select>
        </div>
      </section>

      {/* ORDERS LIST */}
      <section className="flex flex-col gap-4">
        {filteredOrders.map((order) => (
          <Card key={order.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-705 transition-all overflow-hidden">
            <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Vehicle & Status info */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-200">{order.vehicle?.model}</span>
                </div>
                <div className="text-xs text-slate-400">رقم اللوحة: <strong className="text-emerald-400">{order.vehicle?.plate_number}</strong></div>
                <div className="mt-2">
                  {order.status === 'active' ? (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/25">نشط (بالخارج)</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25">مغلق وتسوية كاملة</Badge>
                  )}
                </div>
              </div>

              {/* Driver & Customer info */}
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="text-slate-500">العميل والجوال:</div>
                <div className="font-bold text-slate-300">{order.customer_name} ({order.customer_phone})</div>
                <div className="text-slate-500 mt-2">السائق المكلف:</div>
                <div className="font-bold text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  {order.driver?.name}
                </div>
              </div>

              {/* Mileage & Dates */}
              <div className="flex flex-col gap-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>عداد الخروج:</span>
                  <span className="font-bold text-slate-300">{order.out_mileage} كم</span>
                </div>
                {order.return_mileage && (
                  <div className="flex justify-between">
                    <span>عداد العودة:</span>
                    <span className="font-bold text-slate-355">{order.return_mileage} كم</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800/80 pt-1.5 mt-1.5">
                  <span>تاريخ الخروج:</span>
                  <span>{new Date(order.expected_out_date).toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="flex justify-between">
                  <span>تاريخ العودة:</span>
                  <span>{new Date(order.expected_return_date).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>

              {/* Settle Operations & Profit */}
              <div className="flex flex-col justify-between items-end border-r border-slate-800/80 pr-6">
                <div className="text-left w-full">
                  <span className="text-xs text-slate-500 block">صافي ربح الرحلة:</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block">
                    {order.status === 'closed' ? `${order.net_profit} ${currencySymbol}` : 'قيد التشغيل...'}
                  </span>
                </div>

                {order.status === 'active' && (
                  <Button
                    onClick={() => handleOpenSettleModal(order)}
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold gap-1 mt-4"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    تسوية وإغلاق العداد
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* NEW ORDER MODAL */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl relative">
            <button
              onClick={() => setShowNewOrderModal(false)}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                إنشاء أمر حركة وتشغيل
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل بيانات خروج سيارة بالعداد وتعيين السائق والعميل
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrder} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اختر السيارة المتاحة</label>
                  <select
                    required
                    value={newOrder.vehicle_id}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- حدد سيارة --</option>
                    {vehicles.filter(v => v.status === 'available').map(v => (
                      <option key={v.id} value={v.id}>{v.model} - {v.plate_number}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اختر السائق النشط</label>
                  <select
                    required
                    value={newOrder.driver_id}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, driver_id: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- حدد سائق --</option>
                    {drivers.filter(d => d.status === 'active').map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم العميل بالكامل</label>
                  <input
                    required
                    type="text"
                    placeholder="اسم العميل"
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم جوال العميل</label>
                  <input
                    required
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={newOrder.customer_phone}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customer_phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">عداد الخروج الفعلي (كم)</label>
                    <input
                      readOnly
                      type="number"
                      value={newOrder.out_mileage}
                      className="bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-450"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ العودة المتوقع</label>
                    <input
                      required
                      type="datetime-local"
                      value={newOrder.expected_return_date}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, expected_return_date: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تأكيد الخروج وبدء الرحلة
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SETTLE ORDER MODAL */}
      {showSettleModal && selectedOrderToSettle && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-slate-900 border-slate-800 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => {
                setShowSettleModal(false);
                setSelectedOrderToSettle(null);
              }}
              className="absolute top-4 left-4 p-1.5 hover:bg-slate-800 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                إغلاق وتسوية أمر التشغيل
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل قراءة عداد العودة، والمبالغ، والمصاريف النثرية للرحلة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSettleOrder} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">عداد العودة الفعلي (كم)</label>
                    <input
                      required
                      type="number"
                      min={selectedOrderToSettle.out_mileage}
                      value={settlement.return_mileage}
                      onChange={(e) => setSettlement(prev => ({ ...prev, return_mileage: parseInt(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">المبلغ المستلم من العميل ({currencySymbol})</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={settlement.amount_received}
                      onChange={(e) => setSettlement(prev => ({ ...prev, amount_received: parseFloat(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">مبلغ التوريد للمورد الخارجي (إن وجد)</label>
                  <input
                    type="number"
                    min="0"
                    value={settlement.amount_paid_supplier}
                    onChange={(e) => setSettlement(prev => ({ ...prev, amount_paid_supplier: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                </div>

                {/* EXPENSES SUB-SECTION */}
                <div className="border-t border-slate-800 pt-3">
                  <label className="text-sm font-bold text-slate-305 block mb-2">المصاريف النثرية للرحلة (بنزين، كارتة...)</label>

                  <div className="grid grid-cols-3 gap-2 items-end mb-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400">الفئة</span>
                      <select
                        value={settlement.newExpense.category}
                        onChange={(e) => setSettlement(prev => ({
                          ...prev,
                          newExpense: { ...prev.newExpense, category: e.target.value as Expense['category'] }
                        }))}
                        className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="fuel">وقود</option>
                        <option value="toll">طريق / كارتة</option>
                        <option value="parking">مواقف</option>
                        <option value="cleaning">غسيل</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400">المبلغ</span>
                      <input
                        type="number"
                        min="0"
                        value={settlement.newExpense.amount || ''}
                        onChange={(e) => setSettlement(prev => ({
                          ...prev,
                          newExpense: { ...prev.newExpense, amount: parseFloat(e.target.value) || 0 }
                        }))}
                        className="bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={handleAddExpense}
                      size="sm"
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs h-8"
                    >
                      أضف
                    </Button>
                  </div>

                  {settlement.expenses.length > 0 && (
                    <div className="bg-slate-950 p-2 rounded-lg flex flex-col gap-1.5 max-h-24 overflow-y-auto">
                      {settlement.expenses.map((exp, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-slate-300">
                          <span>{exp.category === 'fuel' ? 'وقود' : exp.category === 'toll' ? 'طريق' : 'أخرى'} - {exp.amount} {currencySymbol}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExpense(idx)}
                            className="text-red-400 hover:text-red-500 font-bold"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 text-sm flex justify-between items-center font-bold mt-2">
                  <span>صافي ربح المكتب المتوقع:</span>
                  <span className="text-emerald-400 font-black">
                    {(
                      settlement.amount_received -
                      settlement.amount_paid_supplier -
                      settlement.expenses.reduce((sum, e) => sum + e.amount, 0)
                    ).toLocaleString()}{' '}
                    {currencySymbol}
                  </span>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  إغلاق وتسوية الرحلة
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
