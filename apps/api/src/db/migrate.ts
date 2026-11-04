import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { getDb } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Migrations are idempotent (CREATE TABLE IF NOT EXISTS). The init schema is
 * applied on every boot; the optional Supabase RLS file is documented and
 * applied only when APPLY_RLS=true is set, so local embedded Postgres works.
 */
export async function migrate(): Promise<void> {
  const db = await getDb();
  const files = ['001_init.sql'];
  if (process.env.APPLY_RLS === 'true') files.push('002_rls.sql');

  for (const file of files) {
    const full = path.join(env.migrationsDir, file);
    if (!fs.existsSync(full)) {
      throw new Error(`Migration file not found: ${full}`);
    }
    const sql = fs.readFileSync(full, 'utf8');
    await db.exec(sql);
    logger.info('migration_applied', { file });
  }

  // Additive, defensive migrations for databases created by earlier builds.
  await ensureColumn('negotiations', 'is_sample', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('offers', 'explanation', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn('deals', 'is_sample', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('orders', 'is_sample', 'BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn('sellers', 'onboarding_complete', 'BOOLEAN NOT NULL DEFAULT FALSE');
}

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const db = await getDb();
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  if (cols.length === 0) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    logger.info('migration_column_added', { table, column });
  }
}
