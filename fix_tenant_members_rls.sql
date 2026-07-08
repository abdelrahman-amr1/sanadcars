-- First let's check and configure RLS on tenant_members
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS tenant_members_owner_admin_all ON tenant_members;
DROP POLICY IF EXISTS tenant_members_select ON tenant_members;
DROP POLICY IF EXISTS tenant_members_insert ON tenant_members;
DROP POLICY IF EXISTS tenant_members_delete ON tenant_members;

-- Policy to allow users to SELECT member records if they are part of the same tenant
CREATE POLICY tenant_members_select ON tenant_members
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id 
      FROM tenant_members tm 
      WHERE tm.user_id = auth.uid()
    )
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Policy to allow owner/admin to INSERT members into their tenant
CREATE POLICY tenant_members_insert ON tenant_members
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id 
      FROM tenant_members tm 
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );

-- Policy to allow owner/admin to DELETE members from their tenant
CREATE POLICY tenant_members_delete ON tenant_members
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id 
      FROM tenant_members tm 
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'abdelrahman.amr@gmail.com'
  );
