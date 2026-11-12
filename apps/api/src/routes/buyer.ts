import { Router } from 'express';
import { BuyerIntentInput, BuyerProfileInput, roundMoney, formatMoney } from '@bhavai/shared';
import { getDb } from '../db/index.js';
import { optionalAuth, requireBuyer } from '../middleware/auth.js';
import { parseWith } from '../utils/http.js';
import { parseIntent } from '../services/agent.js';
import { searchMarket } from '../services/products.js';
import { listNegotiations } from '../services/negotiation.js';
import { audit } from '../services/audit.js';
import { env } from '../config/env.js';

export const buyerRouter = Router();
buyerRouter.use(optionalAuth);

buyerRouter.get('/profile', async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    res.json({ data: { buyer: auth.buyer, user: auth.user } });
  } catch (error) {
    next(error);
  }
});

buyerRouter.put('/profile', async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(BuyerProfileInput.partial(), req.body);
    const db = await getDb();
    const buyer = auth.buyer;
    const company = input.companyName ?? buyer.companyName;
    const country = input.country?.toUpperCase() ?? buyer.country;
    const currency = input.currency ?? buyer.currency;
    const preferences = input.preferences ?? buyer.preferences;
    await db.query(`UPDATE buyers SET company_name = $1, country = $2, currency = $3, preferences = $4 WHERE id = $5`, [
      company,
      country,
      currency,
      preferences,
      buyer.id,
    ]);
    await db.query(`UPDATE users SET country = $1, currency = $2 WHERE id = $3`, [country, currency, auth.user.id]);
    await audit({
      actor: { id: auth.user.id, role: 'BUYER' },
      action: 'buyer.profile_updated',
      resourceType: 'buyer',
      resourceId: buyer.id,
    });
    res.json({ data: { buyer: { ...buyer, companyName: company, country, currency, preferences } } });
  } catch (error) {
    next(error);
  }
});

buyerRouter.post('/intent', async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(BuyerIntentInput, req.body);
    const intent = await parseIntent(input.query, input.currency ?? auth.buyer.currency);
    const budget = input.budgetTotal ?? intent.budgetTotal;
    res.json({
      data: {
        intent: { ...intent, budgetTotal: budget },
        unitBudget: budget && intent.quantity ? roundMoney(budget / intent.quantity) : null,
        agentMode: intent.mode,
        llmModel: env.gemini.configured ? env.gemini.model : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

buyerRouter.post('/discover', async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const input = parseWith(BuyerIntentInput, req.body);
    const intent = await parseIntent(input.query, input.currency ?? auth.buyer.currency);
    const budgetTotal = input.budgetTotal ?? intent.budgetTotal;
    const currency = (input.currency ?? intent.currency ?? auth.buyer.currency) || auth.buyer.currency;

    const result = await searchMarket({
      search: intent.productQuery,
      category: intent.category ?? undefined,
      currency,
      quantity: intent.quantity,
      maxTotal: budgetTotal ?? undefined,
      inStock: true,
      pageSize: 24,
    });

    const unitBudget = budgetTotal ? roundMoney(budgetTotal / intent.quantity) : null;
    const products = result.products.map((product) => {
      const listedTotal = roundMoney(product.listedPrice * intent.quantity);
      const overBudget = budgetTotal ? listedTotal > budgetTotal : false;
      const negotiableIntoBudget = budgetTotal ? listedTotal <= budgetTotal * 1.35 : false;
      const unitGapPercent =
        unitBudget && product.listedPrice > 0
          ? roundMoney(((product.listedPrice - unitBudget) / product.listedPrice) * 100)
          : null;
      return {
        ...product,
        fit: {
          quantity: intent.quantity,
          listedTotal,
          unitBudget,
          withinListedBudget: !overBudget,
          negotiableIntoBudget,
          unitGapPercent,
          label: !budgetTotal
            ? 'Budget not set'
            : !overBudget
              ? 'Inside budget at list price'
              : negotiableIntoBudget
                ? 'May reach budget through negotiation'
                : 'Above budget',
        },
      };
    });

    products.sort((a, b) => {
      if (a.fit.withinListedBudget !== b.fit.withinListedBudget) return a.fit.withinListedBudget ? -1 : 1;
      if (a.fit.negotiableIntoBudget !== b.fit.negotiableIntoBudget) return a.fit.negotiableIntoBudget ? -1 : 1;
      return a.listedPrice - b.listedPrice;
    });

    res.json({
      data: {
        intent: { ...intent, budgetTotal },
        budget: budgetTotal
          ? {
              total: budgetTotal,
              currency,
              perUnit: unitBudget,
              display: formatMoney(budgetTotal, currency),
            }
          : null,
        products,
        total: result.total,
        agentMode: intent.mode,
        note:
          products.length === 0
            ? 'No published storefront matched that search in this currency. BhavAI does not convert currencies in this build.'
            : 'Offers are negotiated inside each seller’s confidential rules and revalidated server-side.',
      },
    });
  } catch (error) {
    next(error);
  }
});

buyerRouter.get('/summary', async (req, res, next) => {
  try {
    const auth = requireBuyer(req);
    const db = await getDb();
    const [negotiations, orders] = await Promise.all([
      listNegotiations(auth, { pageSize: 5 }),
      db.query(
        `SELECT o.id, o.status, o.payment_state, o.total_amount, o.currency, o.payment_provider, o.market_type,
                o.created_at, o.is_sample, p.name AS product_name, s.business_name
         FROM orders o JOIN deals d ON d.id = o.deal_id JOIN negotiations n ON n.id = d.negotiation_id
         JOIN products p ON p.id = n.product_id JOIN sellers s ON s.id = o.seller_id
         WHERE o.buyer_id = $1 ORDER BY o.created_at DESC LIMIT 5`,
        [auth.buyer.id],
      ),
    ]);
    const counts = await db.query<{ open: number; agreed: number; orders: number }>(
      `SELECT
        (SELECT COUNT(*)::int FROM negotiations WHERE buyer_id = $1 AND status = 'OPEN') AS open,
        (SELECT COUNT(*)::int FROM negotiations WHERE buyer_id = $1 AND status = 'AGREED') AS agreed,
        (SELECT COUNT(*)::int FROM orders WHERE buyer_id = $1) AS orders`,
      [auth.buyer.id],
    );

    const recommended = await searchMarket({
      currency: auth.buyer.currency,
      inStock: true,
      pageSize: 6,
      quantity: 1,
    });

    res.json({
      data: {
        counts: counts[0] ?? { open: 0, agreed: 0, orders: 0 },
        negotiations: negotiations.negotiations,
        orders: orders.map((o) => ({
          id: String(o.id),
          status: String(o.status),
          paymentState: String(o.payment_state),
          totalAmount: Number(o.total_amount),
          currency: String(o.currency),
          paymentProvider: String(o.payment_provider),
          marketType: String(o.market_type),
          createdAt: String(o.created_at),
          isSample: o.is_sample === true,
          productName: String(o.product_name),
          sellerName: String(o.business_name),
        })),
        recommended: recommended.products,
        agentMode: env.gemini.configured ? 'GEMINI' : 'POLICY',
      },
    });
  } catch (error) {
    next(error);
  }
});
