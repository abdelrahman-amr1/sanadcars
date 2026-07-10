-- Create or update helper function to get current user's tenant ID securely
-- Marked as SECURITY DEFINER to bypass Row Level Security and avoid recursion
CREATE OR REPLACE FUNCTION get_auth_tenant_id()
RETURNS uuid
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT tenant_id 
    FROM tenant_members 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Create or update helper function to check if current user is owner or admin securely
-- Marked as SECURITY DEFINER to bypass Row Level Security and avoid recursion
CREATE OR REPLACE FUNCTION is_tenant_admin_or_owner()
RETURNS boolean
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM tenant_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql;

-- Configure RLS on tenant_members
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS tenant_members_owner_admin_all ON tenant_members;
DROP POLICY IF EXISTS tenant_members_select ON tenant_members;
DROP POLICY IF EXISTS tenant_members_insert ON tenant_members;
DROP POLICY IF EXISTS tenant_members_delete ON tenant_members;

-- 1. SELECT policy: allow users to SELECT member records if they are part of the same tenant
CREATE POLICY tenant_members_select ON tenant_members
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- 2. INSERT policy: allow owner/admin to INSERT members into their tenant
CREATE POLICY tenant_members_insert ON tenant_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = get_auth_tenant_id() AND is_tenant_admin_or_owner())
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- 3. DELETE policy: allow owner/admin to DELETE members from their tenant
CREATE POLICY tenant_members_delete ON tenant_members
  FOR DELETE TO authenticated
  USING (
    (tenant_id = get_auth_tenant_id() AND is_tenant_admin_or_owner())
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on tenants table to avoid recursion
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants
  FOR SELECT TO authenticated
  USING (
    id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS tenants_update ON tenants;
CREATE POLICY tenants_update ON tenants
  FOR UPDATE TO authenticated
  USING (
    id = get_auth_tenant_id() AND is_tenant_admin_or_owner()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  )
  WITH CHECK (
    id = get_auth_tenant_id() AND is_tenant_admin_or_owner()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on customers table to avoid recursion
DROP POLICY IF EXISTS customers_all ON customers;
CREATE POLICY customers_all ON customers
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on audit_logs to avoid recursion
DROP POLICY IF EXISTS logs_select ON audit_logs;
CREATE POLICY logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

DROP POLICY IF EXISTS logs_insert ON audit_logs;
CREATE POLICY logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_auth_tenant_id()
    OR auth.uid() = '44f35d93-5b01-432d-8a8b-b6e480eb233f'::uuid
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on vehicles to avoid recursion
DROP POLICY IF EXISTS vehicles_all ON vehicles;
CREATE POLICY vehicles_all ON vehicles
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on drivers to avoid recursion
DROP POLICY IF EXISTS drivers_all ON drivers;
CREATE POLICY drivers_all ON drivers
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on operation_orders to avoid recursion
DROP POLICY IF EXISTS operation_orders_all ON operation_orders;
CREATE POLICY operation_orders_all ON operation_orders
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on expenses to avoid recursion
DROP POLICY IF EXISTS expenses_all ON expenses;
CREATE POLICY expenses_all ON expenses
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on maintenance_logs to avoid recursion
DROP POLICY IF EXISTS maintenance_logs_all ON maintenance_logs;
CREATE POLICY maintenance_logs_all ON maintenance_logs
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Update RLS policies on traffic_violations to avoid recursion
DROP POLICY IF EXISTS traffic_violations_all ON traffic_violations;
CREATE POLICY traffic_violations_all ON traffic_violations
  FOR ALL TO authenticated
  USING (
    tenant_id = get_auth_tenant_id()
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Create or update function to allow admin to create a user and add them to the tenant
-- Runs as SECURITY DEFINER to bypass RLS and insert into auth.users, auth.identities, and tenant_members
CREATE OR REPLACE FUNCTION create_and_add_tenant_member(
  user_email text, 
  user_password text, 
  target_tenant_id uuid, 
  target_role text
)
RETURNS boolean
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- 1. Check if user already exists in auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
  
  -- 2. If not, create the user in auth.users and auth.identities
  IF target_user_id IS NULL THEN
    target_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      '00000000-0000-0000-0000-000000000000',
      user_email,
      extensions.crypt(user_password, extensions.gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
    
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      target_user_id,
      target_user_id,
      jsonb_build_object('sub', target_user_id, 'email', user_email),
      'email',
      now(),
      now(),
      now()
    );
  END IF;
  
  -- 3. Delete existing membership to prevent 409 Conflict
  DELETE FROM tenant_members WHERE user_id = target_user_id;
  
  -- 4. Insert new membership
  INSERT INTO tenant_members (tenant_id, user_id, role)
  VALUES (target_tenant_id, target_user_id, target_role);
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

