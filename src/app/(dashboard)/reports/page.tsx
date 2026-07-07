'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Car,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  AlertTriangle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Receipt
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
}

interface OperationOrder {
  id: string;
  vehicle_id: string;
  customer_name: string;
  expected_out_date: string;
  actual_out_date: string | null;
  amount_received_from_customer: number;
  amount_paid_to_external_supplier: number;
  net_profit: number;
  status: string;
}

interface Expense {
  id: string;
  order_id: string | null;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
}

interface Violation {
  id: string;
  amount: number;
  status: string;
  vehicle_id: string;
  violation_date: string;
}

export default function ReportsPage() {
  const { tenant, currencySymbol } = useTenant();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<OperationOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab State: 'dashboard' | 'monthly' | 'daily' | 'vehicle'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'daily' | 'vehicle'>('dashboard');

  // Filter States
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [dailyStartDate, setDailyStartDate] = useState<string>(() => {
    const d = new Date();
    // Start of current month
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dailyEndDate, setDailyEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const loadData = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [vRes, oRes, eRes, viRes] = await Promise.all([
        supabase.from('vehicles').select('id, plate_number, model').eq('tenant_id', tenant.id),
        supabase.from('operation_orders').select('id, vehicle_id, customer_name, expected_out_date, actual_out_date, amount_received_from_customer, amount_paid_to_external_supplier, net_profit, status').eq('tenant_id', tenant.id),
        supabase.from('expenses').select('id, order_id, amount, category, description, created_at').eq('tenant_id', tenant.id),
        supabase.from('traffic_violations').select('id, amount, status, vehicle_id, violation_date').eq('tenant_id', tenant.id)
      ]);

      if (vRes.data) {
        setVehicles(vRes.data as Vehicle[]);
        if (vRes.data.length > 0) setSelectedVehicleId(vRes.data[0].id);
      }
      if (oRes.data) setOrders(oRes.data as OperationOrder[]);
      if (eRes.data) setExpenses(eRes.data as Expense[]);
      if (viRes.data) setViolations(viRes.data as Violation[]);

    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenant) {
      loadData();
    }
  }, [tenant, loadData]);

  // ==================== REPORT CALCULATIONS ====================

  // Helper to format date string to month name (e.g. "2026-05" -> "مايو 2026")
  const formatMonthKey = (key: string) => {
    const [year, month] = key.split('-');
    const monthsAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthsAr[mIdx]} ${year}`;
  };

  // 1. Monthly Report Logic
  const getMonthlyReport = () => {
    const reportMap: Record<string, { monthKey: string; revenue: number; orderCosts: number; generalExpenses: number; profit: number; orderCount: number }> = {};

    // Group orders
    orders.forEach(order => {
      const dateStr = order.actual_out_date || order.expected_out_date;
      if (!dateStr) return;
      const monthKey = dateStr.substring(0, 7); // "YYYY-MM"

      if (!reportMap[monthKey]) {
        reportMap[monthKey] = { monthKey, revenue: 0, orderCosts: 0, generalExpenses: 0, profit: 0, orderCount: 0 };
      }
      reportMap[monthKey].revenue += order.amount_received_from_customer;
      reportMap[monthKey].orderCosts += order.amount_paid_to_external_supplier;
      reportMap[monthKey].profit += order.net_profit;
      if (order.status === 'closed' || order.status === 'active') {
        reportMap[monthKey].orderCount += 1;
      }
    });

    // Group general expenses (not linked to an order, or linked - to avoid double counting, general expenses are all expenses)
    expenses.forEach(exp => {
      const dateStr = exp.created_at;
      if (!dateStr) return;
      const monthKey = dateStr.substring(0, 7);

      if (!reportMap[monthKey]) {
        reportMap[monthKey] = { monthKey, revenue: 0, orderCosts: 0, generalExpenses: 0, profit: 0, orderCount: 0 };
      }
      // If order_id is null, it's a general expense.
      // In our net_profit formula on order settlement, we already subtracted order-linked expenses from net_profit, 
      // so general expenses represent general administrative costs.
      if (!exp.order_id) {
        reportMap[monthKey].generalExpenses += exp.amount;
      }
    });

    // Convert map to sorted array (newest month first)
    const sortedReports = Object.values(reportMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    
    // Adjust final profit after general expenses
    return sortedReports.map(r => ({
      ...r,
      finalProfit: r.revenue - r.orderCosts - r.generalExpenses - (r.revenue - r.orderCosts - r.profit)
      // Wait, net profit is already: amount_received - amount_paid_supplier - order_expenses.
      // So final net profit = (sum of net_profit of all orders) - (sum of general expenses).
      // Let's use: final profit = r.profit - r.generalExpenses
    }));
  };

  // 2. Daily Report Logic
  const getDailyReport = () => {
    const reportMap: Record<string, { dateKey: string; revenue: number; orderCosts: number; orderExpenses: number; generalExpenses: number; profit: number; orderCount: number }> = {};

    // Generate date sequence in range
    const start = new Date(dailyStartDate);
    const end = new Date(dailyEndDate);
    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      reportMap[dateStr] = { dateKey: dateStr, revenue: 0, orderCosts: 0, orderExpenses: 0, generalExpenses: 0, profit: 0, orderCount: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    // Populate orders in range
    orders.forEach(order => {
      const dateStr = (order.actual_out_date || order.expected_out_date || '').substring(0, 10);
      if (reportMap[dateStr]) {
        reportMap[dateStr].revenue += order.amount_received_from_customer;
        reportMap[dateStr].orderCosts += order.amount_paid_to_external_supplier;
        reportMap[dateStr].profit += order.net_profit;
        reportMap[dateStr].orderCount += 1;
      }
    });

    // Populate expenses in range
    expenses.forEach(exp => {
      const dateStr = (exp.created_at || '').substring(0, 10);
      if (reportMap[dateStr]) {
        if (exp.order_id) {
          reportMap[dateStr].orderExpenses += exp.amount;
        } else {
          reportMap[dateStr].generalExpenses += exp.amount;
        }
      }
    });

    // Convert map to sorted array (newest date first)
    return Object.values(reportMap)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .map(r => ({
        ...r,
        finalProfit: r.profit - r.generalExpenses
      }));
  };

  // 3. Vehicle Report Logic
  const getVehicleReport = () => {
    const veh = vehicles.find(v => v.id === selectedVehicleId);
    if (!veh) return null;

    const vehOrders = orders.filter(o => o.vehicle_id === selectedVehicleId);
    const vehOrderIds = new Set(vehOrders.map(o => o.id));

    // Calculate metrics
    const totalRuns = vehOrders.length;
    const totalRevenue = vehOrders.reduce((sum, o) => sum + o.amount_received_from_customer, 0);
    const totalSupplierCosts = vehOrders.reduce((sum, o) => sum + o.amount_paid_to_external_supplier, 0);
    const orderProfit = vehOrders.reduce((sum, o) => sum + o.net_profit, 0);

    // Filter expenses linked to this vehicle's orders
    const vehExpenses = expenses.filter(e => e.order_id && vehOrderIds.has(e.order_id));
    const totalExpenses = vehExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Expenses categorized
    const expensesByCategory: Record<string, number> = { fuel: 0, cleaning: 0, parking: 0, toll: 0, other: 0 };
    vehExpenses.forEach(e => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    });

    // Filter violations linked to this vehicle
    const vehViolations = violations.filter(vi => vi.vehicle_id === selectedVehicleId);
    const pendingViolationsAmount = vehViolations.filter(vi => vi.status === 'pending').reduce((sum, vi) => sum + vi.amount, 0);
    const paidViolationsAmount = vehViolations.filter(vi => vi.status === 'paid').reduce((sum, vi) => sum + vi.amount, 0);

    const netProfit = orderProfit - pendingViolationsAmount; // Subtract pending violations from final profit

    return {
      vehicle: veh,
      totalRuns,
      totalRevenue,
      totalSupplierCosts,
      totalExpenses,
      expensesByCategory,
      pendingViolationsAmount,
      paidViolationsAmount,
      totalViolations: pendingViolationsAmount + paidViolationsAmount,
      netProfit
    };
  };

  // 4. Interactive Dashboard Metrics
  const getDashboardData = () => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount_received_from_customer, 0);
    const totalSupplierCosts = orders.reduce((sum, o) => sum + o.amount_paid_to_external_supplier, 0);
    const totalGeneralExpenses = expenses.filter(e => !e.order_id).reduce((sum, e) => sum + e.amount, 0);
    const totalTripExpenses = expenses.filter(e => e.order_id).reduce((sum, e) => sum + e.amount, 0);
    
    // Net profit of orders minus general administrative expenses
    const orderNetProfit = orders.reduce((sum, o) => sum + o.net_profit, 0);
    const netProfit = orderNetProfit - totalGeneralExpenses;
    
    // Profit margin percentage
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    
    // Outstanding violations
    const pendingViolations = violations.filter(v => v.status === 'pending').reduce((sum, v) => sum + v.amount, 0);
    
    // Active orders vs closed orders
    const activeOrdersCount = orders.filter(o => o.status === 'active').length;
    const closedOrdersCount = orders.filter(o => o.status === 'closed').length;
    
    // Average order value
    const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
    
    // Top Vehicles by net profit
    const vehicleProfitMap: Record<string, { vehicle: Vehicle; revenue: number; profit: number; runs: number }> = {};
    orders.forEach(order => {
      const vId = order.vehicle_id;
      if (!vId) return;
      const vehicleObj = vehicles.find(v => v.id === vId);
      if (!vehicleObj) return;
      
      if (!vehicleProfitMap[vId]) {
        vehicleProfitMap[vId] = { vehicle: vehicleObj, revenue: 0, profit: 0, runs: 0 };
      }
      vehicleProfitMap[vId].revenue += order.amount_received_from_customer;
      vehicleProfitMap[vId].profit += order.net_profit;
      vehicleProfitMap[vId].runs += 1;
    });
    
    const topVehicles = Object.values(vehicleProfitMap)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5); // top 5
      
    // Expense categories summary
    const expenseCats: Record<string, number> = { fuel: 0, toll: 0, parking: 0, cleaning: 0, other: 0 };
    expenses.forEach(e => {
      expenseCats[e.category] = (expenseCats[e.category] || 0) + e.amount;
    });
    
    return {
      totalRevenue,
      netProfit,
      profitMargin,
      pendingViolations,
      activeOrdersCount,
      closedOrdersCount,
      avgOrderValue,
      topVehicles,
      expenseCats
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100" style={{ direction: 'rtl' }}>
        <div className="text-center flex flex-col gap-2">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <span className="text-xs text-slate-500 mt-2">جاري تحميل التقارير الحسابية...</span>
        </div>
      </div>
    );
  }

  const monthlyReportData = getMonthlyReport();
  const dailyReportData = getDailyReport();
  const vehicleReportData = getVehicleReport();
  const dashboardData = getDashboardData();

  return (
    <div className="space-y-6 text-right" style={{ direction: 'rtl' }}>
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            التقارير الحسابية والمالية
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            مراجعة الأرباح والإيرادات والمصروفات بشكل دوري مفصل
          </p>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-850 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'dashboard'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          اللوحة التفاعلية (Dashboard)
        </button>

        <button
          onClick={() => setActiveTab('monthly')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'monthly'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          تقرير الأرباح الشهري
        </button>

        <button
          onClick={() => setActiveTab('daily')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'daily'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          التقرير اليومي للحركات
        </button>

        <button
          onClick={() => setActiveTab('vehicle')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 ${
            activeTab === 'vehicle'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Car className="w-4 h-4" />
          تقارير تشغيل السيارات
        </button>
      </div>


      {/* TAB: DASHBOARD */}
      {activeTab === 'dashboard' && dashboardData && (
        <div className="space-y-6">
          {/* Main Visual Cinematic Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cinematic Radial Margin Ring Card */}
            <Card className="lg:col-span-1 bg-slate-900/60 border-slate-800 backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.06)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-all duration-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-400">هامش الأرباح الصافية</CardTitle>
                <CardDescription className="text-[10px] text-slate-500">نسبة الربح الفعلي مقارنة بالإيرادات</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pt-2 pb-6">
                {/* Custom Cinematic SVG Donut Chart */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-slate-850"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-emerald-500 transition-all duration-1000 ease-out"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - dashboardData.profitMargin / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">
                      %{dashboardData.profitMargin}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5">هامش الربح</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-6 border-t border-slate-850/60 pt-4 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block">إجمالي الإيرادات</span>
                    <span className="text-xs font-bold text-slate-350 mt-1 block font-mono">
                      {dashboardData.totalRevenue.toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">صافي الأرباح</span>
                    <span className="text-xs font-bold text-emerald-450 mt-1 block font-mono">
                      {dashboardData.netProfit.toLocaleString()} {currencySymbol}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Metrics Carousel / Cinematic Grid */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 group">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs text-slate-500">متوسط قيمة التشغيلية</span>
                      <h3 className="text-2xl font-black text-slate-100 mt-1 font-mono">
                        {dashboardData.avgOrderValue.toLocaleString()} {currencySymbol}
                      </h3>
                      <p className="text-[9px] text-slate-500 mt-1">متوسط العائد لكل رحلة إيجار</p>
                    </div>
                    <div className="p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-450 group-hover:scale-105 transition-all">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 group">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs text-slate-500">المخالفات المعلقة بالذمة</span>
                      <h3 className="text-2xl font-black text-rose-400 mt-1 font-mono">
                        {dashboardData.pendingViolations.toLocaleString()} {currencySymbol}
                      </h3>
                      <p className="text-[9px] text-slate-500 mt-1">إجمالي غرامات معلقة بانتظار التحصيل</p>
                    </div>
                    <div className="p-3 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-455 group-hover:scale-105 transition-all">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 group">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs text-slate-500">السيارات قيد التشغيل حالياً</span>
                      <h3 className="text-2xl font-black text-sky-400 mt-1 font-mono">
                        {dashboardData.activeOrdersCount} سيارة
                      </h3>
                      <p className="text-[9px] text-slate-500 mt-1">عدد العقود النشطة بالخارج</p>
                    </div>
                    <div className="p-3 rounded-xl border border-sky-500/10 bg-sky-500/5 text-sky-400 group-hover:scale-105 transition-all">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500 group">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs text-slate-500">معدل تشغيل الأسطول</span>
                      <h3 className="text-2xl font-black text-indigo-400 mt-1 font-mono">
                        {orders.length > 0 ? Math.round((dashboardData.activeOrdersCount / (vehicles.length || 1)) * 100) : 0}%
                      </h3>
                      <p className="text-[9px] text-slate-500 mt-1">نسبة السيارات المستغلة من الأسطول</p>
                    </div>
                    <div className="p-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-indigo-400 group-hover:scale-105 transition-all">
                      <Car className="w-5 h-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Cinematic charts / breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Vehicles Performance */}
            <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-400" />
                  أعلى 5 سيارات تحقيقاً للأرباح الصافية
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500">مقارنة العائد الصافي والنشاط التشغيلي للسيارات الأكثر ربحية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData.topVehicles.length === 0 ? (
                  <div className="text-center py-6 text-slate-550 text-xs">لا توجد حركات تشغيل مسجلة للسيارات.</div>
                ) : (
                  dashboardData.topVehicles.map((item, idx) => {
                    const maxProfit = dashboardData.topVehicles[0]?.profit || 1;
                    const percent = Math.round((item.profit / maxProfit) * 100);
                    return (
                      <div key={item.vehicle.id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-200">
                            {idx + 1}. {item.vehicle.model} <span className="text-[10px] text-slate-500 font-mono">({item.vehicle.plate_number})</span>
                          </span>
                          <span className="font-bold text-emerald-450 font-mono">
                            {item.profit.toLocaleString()} {currencySymbol}
                            <span className="text-[9px] text-slate-500 font-normal mr-1.5">({item.runs} رحلة)</span>
                          </span>
                        </div>
                        {/* Custom visual progress bar with glow */}
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative border border-slate-850/50">
                          <div
                            className="absolute top-0 right-0 h-full bg-gradient-to-l from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Expense Distribution breakdown */}
            <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  تصنيف وهيكل نفقات الفرع
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500">توزيع المصاريف العامة والتشغيلية المخصومة حسب كل فئة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.values(dashboardData.expenseCats).every(v => v === 0) ? (
                  <div className="text-center py-6 text-slate-550 text-xs">لا توجد نفقات مسجلة حالياً.</div>
                ) : (
                  (() => {
                    const totalExps = Object.values(dashboardData.expenseCats).reduce((a, b) => a + b, 0) || 1;
                    const categories = [
                      { key: 'fuel', label: 'وقود / بنزين', color: 'from-amber-500 to-yellow-400' },
                      { key: 'toll', label: 'رسوم طريق / كارتة', color: 'from-blue-500 to-sky-400' },
                      { key: 'parking', label: 'مواقف وجراج', color: 'from-purple-500 to-violet-400' },
                      { key: 'cleaning', label: 'غسيل ونظافة', color: 'from-emerald-500 to-teal-400' },
                      { key: 'other', label: 'نثريات وإداريات أخرى', color: 'from-slate-500 to-slate-400' }
                    ];

                    return categories.map(cat => {
                      const amount = dashboardData.expenseCats[cat.key] || 0;
                      const percent = Math.round((amount / totalExps) * 100);
                      return (
                        <div key={cat.key} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-250">{cat.label}</span>
                            <span className="font-bold text-slate-200 font-mono">
                              {amount.toLocaleString()} {currencySymbol}
                              <span className="text-[9px] text-slate-500 font-normal mr-1.5">({percent}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative border border-slate-850/50">
                            <div
                              className={`absolute top-0 right-0 h-full bg-gradient-to-l ${cat.color} rounded-full transition-all duration-1000`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* MONTHLY REPORT CONTENT */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Summary Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-450">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-slate-500">إجمالي الإيرادات التاريخية</span>
                    <h3 className="text-2xl font-black text-slate-100 mt-1">
                      {orders.reduce((sum, o) => sum + o.amount_received_from_customer, 0).toLocaleString()} {currencySymbol}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
                    <ArrowDownRight className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-slate-500">إجمالي المصاريف والموردين</span>
                    <h3 className="text-2xl font-black text-slate-100 mt-1">
                      {(
                        orders.reduce((sum, o) => sum + o.amount_paid_to_external_supplier, 0) +
                        expenses.reduce((sum, e) => sum + e.amount, 0)
                      ).toLocaleString()} {currencySymbol}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-slate-500">إجمالي صافي الأرباح</span>
                    <h3 className="text-2xl font-black text-emerald-400 mt-1">
                      {(
                        orders.reduce((sum, o) => sum + o.net_profit, 0) -
                        expenses.filter(e => !e.order_id).reduce((sum, e) => sum + e.amount, 0)
                      ).toLocaleString()} {currencySymbol}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Table */}
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-100">الأرباح الشهرية المفصلة</CardTitle>
              <CardDescription className="text-slate-400 text-xs">مقارنة الإيرادات بالمصاريف والأرباح لكل شهر بشكل تنازلي</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyReportData.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">لا توجد بيانات مسجلة لحساب الأرباح الشهرية.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="pb-3 pt-2 px-4 font-bold">الشهر</th>
                        <th className="pb-3 pt-2 px-4 font-bold">عدد الرحلات</th>
                        <th className="pb-3 pt-2 px-4 font-bold">إجمالي الإيراد من العملاء</th>
                        <th className="pb-3 pt-2 px-4 font-bold">حساب ملاك السيارات والموردين</th>
                        <th className="pb-3 pt-2 px-4 font-bold">نثريات ومصاريف إدارية</th>
                        <th className="pb-3 pt-2 px-4 font-bold text-left">صافي الأرباح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {monthlyReportData.map((row) => (
                        <tr key={row.monthKey} className="text-slate-350 hover:bg-slate-950/20 transition-all">
                          <td className="py-4 px-4 font-bold text-slate-200">{formatMonthKey(row.monthKey)}</td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className="bg-slate-950 border-slate-850 text-slate-400">{row.orderCount} رحلة</Badge>
                          </td>
                          <td className="py-4 px-4 text-emerald-400 font-mono">+{row.revenue.toLocaleString()} {currencySymbol}</td>
                          <td className="py-4 px-4 text-rose-400/80 font-mono">-{row.orderCosts.toLocaleString()} {currencySymbol}</td>
                          <td className="py-4 px-4 text-amber-500/80 font-mono">-{row.generalExpenses.toLocaleString()} {currencySymbol}</td>
                          <td className="py-4 px-4 text-left font-black text-emerald-450 font-mono">
                            {(row.profit - row.generalExpenses).toLocaleString()} {currencySymbol}
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

      {/* DAILY REPORT CONTENT */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="bg-slate-900/40 border-slate-800/80 p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-emerald-400" />
                تصفية المدى الزمني للتقرير اليومي:
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={dailyStartDate}
                  onChange={(e) => setDailyStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                />
                <span className="text-slate-500 text-xs">إلى</span>
                <input
                  type="date"
                  value={dailyEndDate}
                  onChange={(e) => setDailyEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          {/* Daily Table */}
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-100">سجل النشاط اليومي المالي</CardTitle>
              <CardDescription className="text-slate-400 text-xs">مراجعة الإيرادات والمصاريف اليومية بالتفصيل</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyReportData.filter(r => r.revenue > 0 || r.orderCosts > 0 || r.generalExpenses > 0 || r.orderExpenses > 0).length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">لا توجد حركات تشغيل أو مصروفات مسجلة في هذا المدى الزمني.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="pb-3 pt-2 px-4 font-bold">التاريخ</th>
                        <th className="pb-3 pt-2 px-4 font-bold">عدد الرحلات البدأت</th>
                        <th className="pb-3 pt-2 px-4 font-bold">إجمالي الإيرادات اليومية</th>
                        <th className="pb-3 pt-2 px-4 font-bold">مصاريف التشغيل والملاك</th>
                        <th className="pb-3 pt-2 px-4 font-bold">المصاريف النثرية والإدارية</th>
                        <th className="pb-3 pt-2 px-4 font-bold text-left">صافي أرباح اليوم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {dailyReportData.filter(r => r.revenue > 0 || r.orderCosts > 0 || r.generalExpenses > 0 || r.orderExpenses > 0).map((row) => (
                        <tr key={row.dateKey} className="text-slate-350 hover:bg-slate-950/20 transition-all">
                          <td className="py-4 px-4 font-bold text-slate-200">
                            {new Date(row.dateKey).toLocaleDateString('ar-EG', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className="bg-slate-950 border-slate-850 text-slate-400">{row.orderCount} رحلة</Badge>
                          </td>
                          <td className="py-4 px-4 text-emerald-400 font-mono">+{row.revenue.toLocaleString()} {currencySymbol}</td>
                          <td className="py-4 px-4 text-rose-400/80 font-mono">-{row.orderCosts.toLocaleString()} {currencySymbol}</td>
                          <td className="py-4 px-4 text-amber-500/80 font-mono">-{(row.generalExpenses + row.orderExpenses).toLocaleString()} {currencySymbol}</td>
                          <td className="py-4 px-4 text-left font-black text-emerald-450 font-mono">
                            {row.finalProfit.toLocaleString()} {currencySymbol}
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

      {/* VEHICLE REPORT CONTENT */}
      {activeTab === 'vehicle' && (
        <div className="space-y-6">
          {/* Select Vehicle Filter */}
          <Card className="bg-slate-900/40 border-slate-800/80 p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-emerald-400" />
                اختر السيارة لعرض تقرير أدائها المالي:
              </span>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none w-full sm:max-w-xs"
              >
                <option value="">-- حدد سيارة --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.model} - {v.plate_number}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* Vehicle Report Details */}
          {vehicleReportData ? (
            <div className="space-y-6">
              {/* Cards Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardContent className="pt-6">
                    <span className="text-xs text-slate-500 block">إجمالي الرحلات</span>
                    <h3 className="text-xl font-black text-slate-100 mt-1.5 flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      {vehicleReportData.totalRuns} رحلات تشغيل
                    </h3>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800">
                  <CardContent className="pt-6">
                    <span className="text-xs text-slate-500 block">إجمالي الإيرادات</span>
                    <h3 className="text-xl font-black text-emerald-400 mt-1.5">
                      +{vehicleReportData.totalRevenue.toLocaleString()} {currencySymbol}
                    </h3>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800">
                  <CardContent className="pt-6">
                    <span className="text-xs text-slate-500 block">إجمالي المصاريف والموردين</span>
                    <h3 className="text-xl font-black text-rose-450 mt-1.5">
                      -{(vehicleReportData.totalSupplierCosts + vehicleReportData.totalExpenses).toLocaleString()} {currencySymbol}
                    </h3>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/60 border-slate-800">
                  <CardContent className="pt-6">
                    <span className="text-xs text-slate-500 block">صافي الربح الفعلي للسيارة</span>
                    <h3 className="text-xl font-black text-emerald-450 mt-1.5">
                      {vehicleReportData.netProfit.toLocaleString()} {currencySymbol}
                    </h3>
                  </CardContent>
                </Card>
              </div>

              {/* Expenses Breakdown & Violations Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Expenses Breakdown */}
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-100">تحليل مصاريف ونثريات السيارة</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">تفصيل النفقات المدفوعة على هذه السيارة أثناء تشغيلها</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">مصاريف الوقود / البنزين:</span>
                      <span className="font-bold text-slate-200">{vehicleReportData.expensesByCategory.fuel.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">مصاريف الطرق / الكارتة:</span>
                      <span className="font-bold text-slate-200">{vehicleReportData.expensesByCategory.toll.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">مصاريف غسيل ونظافة السيارة:</span>
                      <span className="font-bold text-slate-200">{vehicleReportData.expensesByCategory.cleaning.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">مصاريف جراج ومواقف:</span>
                      <span className="font-bold text-slate-200">{vehicleReportData.expensesByCategory.parking.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-850 pt-3">
                      <span className="text-slate-400">مصاريف أخرى متنوعة:</span>
                      <span className="font-bold text-slate-200">{vehicleReportData.expensesByCategory.other.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Violations Summary */}
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-100">المخالفات المرورية المسجلة</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">المخالفات المرتبطة بهذه السيارة وحالتها الحسابية</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        مخالفات معلقة غير مسددة (Pending):
                      </span>
                      <span className="font-bold text-rose-400">{vehicleReportData.pendingViolationsAmount.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        مخالفات تم تسويتها وسدادها (Paid):
                      </span>
                      <span className="font-bold text-emerald-400">{vehicleReportData.paidViolationsAmount.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-850 pt-3 font-bold">
                      <span className="text-slate-300">إجمالي قيمة الغرامات التاريخية:</span>
                      <span className="text-slate-200">{vehicleReportData.totalViolations.toLocaleString()} {currencySymbol}</span>
                    </div>

                    {vehicleReportData.pendingViolationsAmount > 0 && (
                      <div className="bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 text-[10px] text-rose-400 flex items-center gap-2 mt-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>يوجد مبالغ مخالفات معلقة على هذه السيارة، يرجى تسويتها في ملف المخالفات.</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">حدد سيارة من القائمة لعرض تفاصيل تقريرها الحسابي.</div>
          )}
        </div>
      )}
    </div>
  );
}
