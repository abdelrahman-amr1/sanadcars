'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Car,
  Plus,
  Search,
  Filter,
  Trash2,
  Sliders,
  Settings,
  X,
  Gauge,
  User,
  Shield,
  HelpCircle,
  Truck
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_number: string;
  model: string;
  owner_national_id: string;
  owner_name: string;
  external_supplier?: string | null;
  current_mileage: number;
  status: 'available' | 'in_operation' | 'maintenance';
}

const mockVehicles: Vehicle[] = [
  { id: 'v1', plate_number: 'أ ب ج 1234', model: 'هيونداي إلنترا 2023', owner_national_id: '1098765432', owner_name: 'شركة اليمامة للتأجير', current_mileage: 45000, status: 'in_operation' },
  { id: 'v2', plate_number: 'د هـ و 5678', model: 'تويوتا كامري 2022', owner_national_id: '1012345678', owner_name: 'أحمد صالح محمد', current_mileage: 72100, status: 'available' },
  { id: 'v3', plate_number: 'س ش ص 9012', model: 'كيا سبورتيج 2024', owner_national_id: '1023456789', owner_name: 'خالد عبد الله الحربي', current_mileage: 12000, status: 'available' },
  { id: 'v4', plate_number: 'ق ر س 3456', model: 'نيسان صني 2021', owner_national_id: '2098765432', owner_name: 'سعود بن محمد', current_mileage: 95400, status: 'maintenance', external_supplier: 'مكتب الوفاق' },
  { id: 'v5', plate_number: 'ط ظ ع 7890', model: 'مازدا 6 2023', owner_national_id: '1054321098', owner_name: 'فيصل سليمان الشهري', current_mileage: 38200, status: 'available' }
];

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [isUsingMock, setIsUsingMock] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [newVehicle, setNewVehicle] = useState({
    plate_number: '',
    model: '',
    owner_national_id: '',
    owner_name: '',
    external_supplier: '',
    current_mileage: 0,
    status: 'available' as Vehicle['status']
  });

  useEffect(() => {
    async function checkSupabase() {
      try {
        const { data, error } = await supabase.from('vehicles').select('*');
        if (!error && data) {
          setVehicles(data as Vehicle[]);
          setIsUsingMock(false);
        }
      } catch {
        setIsUsingMock(true);
      }
    }
    checkSupabase();
  }, []);

  const loadData = async () => {
    const { data } = await supabase.from('vehicles').select('*');
    if (data) setVehicles(data as Vehicle[]);
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUsingMock) {
      const added: Vehicle = {
        id: `v_${Date.now()}`,
        plate_number: newVehicle.plate_number,
        model: newVehicle.model,
        owner_national_id: newVehicle.owner_national_id,
        owner_name: newVehicle.owner_name,
        external_supplier: newVehicle.external_supplier || null,
        current_mileage: newVehicle.current_mileage,
        status: newVehicle.status
      };
      setVehicles(prev => [added, ...prev]);
    } else {
      const { data: member } = await supabase.from('tenant_members').select('tenant_id').limit(1).single();
      if (member) {
        await supabase.from('vehicles').insert({
          tenant_id: member.tenant_id,
          plate_number: newVehicle.plate_number,
          model: newVehicle.model,
          owner_national_id: newVehicle.owner_national_id,
          owner_name: newVehicle.owner_name,
          external_supplier: newVehicle.external_supplier || null,
          current_mileage: newVehicle.current_mileage,
          status: newVehicle.status
        });
        loadData();
      }
    }

    setNewVehicle({
      plate_number: '',
      model: '',
      owner_national_id: '',
      owner_name: '',
      external_supplier: '',
      current_mileage: 0,
      status: 'available'
    });
    setShowAddModal(false);
  };

  const toggleStatus = async (id: string, currentStatus: Vehicle['status']) => {
    const nextStatus: Vehicle['status'] = currentStatus === 'available' ? 'maintenance' : 'available';

    if (isUsingMock) {
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, status: nextStatus } : v));
    } else {
      await supabase.from('vehicles').update({ status: nextStatus }).eq('id', id);
      loadData();
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.model.toLowerCase().includes(search.toLowerCase()) || v.plate_number.includes(search);
    const matchesFilter = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Car className="w-6 h-6 text-emerald-400" />
            أسطول السيارات
          </h2>
          <p className="text-slate-400 text-xs mt-1">إضافة وإدارة وتتبع أسطول سيارات الكيان وحالات الصيانة</p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold gap-2 px-5"
        >
          <Plus className="w-5 h-5 text-slate-950" />
          إضافة سيارة جديدة
        </Button>
      </header>

      {/* FILTER & SEARCH */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="relative">
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="البحث برقم اللوحة أو الموديل..."
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
            <option value="available">متاحة</option>
            <option value="in_operation">في أمر تشغيل</option>
            <option value="maintenance">في الصيانة</option>
          </select>
        </div>
      </section>

      {/* VEHICLES GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-all overflow-hidden flex flex-col justify-between">
            <div className="p-6 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-200 text-lg">{vehicle.model}</h3>
                  <span className="text-xs font-semibold text-emerald-400 mt-1 block tracking-wider bg-slate-950 px-2 py-0.5 rounded border border-slate-850 inline-block">
                    {vehicle.plate_number}
                  </span>
                </div>

                {vehicle.status === 'available' && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/25">متاحة بالجراج</Badge>
                )}
                {vehicle.status === 'in_operation' && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/25">في أمر تشغيل</Badge>
                )}
                {vehicle.status === 'maintenance' && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/25">في الصيانة</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-850/40">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500">العداد الحالي</span>
                  <span className="font-bold text-slate-300 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-slate-500" />
                    {vehicle.current_mileage.toLocaleString()} كم
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-slate-500">المالك بالرخصة</span>
                  <span className="font-bold text-slate-300 flex items-center gap-1 truncate" title={vehicle.owner_name}>
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {vehicle.owner_name}
                  </span>
                </div>
              </div>

              {vehicle.external_supplier && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>مورد خارجي: <strong>{vehicle.external_supplier}</strong></span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 flex justify-end gap-2">
              <Button
                disabled={vehicle.status === 'in_operation'}
                onClick={() => toggleStatus(vehicle.id, vehicle.status)}
                variant="outline"
                className="text-xs h-8 border-slate-800 text-slate-400 hover:text-slate-200"
              >
                {vehicle.status === 'maintenance' ? 'إعادة للجراج' : 'تحويل للصيانة'}
              </Button>

              <Button
                variant="outline"
                className="text-xs h-8 border-slate-800 text-slate-400 hover:text-slate-200"
                onClick={() => console.log('details')}
              >
                التفاصيل
              </Button>
            </div>
          </Card>
        ))}
      </section>

      {/* ADD VEHICLE MODAL */}
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
                <Car className="w-5 h-5 text-emerald-400" />
                إضافة سيارة جديدة للأسطول
              </CardTitle>
              <CardDescription className="text-slate-400">
                تسجيل بيانات لوحة ومواصفات السيارة للتأجير والتشغيل
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddVehicle} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم اللوحة</label>
                    <input
                      required
                      type="text"
                      placeholder="أ ب ج 1234"
                      value={newVehicle.plate_number}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, plate_number: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">موديل / طراز السيارة</label>
                    <input
                      required
                      type="text"
                      placeholder="هيونداي إلنترا 2023"
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, model: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-400 font-semibold">اسم مالك السيارة (في الرخصة)</label>
                  <input
                    required
                    type="text"
                    placeholder="الاسم الكامل لمالك السيارة"
                    value={newVehicle.owner_name}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, owner_name: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">رقم الهوية الوطنية للمالك</label>
                    <input
                      required
                      type="text"
                      placeholder="10xxxxxxxx"
                      value={newVehicle.owner_national_id}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, owner_national_id: e.target.value }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700 text-left"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-slate-400 font-semibold">قراءة العداد الحالية (كم)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={newVehicle.current_mileage || ''}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, current_mileage: parseInt(e.target.value) || 0 }))}
                      className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs text-amber-400 font-bold">حقل مورد خارجي (خيار الاستعارة/التأجير من مكتب آخر)</label>
                  <input
                    type="text"
                    placeholder="اسم المكتب أو الشخص المستعارة منه السيارة"
                    value={newVehicle.external_supplier}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, external_supplier: e.target.value }))}
                    className="bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700"
                  />
                  <span className="text-[10px] text-slate-500">اترك هذا الحقل فارغاً إذا كانت السيارة مملوكة للمكتب مباشرة.</span>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 mt-2">
                  تأكيد الإضافة للأسطول
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
