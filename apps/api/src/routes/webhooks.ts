import { Router } from 'express';
import { getDb, toIso } from '../db/index.js';
import { env } from '../config/env.js';
import { verifyPayPalWebhook } from '../payments/paypal.js';
import { handlePayPalWebhookEvent } from '../services/orders.js';
import { newId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export const webhooksRouter = Router();

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
};

/**
 * PayPal webhook receiver. The raw request body is preserved by the app
 * (express.raw on this path) because signature verification is computed over
 * the exact bytes PayPal sent. Unverified events are rejected, and duplicate
 * event ids are idempotent.
 */
webhooksRouter.post('/paypal', async (req, res, next) => {
  try {
    if (!env.paypal.webhookConfigured) {
      res.status(503).json({
        error: {
          code: 'PAYPAL_NOT_CONFIGURED',
          message: 'PayPal webhooks are not configured: set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID.',
          requestId: req.requestId,
        },
      });
      return;
    }

    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});

    let event: PayPalEvent;
    try {
      event = JSON.parse(raw) as PayPalEvent;
    } catch {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Webhook body is not valid JSON.', requestId: req.requestId },
      });
      return;
    }

    if (!event.id || !event.event_type) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Webhook event is missing id or event_type.', requestId: req.requestId },
      });
      return;
    }

    const verified = await verifyPayPalWebhook(req.headers, event);
    if (!verified) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Webhook signature verification failed. The event was not processed.',
          requestId: req.requestId,
        },
      });
      return;
    }

    const db = await getDb();
    // Atomic claim: only a new event or a retried FAILED event is processed.
    const claimed = await db.query(
      `INSERT INTO webhook_events (id, provider, provider_event_id, event_type, payload, processing_status)
       VALUES ($1, 'PAYPAL', $2, $3, $4::jsonb, 'RECEIVED')
       ON CONFLICT (provider, provider_event_id) DO UPDATE
         SET processing_status = 'RECEIVED', payload = EXCLUDED.payload
         WHERE webhook_events.processing_status = 'FAILED'
       RETURNING id`,
      [newId(), event.id, event.event_type, raw],
    );
    if (!claimed[0]) {
      res.json({ data: { received: true, duplicate: true, eventId: event.id } });
      return;
    }

    try {
      await handlePayPalWebhookEvent(
        { id: event.id, event_type: event.event_type, resource: event.resource },
        'PROCESSED',
      );
    } catch (error) {
      logger.error('paypal_webhook_processing_failed', {
        eventId: event.id,
        eventType: event.event_type,
        message: (error as Error).message,
      });
      await handlePayPalWebhookEvent(
        { id: event.id, event_type: event.event_type, resource: event.resource },
        'FAILED',
      ).catch(() => undefined);
      res.status(500).json({
        error: {
          code: 'INTERNAL',
          message: 'The verified event could not be applied. PayPal may retry it.',
          requestId: req.requestId,
        },
      });
      return;
    }

    res.json({ data: { received: true, eventId: event.id, processedAt: toIso(new Date()) } });
  } catch (error) {
    next(error);
  }
});
