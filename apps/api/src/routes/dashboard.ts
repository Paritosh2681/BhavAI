import { Router } from 'express';
import { optionalAuth, requireSeller } from '../middleware/auth.js';
import {
  getNegotiationRows,
  getProductPerformance,
  getSellerAnalytics,
  getTransactionRows,
} from '../services/analytics.js';
import { env } from '../config/env.js';

export const dashboardRouter = Router();
dashboardRouter.use(optionalAuth);

/**
 * One call for the seller analytics workspace: summary, AG Grid rows and the
 * agent mode. Every number is computed from the seller's own rows; sample data
 * is flagged rather than blended silently.
 */
dashboardRouter.get('/analytics', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const [analytics, negotiations, products, transactions] = await Promise.all([
      getSellerAnalytics(auth.seller),
      getNegotiationRows(auth.seller.id),
      getProductPerformance(auth.seller.id),
      getTransactionRows(auth.seller.id),
    ]);
    res.json({
      data: {
        analytics,
        negotiations,
        products,
        transactions,
        generatedAt: new Date().toISOString(),
        agentMode: analytics.aiSummary.mode,
        llmConfigured: env.gemini.configured,
        currency: auth.seller.currency,
      },
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/negotiations', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { rows: await getNegotiationRows(auth.seller.id) } });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/products', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { rows: await getProductPerformance(auth.seller.id) } });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get('/transactions', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { rows: await getTransactionRows(auth.seller.id) } });
  } catch (error) {
    next(error);
  }
});
