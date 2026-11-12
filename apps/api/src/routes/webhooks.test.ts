import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import express from 'express';
import { createTestDb, resetDb, type TestDb } from '../test/db.js';

const { verifyMock, handleEventMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  handleEventMock: vi.fn(),
}));

vi.mock('../payments/paypal.js', () => ({
  verifyPayPalWebhook: verifyMock,
}));

vi.mock('../services/orders.js', () => ({
  handlePayPalWebhookEvent: handleEventMock,
}));

let harness: TestDb;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  harness = await createTestDb();
  const { env } = await import('../config/env.js');
  (env.paypal as { webhookConfigured: boolean }).webhookConfigured = true;
  const { webhooksRouter } = await import('./webhooks.js');
  const app = express();
  app.use('/api/webhooks/paypal', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use('/api/webhooks', webhooksRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await harness.close();
}, 30_000);

beforeEach(async () => {
  await resetDb(harness.db);
  verifyMock.mockReset();
  handleEventMock.mockReset();
  verifyMock.mockResolvedValue(true);
  handleEventMock.mockResolvedValue(undefined);
});

describe('PayPal webhook route', () => {
  it('rejects requests with invalid webhook signature', async () => {
    verifyMock.mockResolvedValueOnce(false);
    const res = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'evt-invalid-sig', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }),
    });

    expect(res.status).toBe(400);
    expect(handleEventMock).not.toHaveBeenCalled();
  });

  it('processes verified webhook events idempotently on duplicate delivery', async () => {
    const payload = JSON.stringify({
      id: 'evt-dup-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'CAP-1' },
    });

    const first = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    const firstJson = (await first.json()) as { data: { eventId: string } };
    expect(first.status).toBe(200);
    expect(firstJson.data.eventId).toBe('evt-dup-1');
    expect(handleEventMock).toHaveBeenCalledTimes(1);

    const second = await fetch(`${baseUrl}/api/webhooks/paypal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
    const secondJson = (await second.json()) as { data: { duplicate: boolean } };
    expect(second.status).toBe(200);
    expect(secondJson.data.duplicate).toBe(true);
    expect(handleEventMock).toHaveBeenCalledTimes(1);
  });
});
