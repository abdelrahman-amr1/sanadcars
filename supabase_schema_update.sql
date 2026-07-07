-- 1. إنشاء جدول طلبات الانضمام المعلقة
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
  entity_type text NOT NULL,
  entity_name text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. إضافة أعمدة ألوان المظهر والوضع الداكن لجدول المكاتب
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_color text DEFAULT 'emerald';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dark_mode boolean DEFAULT true;

-- 4. تفعيل RLS على الجداول الجديدة للحماية
ALTER TABLE tenant_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. إعداد سياسات الأمان لجدول طلبات الانضمام (tenant_requests)
DROP POLICY IF EXISTS requests_select ON tenant_requests;
CREATE POLICY requests_select ON tenant_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS requests_insert ON tenant_requests;
CREATE POLICY requests_insert ON tenant_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS requests_update ON tenant_requests;
CREATE POLICY requests_update ON tenant_requests
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  )
  WITH CHECK (
    auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- 6. إعداد سياسات الأمان لجدول سجل الحركة (audit_logs)
DROP POLICY IF EXISTS logs_select ON audit_logs;
CREATE POLICY logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS logs_insert ON audit_logs;
CREATE POLICY logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- 7. دالة جلب معرّف UUID للمستخدم بالبريد الإلكتروني لتسهيل الإضافة
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_address text)
RETURNS uuid
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT id FROM auth.users WHERE email = email_address);
END;
$$ LANGUAGE plpgsql;

-- 8. إنشاء منظر (View) لعرض الموظفين مع بريدهم الإلكتروني لتسهيل الإدارة
CREATE OR REPLACE VIEW tenant_members_with_emails AS
SELECT 
  tm.id,
  tm.tenant_id,
  tm.user_id,
  tm.role,
  tm.created_at,
  u.email AS user_email
FROM tenant_members tm
JOIN auth.users u ON tm.user_id = u.id;

-- 9. إعداد سياسات الأمان لجدول المكاتب (tenants)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS tenants_update ON tenants;
CREATE POLICY tenants_update ON tenants
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  )
  WITH CHECK (
    id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );
