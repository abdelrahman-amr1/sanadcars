'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Plus,
  Search,
  X,
  Car,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Tag
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
}

interface Violation {
  id: string;
  violation_number: string;
  amount: number;
  violation_date: string;
  vehicle_id: string;
  order_id?: string | null;
  status: 'pending' | 'paid';
  vehicle?: Vehicle;
}

const mockVehicles: Vehicle[] = [
  { id: 'v1', plate_number: 'أ ب ج 1234', model: 'هيونداي إلنترا 2023' },
  { id: 'v2', plate_number: 'د هـ و 5678', model: 'تويوتا كامري 2022' },
  { id: 'v4', plate_number: 'ق ر س 3456', model: 'نيسان صني 2021' }
];

const mockViolations: Violation[] = [
  {
    id: 'vi1',
    violation_number: 'V99881122',
    amount: 150,
    violation_date: '2026-06-29T14:30',
    vehicle_id: 'v4',
    order_id: 'o2',
    status: 'pending',
    vehicle: mockVehicles[2]
  },
  {
    id: 'vi2',
    violation_number: 'V55443322',
    amount: 300,
    violation_date: '2026-06-15T09:15',
    vehicle_id: 'v1',
    order_id: 'o1',
    status: 'paid',
    vehicle: mockVehicles[0]
  }
];

export default function ViolationsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [violations, setViolations] = useState<Violation[]>(mockViolations);
  const [isUsingMock, setIsUsingMock] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const [newViolation, setNewViolation] = useState({
    violation_number: '',
    amount: 0,
    violation_date: '',
    vehicle_id: '',
    order_id: '',
    status: 'pending' as Violation['status']
  });

  useEffect(() => {
    async function checkSupabase() {
      try {
        const { data, error } = await supabase.from('traffic_violations').select('*');
        if (!error && data) {
          setIsUsingMock(false);
          loadData();
        }
      } catch {
        setIsUsingMock(true);
      }
    }
    checkSupabase();
  }, []);

  const loadData = async () => {
    const { data: vData } = await supabase.from('vehicles').select('id, plate_number, model');
    const { data: viData } = await supabase.from('traffic_violations').select(`
      *,
      vehicle:vehicles(id, plate_number, model)
    `).order('created_at', { ascending: false });

    if (vData) setVehicles(vData as Vehicle[]);
    if (viData) setViolations(viData as Violation[]);
  };

  const handleAddViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsingMock) {
      const selectedVehicle = vehicles.find(v => v.id === newViolation.vehicle_id);
      const added: Violation = {
        id: `vi_${Date.now()}`,
        violation_number: newViolation.violation_number,
        amount: newViolation.amount,
        violation_date: newViolation.violation_date,
        vehicle_id: newViolation.vehicle_id,
        order_id: newViolation.order_id || null,
        status: newViolation.status,
        vehicle: selectedVehicle
      };
      setViolations(prev => [added, ...prev]);
    } else {
      const { data: member } = await supabase.from('tenant_members').select('tenant_id').limit(1).single();
      if (member) {
        await supabase.from('traffic_violations').insert({
          tenant_id: member.tenant_id,
          violation_number: newViolation.violation_number,
          amount: newViolation.amount,
          violation_date: new Date(newViolation.violation_date).toISOString(),
          vehicle_id: newViolation.vehicle_id,
          order_id: newViolation.order_id || null,
          status: newViolation.status
        });
        loadData();
      }
    }

    setNewViolation({
      violation_number: '',
      amount: 0,
      violation_date: '',
      vehicle_id: '',
      order_id: '',
      status: 'pending'
    });
    setShowAddModal(false);
  };

  const handlePayViolation = async (id: string) => {
    if (isUsingMock) {
      setViolations(prev => prev.map(vi => vi.id === id ? { ...vi, status: 'paid' } : vi));
    } else {
      await supabase.from('traffic_violations').update({ status: 'paid' }).eq('id', id);
      loadData();
    }
  };

  const filteredViolations = violations.filter(vi =>
    vi.violation_number.includes(search) || vi.vehicle?.plate_number.includes(search)
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-400" />
            المخالفات المرورية
          </h2>
          <p className="text-slate-400 text-xs mt-1">تتبع المخالفات والغرامات المسجلة على لوحات سيارات الكيان وتسويتها مع المستأجرين</p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          تسجيل مخالفة جديدة
        </Button>
      </header>

      {/* FILTER & SEARCH */}
      <section className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث برقم المخالفة أو رقم لوحة السيارة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-650"
          />
        </div>
      </section>

      {/* VIOLATIONS LIST */}
      <section className="flex flex-col gap-4">
        {filteredViolations.map((violation) => (
          <Card key={violation.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-750 transition-all overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                {/* Icon badge */}
                <div className={`p-3 rounded-xl border shrink-0 ${
                  violation.status === 'paid'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/20 bg-red-500/10 text-red-400'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200 text-lg">رقم المخالفة: {violation.violation_number}</span>
                    {violation.status === 'paid' ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25">تم السداد</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/25">غير مسددة</Badge>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap gap-4 mt-1">
                    <span className="flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-slate-500" />
                      السيارة: <strong>{violation.vehicle?.model} ({violation.vehicle?.plate_number})</strong>
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      تاريخ المخالفة: <strong>{new Date(violation.violation_date).toLocaleString('ar-EG')}</strong>
                    </span>

                    {violation.order_id && (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Tag className="w-3.5 h-3.5 text-amber-500" />
                        مرتبطة بأمر التشغيل: {violation.order_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0 self-stretch md:self-auto justify-between border-t md:border-t-0 md:border-r border-slate-800/80 pt-4 md:pt-0 md:pr-6">
                <div>
                  <span className="text-xs text-slate-500 block text-left">قيمة الغرامة:</span>
                  <span className="text-xl font-black text-rose-400 mt-0.5 block flex items-baseline gap-0.5">
                    {violation.amount}
                    <span className="text-xs font-normal text-slate-500">ر.س</span>
                  </span>
                </div>

                {violation.status === 'pending' && (
                  <Button
                    onClick={() => handlePayViolation(violation.id)}
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-1.5 text-xs mt-2"
                  >
                    تسوية وسداد الغرامة
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* ADD VIOLATION MODAL */}
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
                <FileText className="w-5 h-5 text-emerald-400" />
                تسجيل مخالفة مرورية جديدة
              </CardTitle>
              <CardDescription className="text-slate-400">
                إدخال تفاصيل الغرامة وربطها بلوحة السيارة لتسويتها لاحقاً
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddViolation} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم المخالفة</label>
                    <input
                      required
                      type="text"
                      placeholder="Vxxxxxxxx"
                      value={newViolation.violation_number}
                      onChange={(e) => setNewViolation(prev => ({ ...prev, violation_number: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">قيمة الغرامة (ر.س)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={newViolation.amount || ''}
                      onChange={(e) => setNewViolation(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اختر السيارة المخالفة</label>
                  <select
                    required
                    value={newViolation.vehicle_id}
                    onChange={(e) => setNewViolation(prev => ({ ...prev, vehicle_id: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="">-- حدد سيارة --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.model} - {v.plate_number}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">تاريخ ووقت المخالفة</label>
                    <input
                      required
                      type="datetime-local"
                      value={newViolation.violation_date}
                      onChange={(e) => setNewViolation(prev => ({ ...prev, violation_date: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم أمر التشغيل (اختياري)</label>
                    <input
                      type="text"
                      placeholder="رقم الرحلة أو الإذن"
                      value={newViolation.order_id}
                      onChange={(e) => setNewViolation(prev => ({ ...prev, order_id: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none placeholder:text-slate-700"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تسجيل الغرامة وحفظها
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
