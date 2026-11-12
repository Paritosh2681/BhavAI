import { Router } from 'express';
import { SellerProfileInput } from '@bhavai/shared';
import { getDb, toIso } from '../db/index.js';
import { optionalAuth, requireSeller } from '../middleware/auth.js';
import { parseWith } from '../utils/http.js';
import { conflict } from '../utils/errors.js';
import { uniqueStoreSlug } from '../services/seller.js';
import { getSellerAnalytics } from '../services/analytics.js';
import { listNegotiations } from '../services/negotiation.js';
import { audit } from '../services/audit.js';
import { env } from '../config/env.js';

export const sellerRouter = Router();
sellerRouter.use(optionalAuth);

sellerRouter.get('/profile', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    res.json({ data: { seller: auth.seller, user: auth.user } });
  } catch (error) {
    next(error);
  }
});

sellerRouter.patch('/profile', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(SellerProfileInput.partial(), req.body);
    const db = await getDb();
    const seller = auth.seller;

    if (input.currency && input.currency !== seller.currency) {
      const products = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM products WHERE seller_id = $1`, [seller.id]);
      if (Number(products[0]?.count ?? 0) > 0) {
        throw conflict('Currency cannot change while products exist. Create a new store for a different currency.');
      }
    }

    const slug = input.storeSlug && input.storeSlug !== seller.storeSlug ? await uniqueStoreSlug(input.storeSlug, seller.id) : null;
    const country = input.country ? input.country.toUpperCase() : seller.country;
    const currency = input.currency ?? seller.currency;
    const businessName = input.businessName ?? seller.businessName;
    const description = input.description ?? seller.description;

    await db.query(
      `UPDATE sellers SET business_name = $1, country = $2, currency = $3, store_slug = $4, description = $5,
        updated_at = NOW() WHERE id = $6`,
      [businessName, country, currency, slug ?? seller.storeSlug, description, seller.id],
    );
    await db.query(`UPDATE users SET country = $1, currency = $2 WHERE id = $3`, [country, currency, auth.user.id]);

    await audit({
      actor: { id: auth.user.id, role: 'SELLER' },
      action: 'seller.profile_updated',
      resourceType: 'seller',
      resourceId: seller.id,
      metadata: { storeSlug: slug ?? seller.storeSlug },
    });

    res.json({
      data: {
        seller: { ...seller, businessName, country, currency, storeSlug: slug ?? seller.storeSlug, description },
      },
    });
  } catch (error) {
    next(error);
  }
});

sellerRouter.get('/onboarding', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const db = await getDb();
    const seller = auth.seller;
    const counts = await db.query<{ products: number; active: number; rules: number; rules_confirmed: boolean }>(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE seller_id = $1) AS products,
         (SELECT COUNT(*)::int FROM products WHERE seller_id = $1 AND active = TRUE) AS active,
         (SELECT COUNT(*)::int FROM seller_rules WHERE seller_id = $1) AS rules,
         (SELECT rules_confirmed FROM sellers WHERE id = $1) AS rules_confirmed`,
      [seller.id],
    );
    const row = counts[0] ?? { products: 0, active: 0, rules: 0, rules_confirmed: false };
    const profileComplete = seller.businessName.trim().length > 1 && seller.description.trim().length >= 10;
    const productsComplete = Number(row.products) > 0;
    const rulesComplete = row.rules_confirmed === true;
    const published = seller.active;

    res.json({
      data: {
        seller,
        steps: [
          { id: 'account', label: 'Create your account', complete: true, detail: auth.user.email },
          { id: 'profile', label: 'Describe your business', complete: profileComplete, detail: profileComplete ? 'Business details saved' : 'Add a description of at least 10 characters' },
          { id: 'products', label: 'Add your catalog', complete: productsComplete, detail: `${row.products} product${Number(row.products) === 1 ? '' : 's'} in your catalog` },
          { id: 'rules', label: 'Review pricing rules', complete: rulesComplete, detail: rulesComplete ? 'Confidential rules saved' : 'Review and save negotiation rules' },
          { id: 'publish', label: 'Publish your AI storefront', complete: published, detail: published ? 'Live and agent-readable' : 'Publish when the steps above are ready' },
        ],
        counts: { products: Number(row.products), activeProducts: Number(row.active), rules: Number(row.rules) },
        published,
        storeUrl: `/stores/${seller.storeSlug}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

sellerRouter.post('/publish', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const db = await getDb();
    const seller = auth.seller;
    const stats = await db.query<{ products: number; rules: number; rules_confirmed: boolean }>(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE seller_id = $1 AND active = TRUE) AS products,
         (SELECT COUNT(*)::int FROM seller_rules WHERE seller_id = $1) AS rules,
         (SELECT rules_confirmed FROM sellers WHERE id = $1) AS rules_confirmed`,
      [seller.id],
    );
    const row = stats[0];
    if (seller.description.trim().length < 10) throw conflict('Add a business description before publishing.');
    if (Number(row?.products ?? 0) < 1) throw conflict('Add at least one active product before publishing.');
    if (Number(row?.rules ?? 0) < 1) throw conflict('Set negotiation rules for your products before publishing.');
    if (row?.rules_confirmed !== true) throw conflict('Review and save your negotiation rules before publishing.');

    await db.query(`UPDATE sellers SET active = TRUE, onboarding_complete = TRUE, updated_at = NOW() WHERE id = $1`, [seller.id]);
    await audit({
      actor: { id: auth.user.id, role: 'SELLER' },
      action: 'seller.published',
      resourceType: 'seller',
      resourceId: seller.id,
    });
    res.json({ data: { published: true, storeUrl: `/stores/${seller.storeSlug}`, storefrontApi: `/api/public/stores/${seller.storeSlug}` } });
  } catch (error) {
    next(error);
  }
});

sellerRouter.post('/unpublish', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const db = await getDb();
    await db.query(`UPDATE sellers SET active = FALSE, updated_at = NOW() WHERE id = $1`, [auth.seller.id]);
    res.json({ data: { published: false } });
  } catch (error) {
    next(error);
  }
});

sellerRouter.get('/dashboard', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const [analytics, negotiations] = await Promise.all([
      getSellerAnalytics(auth.seller),
      listNegotiations(auth, { pageSize: 5 }),
    ]);
    const db = await getDb();
    const recentOrders = await db.query(
      `SELECT o.*, bu.name AS customer_name, p.name AS product_name
       FROM orders o JOIN deals d ON d.id = o.deal_id JOIN negotiations n ON n.id = d.negotiation_id
       JOIN products p ON p.id = n.product_id JOIN buyers b ON b.id = o.buyer_id JOIN users bu ON bu.id = b.user_id
       WHERE o.seller_id = $1 ORDER BY o.created_at DESC LIMIT 4`,
      [auth.seller.id],
    );
    res.json({
      data: {
        analytics,
        negotiations: negotiations.negotiations,
        recentOrders: recentOrders.map((o) => ({
          id: String(o.id),
          status: String(o.status),
          paymentProvider: String(o.payment_provider),
          totalAmount: Number(o.total_amount),
          currency: String(o.currency),
          customerName: String(o.customer_name),
          productName: String(o.product_name),
          createdAt: toIso(o.created_at),
          marketType: String(o.market_type),
          isSample: o.is_sample === true,
        })),
        integrations: {
          gemini: env.gemini.configured,
          paypal: env.paypal.configured,
          mcp: true,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});
