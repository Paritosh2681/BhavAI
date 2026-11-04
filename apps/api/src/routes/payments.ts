import { Router } from 'express';
import { optionalAuth, requireBuyer, requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { pathParam } from '../utils/http.js';
import { capturePayment, createPaymentForDeal, getPaymentStatus } from '../services/orders.js';

export const paymentsRouter = Router();
paymentsRouter.use(optionalAuth);

/**
 * POST /api/payments/deals/:negotiationId
 * Creates (or resumes) the server-authoritative payment for an agreed deal.
 * Domestic India deals become manual settlement orders; cross-border deals try
 * PayPal Sandbox and fail honestly when credentials are absent.
 */
paymentsRouter.post('/deals/:negotiationId', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const origin = typeof req.body?.origin === 'string' && /^https?:\/\//.test(req.body.origin)
      ? req.body.origin.replace(/\/$/, '')
      : req.get('origin') || req.get('referer')?.replace(/\/[^/]*$/, '') || req.protocol + '://' + req.get('host');
    const result = await createPaymentForDeal(pathParam(req, 'negotiationId'), auth, origin);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

/** POST /api/payments/:id/capture — buyer-side capture, server verifies amount. */
paymentsRouter.post('/:id/capture', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const result = await capturePayment(pathParam(req, 'id'), auth);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/** GET /api/payments/:id?reconcile=true — read local state, optionally fetch PayPal. */
paymentsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const reconcile = req.query.reconcile === 'true';
    const result = await getPaymentStatus(pathParam(req, 'id'), auth, reconcile);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
