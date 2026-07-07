'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTenant } from '@/lib/context/TenantContext';
import { logActivity } from '@/lib/utils/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wrench,
  Plus,
  X,
  Car,
  Calendar,
  Gauge,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Clock,
  TrendingUp
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  current_mileage: number;
}

interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  mileage_at_maintenance: number;
  description: string;
  cost: number;
  maintenance_date: string;
  next_maintenance_mileage: number;
  is_completed: boolean;
  vehicle?: Vehicle;
}

const mockVehicles: Vehicle[] = [
  { id: 'v1', plate_number: 'أ ب ج 1234', model: 'هيونداي إلنترا 2023', current_mileage: 45000 },
  { id: 'v2', plate_number: 'د هـ و 5678', model: 'تويوتا كامري 2022', current_mileage: 72100 },
  { id: 'v4', plate_number: 'ق ر س 3456', model: 'نيسان صني 2021', current_mileage: 95400 }
];

const mockLogs: MaintenanceLog[] = [
  {
    id: 'm1',
    vehicle_id: 'v4',
    mileage_at_maintenance: 90000,
    description: 'تغيير زيت المحرك وفلتر الهواء، وفحص نظام المكابح بالكامل',
    cost: 250,
    maintenance_date: '2026-06-25',
    next_maintenance_mileage: 95000,
    is_completed: true,
    vehicle: mockVehicles[2]
  },
  {
    id: 'm2',
    vehicle_id: 'v1',
    mileage_at_maintenance: 40000,
    description: 'صيانة دورية وتغيير شمعات الاحتراق والمكابح الأمامية',
    cost: 600,
    maintenance_date: '2026-05-10',
    next_maintenance_mileage: 45000,
    is_completed: true,
    vehicle: mockVehicles[0]
  }
];

export default function MaintenancePage() {
  const { tenant, isDemoMode } = useTenant();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newLog, setNewLog] = useState({
    vehicle_id: '',
    mileage_at_maintenance: 0,
    description: '',
    cost: 0,
    maintenance_date: '',
    next_maintenance_mileage: 0,
    is_completed: true
  });

  // Sync Demo Mode changes at render time
  const [prevDemoMode, setPrevDemoMode] = useState(isDemoMode);
  if (isDemoMode !== prevDemoMode) {
    setPrevDemoMode(isDemoMode);
    if (isDemoMode) {
      setVehicles(mockVehicles);
      setLogs(mockLogs);
    }
  }

  const loadData = useCallback(async () => {
    if (!tenant) return;
    const { data: vData } = await supabase.from('vehicles').select('id, plate_number, model, current_mileage').eq('tenant_id', tenant.id);
    const { data: mData } = await supabase.from('maintenance_logs').select(`
      *,
      vehicle:vehicles(id, plate_number, model, current_mileage)
    `).eq('tenant_id', tenant.id).order('created_at', { ascending: false });

    if (vData) setVehicles(vData as Vehicle[]);
    if (mData) setLogs(mData as MaintenanceLog[]);
  }, [tenant]);

  useEffect(() => {
    if (!isDemoMode && tenant) {
      loadData();
    }
  }, [isDemoMode, tenant, loadData]);

  const handleVehicleChange = (vId: string) => {
    const veh = vehicles.find(v => v.id === vId);
    setNewLog(prev => ({
      ...prev,
      vehicle_id: vId,
      mileage_at_maintenance: veh ? veh.current_mileage : 0,
      next_maintenance_mileage: veh ? veh.current_mileage + 5000 : 5000
    }));
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      const selectedVehicle = vehicles.find(v => v.id === newLog.vehicle_id);
      const added: MaintenanceLog = {
        id: `m_${Date.now()}`,
        vehicle_id: newLog.vehicle_id,
        mileage_at_maintenance: newLog.mileage_at_maintenance,
        description: newLog.description,
        cost: newLog.cost,
        maintenance_date: newLog.maintenance_date,
        next_maintenance_mileage: newLog.next_maintenance_mileage,
        is_completed: newLog.is_completed,
        vehicle: selectedVehicle
      };

      setLogs(prev => [added, ...prev]);
    } else {
      if (tenant) {
        await supabase.from('maintenance_logs').insert({
          tenant_id: tenant.id,
          vehicle_id: newLog.vehicle_id,
          mileage_at_maintenance: newLog.mileage_at_maintenance,
          description: newLog.description,
          cost: newLog.cost,
          maintenance_date: newLog.maintenance_date,
          next_maintenance_mileage: newLog.next_maintenance_mileage,
          is_completed: newLog.is_completed
        });

        // Also update vehicle mileage in Supabase
        await supabase.from('vehicles').update({
          current_mileage: newLog.mileage_at_maintenance
        }).eq('id', newLog.vehicle_id).eq('tenant_id', tenant.id);

        const vehicle = vehicles.find(v => v.id === newLog.vehicle_id);
        await logActivity({
          tenantId: tenant.id,
          action: 'create',
          entityType: 'maintenance',
          entityName: `تسجيل صيانة جديدة للسيارة: ${vehicle?.model || ''} - ${newLog.description} بقيمة ${newLog.cost} ر.س`,
          details: newLog
        });

        loadData();
      }
    }

    setNewLog({
      vehicle_id: '',
      mileage_at_maintenance: 0,
      description: '',
      cost: 0,
      maintenance_date: '',
      next_maintenance_mileage: 0,
      is_completed: true
    });
    setShowAddModal(false);
  };

  const isMaintenanceDue = (veh: Vehicle | undefined, nextMileage: number) => {
    if (!veh) return false;
    // Due if current mileage is within 500km of target or exceeds target
    return veh.current_mileage >= nextMileage - 500;
  };

  const isMaintenanceOverdue = (veh: Vehicle | undefined, nextMileage: number) => {
    if (!veh) return false;
    return veh.current_mileage > nextMileage;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-emerald-400" />
            الصيانة الدورية والعدادات
          </h2>
          <p className="text-slate-400 text-xs mt-1">تتبع تنبيهات الصيانة الوقائية للسيارات وجداول تغيير الزيوت والقطع الفنية</p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          تسجيل صيانة جديدة
        </Button>
      </header>

      {/* TRACKING COUNTERS ALERT BANNER */}
      <section className="grid grid-cols-1 gap-4">
        {logs.map((log) => {
          const isOverdue = isMaintenanceOverdue(log.vehicle, log.next_maintenance_mileage);
          const isDue = isMaintenanceDue(log.vehicle, log.next_maintenance_mileage);

          if (!isDue && !isOverdue) return null;

          return (
            <div key={log.id} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
              isOverdue
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="text-xs">
                  <strong className="block text-sm font-bold">تنبيه صيانة مستحقة! سيارة {log.vehicle?.model} ({log.vehicle?.plate_number})</strong>
                  <span>العداد الحالي للسيارة ({log.vehicle?.current_mileage.toLocaleString()} كم) قد {isOverdue ? 'تجاوز' : 'اقترب من'} العداد المحدد للصيانة القادمة ({log.next_maintenance_mileage.toLocaleString()} كم).</span>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setShowAddModal(true);
                  handleVehicleChange(log.vehicle_id);
                }}
                className={`text-slate-950 font-bold text-xs shrink-0 ${
                  isOverdue ? 'bg-rose-400 hover:bg-rose-500' : 'bg-amber-400 hover:bg-amber-500'
                }`}
              >
                إجراء صيانة الآن
              </Button>
            </div>
          );
        })}
      </section>

      {/* MAINTENANCE HISTORY */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider block">سجل الصيانة الوقائية للمكتب</h3>
        
        {logs.map((log) => (
          <Card key={log.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-750 transition-all overflow-hidden">
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Vehicle info */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-200">{log.vehicle?.model}</span>
                </div>
                <div className="text-xs text-slate-400">رقم اللوحة: <strong className="text-emerald-400">{log.vehicle?.plate_number}</strong></div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  تمت بتاريخ: {log.maintenance_date}
                </div>
              </div>

              {/* Description */}
              <div className="md:col-span-2 flex flex-col gap-1.5 text-xs">
                <span className="text-slate-550">تفاصيل الفحص والصيانة:</span>
                <p className="text-slate-300 font-medium leading-relaxed">{log.description}</p>

                <div className="flex flex-wrap gap-4 mt-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850/40 inline-block w-fit">
                  <span className="text-slate-500">العداد عند الصيانة: <strong className="text-slate-300">{log.mileage_at_maintenance.toLocaleString()} كم</strong></span>
                  <span className="text-slate-500">العداد للصيانة القادمة: <strong className="text-emerald-400">{log.next_maintenance_mileage.toLocaleString()} كم</strong></span>
                </div>
              </div>

              {/* Cost & Settle */}
              <div className="flex flex-col justify-center items-end border-r border-slate-800/80 pr-6">
                <span className="text-xs text-slate-500 block">تكلفة الصيانة الفنية:</span>
                <span className="text-xl font-black text-emerald-400 mt-0.5 block flex items-baseline gap-0.5">
                  {log.cost}
                  <span className="text-xs font-normal text-slate-500">ر.س</span>
                </span>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* ADD LOG MODAL */}
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
                <Wrench className="w-5 h-5 text-emerald-400" />
                سجل صيانة دورية جديدة
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل تكلفة وتفاصيل صيانة السيارة وعداد المتابعة القادم
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddLog} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اختر السيارة</label>
                  <select
                    required
                    value={newLog.vehicle_id}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="">-- حدد سيارة --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.model} - {v.plate_number}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">وصف وتفاصيل الصيانة الوقائية</label>
                  <textarea
                    required
                    placeholder="مثال: غيار زيت، فحص فرامل، وتغيير بطارية..."
                    value={newLog.description}
                    onChange={(e) => setNewLog(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none placeholder:text-slate-700 min-h-16"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">العداد عند الصيانة (كم)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={newLog.mileage_at_maintenance || ''}
                      onChange={(e) => setNewLog(prev => ({ ...prev, mileage_at_maintenance: parseInt(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">العداد المستهدف للصيانة القادمة (كم)</label>
                    <input
                      required
                      type="number"
                      min={newLog.mileage_at_maintenance}
                      value={newLog.next_maintenance_mileage || ''}
                      onChange={(e) => setNewLog(prev => ({ ...prev, next_maintenance_mileage: parseInt(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ الصيانة</label>
                    <input
                      required
                      type="date"
                      value={newLog.maintenance_date}
                      onChange={(e) => setNewLog(prev => ({ ...prev, maintenance_date: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تكلفة الصيانة (ر.س)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={newLog.cost || ''}
                      onChange={(e) => setNewLog(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تسجيل وإغلاق الصيانة
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
