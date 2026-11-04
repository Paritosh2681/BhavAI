import { Router } from 'express';
import { NegotiationCreateInput, OfferInput } from '@bhavai/shared';
import { optionalAuth, requireAuth, requireBuyer, requireSeller } from '../middleware/auth.js';
import { parseWith, pathParam } from '../utils/http.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  approveDeal,
  cancelNegotiation,
  confirmDeal,
  createNegotiation,
  getNegotiationDetail,
  listNegotiations,
  rejectNegotiation,
  runNegotiationStep,
} from '../services/negotiation.js';
import { badRequest } from '../utils/errors.js';

export const negotiationsRouter = Router();
negotiationsRouter.use(optionalAuth);

negotiationsRouter.post('/', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(NegotiationCreateInput, req.body);
    const negotiation = await createNegotiation(auth, input);
    res.status(201).json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const result = await listNegotiations(auth, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await getNegotiationDetail(pathParam(req, 'id'), auth);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.post('/:id/step', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await runNegotiationStep(pathParam(req, 'id'), auth);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /:id/offers lets a human buyer submit a specific counter instead of
 * letting the buyer agent choose. It is validated by the same engine; the
 * seller agent responds on the next /step.
 */
negotiationsRouter.post('/:id/offers', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(OfferInput, req.body);
    const detail = await getNegotiationDetail(pathParam(req, 'id'), auth);
    if (detail.status !== 'OPEN') throw badRequest('This negotiation is no longer open.');
    if (detail.quantity !== input.quantity) {
      throw badRequest(`This negotiation is for ${detail.quantity} units. Start a new negotiation to change quantity.`);
    }
    const { submitBuyerOffer } = await import('../services/negotiation-offers.js');
    const negotiation = await submitBuyerOffer(pathParam(req, 'id'), auth, input);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.post('/:id/accept', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    if (auth.user.role === 'SELLER') {
      const sellerAuth = requireSeller(req);
      const negotiation = await approveDeal(pathParam(req, 'id'), sellerAuth);
      res.json({ data: { negotiation } });
      return;
    }
    const buyerAuth = requireBuyer(req);
    const negotiation = await confirmDeal(pathParam(req, 'id'), buyerAuth);
    res.json({ data: { negotiation, note: 'Buyer confirmed the deal. Payment can now be created.' } });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.post('/:id/confirm', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const negotiation = await confirmDeal(pathParam(req, 'id'), auth);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.post('/:id/reject', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await rejectNegotiation(pathParam(req, 'id'), auth, typeof req.body?.reason === 'string' ? req.body.reason : undefined);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});

negotiationsRouter.post('/:id/cancel', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const negotiation = await cancelNegotiation(pathParam(req, 'id'), auth, typeof req.body?.reason === 'string' ? req.body.reason : undefined);
    res.json({ data: { negotiation } });
  } catch (error) {
    next(error);
  }
});
