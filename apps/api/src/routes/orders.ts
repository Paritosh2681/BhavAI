import { Router } from 'express';
import { optionalAuth, requireAuth, requireSeller } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { pathParam } from '../utils/http.js';
import {
  cancelOrder,
  fulfillOrder,
  getOrder,
  listOrders,
  settleDomesticOrder,
} from '../services/orders.js';

export const ordersRouter = Router();
ordersRouter.use(optionalAuth);

ordersRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const result = await listOrders(auth, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      market: typeof req.query.market === 'string' ? req.query.market : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const order = await getOrder(pathParam(req, 'id'), auth);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});

/**
 * Seller confirms receipt of domestic, off-platform funds. This is the only
 * place a domestic order becomes SETTLED, and it is explicitly manual.
 */
ordersRouter.post('/:id/settle', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    const order = await settleDomesticOrder(pathParam(req, 'id'), auth, note);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post('/:id/fulfil', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const order = await fulfillOrder(pathParam(req, 'id'), auth);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post('/:id/cancel', writeLimiter, optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const order = await cancelOrder(pathParam(req, 'id'), auth, reason);
    res.json({ data: { order } });
  } catch (error) {
    next(error);
  }
});
