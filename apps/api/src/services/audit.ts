import crypto from 'node:crypto';
import { D1Database } from '../db/d1-adapter';
import { AuthenticatedUser } from './auth';

export interface AuditParams {
  actor?: AuthenticatedUser | null;
  action: string;
  entityType: string;
  entityId?: string;
  districtScope?: string;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  ipAddress?: string;
  status?: 'SUCCESS' | 'FAILED';
}

function sanitizeForAudit(obj?: Record<string, any> | null): string | null {
  if (!obj) return null;
  const clone = { ...obj };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'tokenHash', 'mfaSecret', 'secret'];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      clone[key] = '[REDACTED]';
    }
  }
  return JSON.stringify(clone);
}

export async function logAuditEvent(db: D1Database, params: AuditParams): Promise<string> {
  const auditId = `aud_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO audit_events 
       (id, actor_id, actor_pno, actor_role, action, entity_type, entity_id, district_scope, before_state_json, after_state_json, ip_address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      auditId,
      params.actor?.id || null,
      params.actor?.pno || null,
      params.actor?.role || null,
      params.action,
      params.entityType,
      params.entityId || null,
      params.districtScope || params.actor?.districtId || null,
      sanitizeForAudit(params.beforeState),
      sanitizeForAudit(params.afterState),
      params.ipAddress || '127.0.0.1',
      params.status || 'SUCCESS',
      now
    )
    .run();

  return auditId;
}
