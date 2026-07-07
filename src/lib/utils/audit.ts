import { supabase } from '@/lib/supabase/client';

export interface AuditLogParams {
  tenantId: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'vehicle' | 'driver' | 'order' | 'violation' | 'maintenance' | 'member';
  entityName: string;
  details?: Record<string, unknown>;
}

export async function logActivity({
  tenantId,
  action,
  entityType,
  entityName,
  details
}: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      user_email: user.email || 'unknown',
      action,
      entity_type: entityType,
      entity_name: entityName,
      details: details || {}
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
