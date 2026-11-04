import { getDb } from '../db/index.js';
import { newId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export type AuditActor = { id: string | null; role: string | null };

export async function audit(input: {
  actor?: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO audit_logs (id, actor_id, actor_role, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        newId(),
        input.actor?.id ?? null,
        input.actor?.role ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (error) {
    logger.warn('audit_write_failed', { action: input.action, message: (error as Error).message });
  }
}
