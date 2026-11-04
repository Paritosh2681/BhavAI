import { apiKey, newId } from '../utils/crypto.js';
import { getDb, toIso } from '../db/index.js';
import { notFound } from '../utils/errors.js';
import type { Role } from '@bhavai/shared';
import { audit } from './audit.js';

export type ApiKeySummary = {
  id: string;
  label: string;
  prefix: string;
  role: Role;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function mapKey(row: Record<string, unknown>): ApiKeySummary {
  return {
    id: String(row.id),
    label: String(row.label),
    prefix: String(row.prefix),
    role: row.role as Role,
    createdAt: toIso(row.created_at),
    lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : null,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
  };
}

export async function listApiKeys(userId: string): Promise<ApiKeySummary[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM api_keys WHERE user_id = $1 ORDER BY revoked_at NULLS FIRST, created_at DESC`,
    [userId],
  );
  return rows.map(mapKey);
}

/**
 * Returns the raw secret exactly once. Only a SHA-256 hash and a display prefix
 * are stored, so the key can never be recovered from the database.
 */
export async function createApiKey(input: {
  userId: string;
  role: Role;
  label: string;
}): Promise<{ key: ApiKeySummary; secret: string }> {
  const db = await getDb();
  const generated = apiKey();
  const id = newId();
  await db.query(
    `INSERT INTO api_keys (id, user_id, label, key_hash, prefix, role) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.userId, input.label.trim().slice(0, 80), generated.hash, generated.prefix, input.role],
  );
  const rows = await db.query(`SELECT * FROM api_keys WHERE id = $1`, [id]);
  await audit({
    actor: { id: input.userId, role: input.role },
    action: 'api_key.created',
    resourceType: 'api_key',
    resourceId: id,
    metadata: { prefix: generated.prefix, label: input.label },
  });
  return { key: mapKey(rows[0]), secret: generated.raw };
}

export async function revokeApiKey(userId: string, keyId: string): Promise<ApiKeySummary> {
  const db = await getDb();
  const rows = await db.query(
    `UPDATE api_keys SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1 AND user_id = $2 RETURNING *`,
    [keyId, userId],
  );
  if (!rows[0]) throw notFound('API key not found');
  await audit({
    actor: { id: userId, role: null },
    action: 'api_key.revoked',
    resourceType: 'api_key',
    resourceId: keyId,
  });
  return mapKey(rows[0]);
}
