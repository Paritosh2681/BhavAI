import { Router } from 'express';
import { getPublicProduct, getPublicStore, listPublicStoreProducts, listPublicStores, searchMarket } from '../services/products.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';
import { pathParam } from '../utils/http.js';

export const publicRouter = Router();
publicRouter.use(publicLimiter);

publicRouter.get('/stores', async (_req, res, next) => {
  try {
    res.setHeader('cache-control', 'public, max-age=20, stale-while-revalidate=40');
    res.json({
      data: {
        stores: await listPublicStores(),
        api: { mcp: '/mcp', protocolVersion: '2025-06-18' },
        llmConfigured: env.gemini.configured,
      },
    });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/stores/:slug', async (req, res, next) => {
  try {
    const store = await getPublicStore(pathParam(req, 'slug'));
    res.setHeader('cache-control', 'public, max-age=30, stale-while-revalidate=60');
    res.json({ data: { store } });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/stores/:slug/products', async (req, res, next) => {
  try {
    const result = await listPublicStoreProducts(pathParam(req, 'slug'), {
      search: typeof req.query.q === 'string' ? req.query.q : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      inStock: req.query.inStock === 'true',
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 24,
    });
    res.setHeader('cache-control', 'public, max-age=20, stale-while-revalidate=40');
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/products/:id', async (req, res, next) => {
  try {
    const product = await getPublicProduct(pathParam(req, 'id'));
    res.setHeader('cache-control', 'public, max-age=20, stale-while-revalidate=40');
    res.json({ data: { product } });
  } catch (error) {
    next(error);
  }
});

publicRouter.get('/market/products', async (req, res, next) => {
  try {
    const result = await searchMarket({
      search: typeof req.query.q === 'string' ? req.query.q : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      maxTotal: req.query.maxTotal ? Number(req.query.maxTotal) : undefined,
      quantity: req.query.quantity ? Number(req.query.quantity) : undefined,
      currency: typeof req.query.currency === 'string' ? req.query.currency : undefined,
      country: typeof req.query.country === 'string' ? req.query.country : undefined,
      inStock: req.query.inStock !== 'false',
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 12,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
