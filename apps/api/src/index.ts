import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { getDb, closeDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { seedDemoData } from './db/seed.js';
import { errorHandler, notFoundHandler, requestId, requestLogger } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { sellerRouter } from './routes/seller.js';
import { productsRouter } from './routes/products.js';
import { rulesRouter } from './routes/rules.js';
import { publicRouter } from './routes/public.js';
import { buyerRouter } from './routes/buyer.js';
import { negotiationsRouter } from './routes/negotiations.js';
import { paymentsRouter } from './routes/payments.js';
import { ordersRouter } from './routes/orders.js';
import { dashboardRouter } from './routes/dashboard.js';
import { developerRouter } from './routes/developer.js';
import { webhooksRouter } from './routes/webhooks.js';
import { mcpRouter } from './mcp/server.js';
import { MCP_TOOL_COUNT } from './mcp/tools.js';
import { integrationSnapshot } from './config/env.js';
import { logger } from './utils/logger.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!env.isProd) return callback(null, true);
      return callback(null, env.corsOrigins.includes(origin));
    },
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-bhavai-key', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'rate-limit', 'rate-limit-policy'],
  }),
);

app.use(requestId);
app.use(requestLogger);

// PayPal signs the exact bytes it sends, so this route keeps the raw body.
app.use('/api/webhooks/paypal', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(cookieParser());

app.get('/health', async (req, res) => {
  let database: { ok: boolean; mode: string; label: string } = { ok: false, mode: 'unknown', label: 'unknown' };
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    database = { ok: true, mode: db.mode, label: db.label };
  } catch (error) {
    logger.error('health_database_failed', { message: (error as Error).message });
  }
  const ok = database.ok;
  res.status(ok ? 200 : 503).json({
    data: {
      status: ok ? 'ok' : 'degraded',
      service: 'bhavai-api',
      version: '1.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      database,
      integrations: integrationSnapshot(),
      mcp: { endpoint: '/mcp', tools: MCP_TOOL_COUNT },
      requestId: req.requestId,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/products', productsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/public', publicRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/negotiations', negotiationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/developer', developerRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/mcp', mcpRouter);

const hasWebBuild = fs.existsSync(env.webDist);
if (hasWebBuild) {
  app.use(
    express.static(env.webDist, {
      index: false,
      maxAge: env.isProd ? '1h' : 0,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  app.get(/^\/(?!api(?:\/|$)|mcp(?:\/|$)|health$).*/, (_req, res) => {
    res.sendFile(`${env.webDist}/index.html`);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

export async function start(): Promise<void> {
  await migrate();
  if (env.demoMode) {
    const result = await seedDemoData();
    if (result.seeded) logger.info('demo_data_ready', { reason: 'seeded' });
    else logger.info('demo_data_skipped', { reason: result.reason });
  }

  server = app.listen(env.port, () => {
    logger.info('server_started', {
      port: env.port,
      environment: env.nodeEnv,
      webBuild: hasWebBuild,
      mcp: '/mcp',
      integrations: integrationSnapshot(),
    });
    if (!env.isProd) {
      console.log(`\n  BhavAI API  http://localhost:${env.port}`);
      console.log(`  MCP endpoint http://localhost:${env.port}/mcp`);
      console.log(`  Web build ${hasWebBuild ? 'served from apps/web/dist' : 'not found — run npm run build -w @bhavai/web'}\n`);
      if (env.demoMode) {
        console.log('  Demo accounts (sample data, password BhavAI!2026):');
        console.log('    seller@bhavai.demo  (Aaranya Crafts, USD storefront)');
        console.log('    meera@bhavai.demo   (Meera Textiles, INR storefront)');
        console.log('    alex@bhavai.demo    (US buyer)');
        console.log('    priya@bhavai.demo   (India buyer)\n');
      }
    }
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info('shutdown', { signal });
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  }
  await closeDb();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('/src/index.ts') || process.argv[1]?.replace(/\\/g, '/').endsWith('/dist/index.js');
if (isDirectRun) {
  start().catch((error) => {
    logger.error('startup_failed', { message: (error as Error).message, stack: (error as Error).stack });
    process.exit(1);
  });
}
