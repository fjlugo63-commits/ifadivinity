import { supabase } from './supabase';

const AUDIT_TABLE = 'app_340b9f1944_audit_logs';

export type AuditAction =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'order.created'
  | 'order.cancelled'
  | 'order.completed'
  | 'user.role_changed'
  | 'booking.created'
  | 'booking.cancelled'
  | 'image.uploaded'
  | 'image.deleted';

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Log an audit event to the audit_logs table.
 * Fails silently - audit logging should never block user actions.
 */
export async function logAudit(
  action: AuditAction,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from(AUDIT_TABLE).insert({
      actor_id: user?.id || null,
      action,
      resource,
      resource_id: resourceId || null,
      metadata: metadata || {},
    });
  } catch {
    // Silent - audit logging should not block operations
    console.warn('Audit log failed:', action, resource);
  }
}

/**
 * Fetch audit logs (admin only)
 */
export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from(AUDIT_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch {
    return [];
  }
}