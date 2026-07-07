'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Car,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Plus,
  X,
  TrendingUp,
  Clock,
  ArrowRightLeft,
  User,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  current_mileage: number;
  status: 'available' | 'in_operation' | 'maintenance';
  external_supplier?: string | null;
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
  { id: 'v4', plate_number: 'ق ر س 3456', model: 'نيسان صني 2021', current_mileage: 95400, status: 'maintenance', external_supplier: 'مكتب الوفاق' },
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

import { useTenant } from '@/lib/context/TenantContext';
import { useRouter } from 'next/navigation';
import { logActivity } from '@/lib/utils/audit';

export default function Dashboard() {
  const { tenant, isDemoMode, currencySymbol } = useTenant();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<OperationOrder[]>([]);

  // Forms states
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedOrderToSettle, setSelectedOrderToSettle] = useState<OperationOrder | null>(null);

  // Form inputs
  const [newOrder, setNewOrder] = useState({
    vehicle_id: '',
    driver_id: '',
    customer_name: '',
    customer_phone: '',
    expected_out_date: '',
    expected_return_date: '',
    out_mileage: 0
  });

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

  const loadLiveSupabaseData = useCallback(async () => {
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

  // Load data depending on mode
  useEffect(() => {
    if (!isDemoMode && tenant) {
      loadLiveSupabaseData();
    }
  }, [isDemoMode, tenant, loadLiveSupabaseData]);

  // Realtime updates subscription
  useEffect(() => {
    if (isDemoMode || !tenant) return;

    const channel = supabase
      .channel('operations_sync_dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operation_orders', filter: `tenant_id=eq.${tenant.id}` }, () => {
        loadLiveSupabaseData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `tenant_id=eq.${tenant.id}` }, () => {
        loadLiveSupabaseData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDemoMode, tenant, loadLiveSupabaseData]);

  // Metrics calculations
  const activeVehiclesCount = vehicles.filter(v => v.status === 'in_operation').length;
  const availableVehiclesCount = vehicles.filter(v => v.status === 'available').length;
  const maintenanceVehiclesCount = vehicles.filter(v => v.status === 'maintenance').length;
  const totalNetProfit = orders
    .filter(o => o.status === 'closed')
    .reduce((sum, o) => sum + o.net_profit, 0);

  // Form Handlers
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
      const newId = `o_${Date.now()}`;
      const selectedVehicle = vehicles.find(v => v.id === newOrder.vehicle_id);
      const selectedDriver = drivers.find(d => d.id === newOrder.driver_id);

      const created: OperationOrder = {
        id: newId,
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
        await supabase.from('vehicles').update({ status: 'in_operation' }).eq('id', newOrder.vehicle_id);
        await supabase.from('drivers').update({ status: 'in_operation' }).eq('id', newOrder.driver_id);

        const vehicle = vehicles.find(v => v.id === newOrder.vehicle_id);
        const driver = drivers.find(d => d.id === newOrder.driver_id);

        await logActivity({
          tenantId: tenant.id,
          action: 'create',
          entityType: 'order',
          entityName: `فتح عقد تشغيل جديد للعميل: ${newOrder.customer_name} (سيارة: ${vehicle?.model || ''}, سائق: ${driver?.name || ''})`,
          details: newOrder
        });

        loadLiveSupabaseData();
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
        }).eq('id', selectedOrderToSettle.id);

        await supabase.from('vehicles').update({ 
          status: 'available', 
          current_mileage: settlement.return_mileage 
        }).eq('id', selectedOrderToSettle.vehicle_id);

        await supabase.from('drivers').update({ 
          status: 'active' 
        }).eq('id', selectedOrderToSettle.driver_id);

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

        await logActivity({
          tenantId: tenant.id,
          action: 'update',
          entityType: 'order',
          entityName: `إغلاق وتسوية عقد تشغيل العميل: ${selectedOrderToSettle.customer_name} (صافي الربح: ${profit} ${currencySymbol})`,
          details: { id: selectedOrderToSettle.id, profit, settlement }
        });

        loadLiveSupabaseData();
      }
    }

    setShowSettleModal(false);
    setSelectedOrderToSettle(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Demo Mode floating ribbon */}
      {isDemoMode && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg animate-pulse shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h4 className="font-bold text-slate-100 text-sm">أنت تتصفح وضع المعاينة (Sandbox Mode)</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                البيانات المعروضة حالياً هي بيانات محاكاة تجريبية. يمكنك تسجيل حساب وربط قاعدة بيانات سحابية حية لبدء التشغيل الفعلي.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/signup')}
            className="bg-amber-450 hover:bg-amber-550 text-slate-950 font-bold px-4 py-2 text-xs rounded-xl shadow-lg shadow-amber-400/10 shrink-0"
          >
            <Plus className="w-4 h-4 ml-1.5 text-slate-950" />
            ربط قاعدة بيانات حية / إنشاء حساب
          </Button>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-emerald-400" />
            لوحة الإحصائيات المركزية
          </h2>
          <p className="text-slate-400 text-xs mt-1">المراقبة العامة لأوامر تشغيل وحركة السيارات وأرباح المكتب</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {isDemoMode && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1 px-3 py-1 flex items-center">
              <AlertCircle className="w-3.5 h-3.5" />
              بيانات محاكاة نشطة
            </Badge>
          )}
          <Button
            onClick={() => setShowNewOrderModal(true)}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5 shadow-lg shadow-emerald-500/15"
          >
            <Plus className="w-5 h-5 text-slate-950" />
            أمر تشغيل سريع
          </Button>
        </div>
      </header>

      {/* METRICS CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">السيارات بالخارج الآن</CardTitle>
            <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
              <Car className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight">{activeVehiclesCount}</div>
            <p className="text-xs text-slate-500 mt-1">سيارات قيد التشغيل في الشارع حالياً</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">السيارات المتاحة بالجراج</CardTitle>
            <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight">{availableVehiclesCount}</div>
            <p className="text-xs text-slate-500 mt-1">جاهزة ومعدة للتسليم الفوري للعملاء</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">السيارات في الصيانة</CardTitle>
            <div className="p-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight">{maintenanceVehiclesCount}</div>
            <p className="text-xs text-slate-500 mt-1">تخضع للفحص الفني أو الصيانة الدورية</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-slate-400">صافي الأرباح المحققة</CardTitle>
            <div className="p-2 rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight flex items-baseline gap-1">
              {totalNetProfit.toLocaleString()}
              <span className="text-sm font-normal text-slate-500">{currencySymbol}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">مجموع صافي الربح لأوامر التشغيل المغلقة</p>
          </CardContent>
        </Card>
      </section>

      {/* OPERATIONS WORKFLOW */}
      <section className="grid grid-cols-1 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              جدول حركة أوامر التشغيل اللحظي (Live Operations)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              مراقبة حركة السيارات وتحديث الأرقام لحظة بلحظة مع العملاء والموردين
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-slate-200">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">معلومات السيارة / اللوحة</th>
                    <th className="px-6 py-4">السائق المكلف</th>
                    <th className="px-6 py-4">العميل والجوال</th>
                    <th className="px-6 py-4">قراءة العداد</th>
                    <th className="px-6 py-4">الخروج / العودة</th>
                    <th className="px-6 py-4">الحالة</th>
                    <th className="px-6 py-4">صافي الربح</th>
                    <th className="px-6 py-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200">{order.vehicle?.model}</div>
                        <div className="text-xs text-emerald-400 mt-0.5">{order.vehicle?.plate_number}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{order.driver?.name}</td>
                      <td className="px-6 py-4">
                        <div className="text-slate-200 font-medium">{order.customer_name}</div>
                        <div className="text-xs text-slate-400">{order.customer_phone}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <div>خروج: {order.out_mileage} كم</div>
                        {order.return_mileage && <div>عودة: {order.return_mileage} كم</div>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        <div>متوقع عودة: {new Date(order.expected_return_date).toLocaleDateString('ar-EG')}</div>
                        {order.actual_return_date && (
                          <div className="text-emerald-500">فعلي: {new Date(order.actual_return_date).toLocaleDateString('ar-EG')}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {order.status === 'active' && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                            بالخارج الآن
                          </Badge>
                        )}
                        {order.status === 'closed' && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            في الجراج (مغلق)
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-200">
                        {order.status === 'closed' ? `${order.net_profit} ${currencySymbol}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {order.status === 'active' && (
                          <Button
                            onClick={() => handleOpenSettleModal(order)}
                            size="sm"
                            className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20"
                          >
                            إغلاق وتسوية مالية
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="grid grid-cols-1 md:hidden gap-4 p-4">
              {orders.map((order) => (
                <div key={order.id} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                    <div>
                      <div className="font-semibold text-slate-200 text-sm">{order.vehicle?.model}</div>
                      <div className="text-xs text-emerald-400 mt-0.5">{order.vehicle?.plate_number}</div>
                    </div>
                    {order.status === 'active' ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                        بالخارج
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        مغلق
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>السائق: {order.driver?.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                    <span>العميل: {order.customer_name} ({order.customer_phone})</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 p-2 rounded-lg justify-between">
                    <div>عداد الخروج: {order.out_mileage} كم</div>
                    {order.return_mileage && <div>عداد العودة: {order.return_mileage} كم</div>}
                  </div>

                  {order.status === 'closed' && (
                    <div className="flex justify-between items-center border-t border-slate-900 pt-2 text-xs text-slate-400">
                      <span>صافي أرباح المكتب:</span>
                      <span className="font-bold text-emerald-400 text-sm">{order.net_profit} {currencySymbol}</span>
                    </div>
                  )}

                  {order.status === 'active' && (
                    <Button
                      onClick={() => handleOpenSettleModal(order)}
                      size="sm"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 mt-2"
                    >
                      إغلاق وتسوية مالية
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* NEW ORDER DRAWER / MODAL */}
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
                <Car className="w-5 h-5 text-emerald-400" />
                أمر تشغيل سريع للسيارة
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل فوري لخروج السيارة وتسليمها للسائق والعميل
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
                    placeholder="مثال: خالد العتيبي"
                    value={newOrder.customer_name}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">رقم جوال العميل</label>
                  <input
                    required
                    type="tel"
                    placeholder="05xxxxxxx"
                    value={newOrder.customer_phone}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, customer_phone: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 text-left"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">عداد الخروج الحالي</label>
                    <input
                      readOnly
                      type="number"
                      value={newOrder.out_mileage}
                      className="bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ العودة المتوقع</label>
                    <input
                      required
                      type="datetime-local"
                      value={newOrder.expected_return_date}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, expected_return_date: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تأكيد الخروج وتسجيل الإذن
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
                إغلاق وتسوية مالية لأمر التشغيل
              </CardTitle>
              <CardDescription className="text-slate-400">
                أدخل قراءات عداد العودة، والمصروفات، والمبالغ المستلمة
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
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">المبلغ المستلم من العميل</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={settlement.amount_received}
                      onChange={(e) => setSettlement(prev => ({ ...prev, amount_received: parseFloat(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* EXPENSES SUB-SECTION */}
                <div className="border-t border-slate-800 pt-3">
                  <label className="text-sm font-bold text-slate-300 block mb-2">المصاريف النثرية أثناء الرحلة</label>

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
                        <option value="toll">كارتة / طريق</option>
                        <option value="parking">مواقف</option>
                        <option value="cleaning">غسيل</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400">القيمة ({currencySymbol})</span>
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
                      أضف مصروف
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
                  <span className="text-emerald-400">
                    {(
                      settlement.amount_received -
                      settlement.amount_paid_supplier -
                      settlement.expenses.reduce((sum, e) => sum + e.amount, 0)
                    ).toLocaleString()}{' '}
                    {currencySymbol}
                  </span>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تسوية وإغلاق الطلب نهائياً
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
