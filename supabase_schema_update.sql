-- 1. إنشاء جدول طلبات الانضمام
CREATE TABLE IF NOT EXISTS tenant_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. إنشاء جدول سجل الحركة (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  action text NOT NULL, -- 'create' | 'update' | 'delete'
  entity_type text NOT NULL, -- 'vehicle' | 'driver' | 'order' | 'violation' | 'maintenance' | 'member'
  entity_name text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. إضافة أعمدة التخصيص لجدول tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color text DEFAULT 'emerald';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT true;

-- 4. تفعيل RLS على الجداول الجديدة
ALTER TABLE tenant_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. إعداد سياسات الأمان لجدول طلبات الانضمام (tenant_requests)
DROP POLICY IF EXISTS requests_select ON tenant_requests;
CREATE POLICY requests_select ON tenant_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS requests_insert ON tenant_requests;
CREATE POLICY requests_insert ON tenant_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS requests_update ON tenant_requests;
CREATE POLICY requests_update ON tenant_requests
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com');

-- 6. إعداد سياسات الأمان لجدول سجل الحركة (audit_logs)
DROP POLICY IF EXISTS logs_select ON audit_logs;
CREATE POLICY logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS logs_insert ON audit_logs;
CREATE POLICY logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );
