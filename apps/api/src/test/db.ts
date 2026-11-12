import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Db } from '../db/index.js';

export type TestDb = {
  db: Db;
  close: () => Promise<void>;
};

/**
 * Boots a throwaway PGlite database. Call this BEFORE importing any module that
 * reads src/config/env.ts (it snapshots process.env at import time).
 */
export async function createTestDb(): Promise<TestDb> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhavai-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = '';
  process.env.PGLITE_DIR = dir;
  // Never let a local .env call a real model or payment provider from tests.
  process.env.GEMINI_API_KEY = '';
  process.env.PAYPAL_CLIENT_ID = '';
  process.env.PAYPAL_CLIENT_SECRET = '';
  process.env.PAYPAL_WEBHOOK_ID = '';
  process.env.MCP_API_KEY = '';

  const { migrate } = await import('../db/migrate.js');
  const { getDb, closeDb } = await import('../db/index.js');
  await migrate();

  return {
    db: await getDb(),
    async close() {
      await closeDb();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function resetDb(db: Db): Promise<void> {
  await db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM webhook_events;
    DELETE FROM offers;
    DELETE FROM payments;
    DELETE FROM orders;
    DELETE FROM deals;
    DELETE FROM negotiations;
    DELETE FROM seller_rules;
    DELETE FROM products;
    DELETE FROM buyers;
    DELETE FROM sellers;
    DELETE FROM users;
  `);
}
