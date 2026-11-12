import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export const repoRoot = findRepoRoot();
dotenv.config({ path: path.join(repoRoot, '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().default(''),
  API_BASE_URL: z.string().default(''),
  CORS_ORIGIN: z.string().default(''),
  DATABASE_URL: z.string().default(''),
  PGLITE_DIR: z.string().default(''),
  JWT_SECRET: z.string().default(''),
  COOKIE_SECURE: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  PAYPAL_CLIENT_ID: z.string().default(''),
  PAYPAL_CLIENT_SECRET: z.string().default(''),
  PAYPAL_BASE_URL: z.string().default('https://api-m.sandbox.paypal.com'),
  PAYPAL_WEBHOOK_ID: z.string().default(''),
  MCP_API_KEY: z.string().default(''),
  DEMO_MODE: z.string().default(''),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  FRONTEND_URL: z.string().default(''),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] Invalid environment configuration:', z.prettifyError(parsed.error));
  process.exit(1);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === 'production';
const warnings: string[] = [];

/** Embedded PGlite lives on local disk, which is wiped on ephemeral hosts. */
if (isProd && !raw.DATABASE_URL) {
  console.error('[env] DATABASE_URL is required in production; the embedded database is not durable here.');
  process.exit(1);
}

/** Dev-only fallback secret. Production refuses to boot without a real one. */
let jwtSecret = raw.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) {
    console.error('[env] JWT_SECRET is required in production.');
    process.exit(1);
  }
  jwtSecret = crypto.createHash('sha256').update(`bhavai-dev-${repoRoot}`).digest('hex');
  warnings.push('JWT_SECRET not set — using a deterministic development-only secret.');
}

const appUrl = raw.APP_URL || raw.FRONTEND_URL || `http://localhost:${raw.PORT}`;
const frontendUrl = raw.FRONTEND_URL || (isProd ? appUrl : 'http://localhost:5173');

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProd,
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  appUrl,
  frontendUrl,
  apiBaseUrl: raw.API_BASE_URL || appUrl,
  corsOrigins: raw.CORS_ORIGIN
    ? raw.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : [appUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  databaseUrl: raw.DATABASE_URL,
  pgliteDir: raw.PGLITE_DIR || path.join(repoRoot, 'data', 'bhavai.db'),
  jwtSecret,
  cookieSecure: raw.COOKIE_SECURE ? raw.COOKIE_SECURE === 'true' : isProd,
  gemini: {
    apiKey: raw.GEMINI_API_KEY,
    model: raw.GEMINI_MODEL,
    configured: Boolean(raw.GEMINI_API_KEY),
  },
  paypal: {
    clientId: raw.PAYPAL_CLIENT_ID,
    clientSecret: raw.PAYPAL_CLIENT_SECRET,
    baseUrl: raw.PAYPAL_BASE_URL.replace(/\/$/, ''),
    webhookId: raw.PAYPAL_WEBHOOK_ID,
    configured: Boolean(raw.PAYPAL_CLIENT_ID && raw.PAYPAL_CLIENT_SECRET),
    webhookConfigured: Boolean(raw.PAYPAL_CLIENT_ID && raw.PAYPAL_CLIENT_SECRET && raw.PAYPAL_WEBHOOK_ID),
    environment: raw.PAYPAL_BASE_URL.includes('sandbox') ? 'sandbox' : 'live',
  },
  mcpApiKey: raw.MCP_API_KEY,
  // Opt-in only: demo accounts and sample rows never seed unless explicitly enabled.
  demoMode: raw.DEMO_MODE === 'true',
  logLevel: raw.LOG_LEVEL,
  webDist: path.join(repoRoot, 'apps', 'web', 'dist'),
  migrationsDir: path.join(repoRoot, 'database', 'migrations'),
  warnings,
} as const;

export function integrationSnapshot() {
  return {
    gemini: { configured: env.gemini.configured, model: env.gemini.configured ? env.gemini.model : null },
    paypal: {
      configured: env.paypal.configured,
      environment: env.paypal.environment,
      webhookConfigured: env.paypal.webhookConfigured,
      clientIdSuffix: env.paypal.clientId ? env.paypal.clientId.slice(-6) : null,
    },
    channel3: { configured: false },
    mcp: { authenticated: Boolean(env.mcpApiKey) },
  };
}

if (warnings.length) {
  for (const w of warnings) console.warn(`[env] ${w}`);
}
