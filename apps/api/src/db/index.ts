import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type DbMode = 'postgres' | 'embedded';

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

export interface Db extends DbClient {
  mode: DbMode;
  label: string;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function normaliseParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (p instanceof Date) return p;
    return p;
  });
}

async function createPostgres(): Promise<Db> {
  const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    max: 10,
    ssl: /sslmode=require|supabase\.co|supabase\.com/.test(env.databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
  await pool.query('SELECT 1');

  const client: DbClient = {
    async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, normaliseParams(params));
      return result.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };

  return {
    ...client,
    mode: 'postgres',
    label: 'PostgreSQL (managed)',
    async transaction<T>(fn: (tx: DbClient) => Promise<T>) {
      const conn = await pool.connect();
      try {
        await conn.query('BEGIN');
        const tx: DbClient = {
          async query<R extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
            const result = await conn.query(sql, normaliseParams(params));
            return result.rows as R[];
          },
          async exec(sql: string) {
            await conn.query(sql);
          },
        };
        const value = await fn(tx);
        await conn.query('COMMIT');
        return value;
      } catch (error) {
        await conn.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        conn.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

async function createEmbedded(): Promise<Db> {
  fs.mkdirSync(path.dirname(env.pgliteDir), { recursive: true });
  const db = await PGlite.create(env.pgliteDir);

  const client: DbClient = {
    async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await db.query<T>(sql, normaliseParams(params) as never[]);
      return result.rows;
    },
    async exec(sql: string) {
      await db.exec(sql);
    },
  };

  return {
    ...client,
    mode: 'embedded',
    label: 'Embedded PostgreSQL (PGlite)',
    async transaction<T>(fn: (tx: DbClient) => Promise<T>) {
      return db.transaction(async (trx) => {
        const wrapper: DbClient = {
          async query<R extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
            const result = await trx.query<R>(sql, normaliseParams(params) as never[]);
            return result.rows;
          },
          async exec(sql: string) {
            await trx.exec(sql);
          },
        };
        return fn(wrapper);
      }) as Promise<T>;
    },
    async close() {
      await db.close();
    },
  };
}

let instance: Db | null = null;

export async function getDb(): Promise<Db> {
  if (instance) return instance;
  instance = env.databaseUrl ? await createPostgres() : await createEmbedded();
  logger.info('database_connected', { mode: instance.mode, label: instance.label });
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 't' || value === 1 || value === '1';
}

export function toIso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}
