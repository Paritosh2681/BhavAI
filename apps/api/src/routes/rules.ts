import { Router } from 'express';
import { z } from 'zod';
import { RulesInput, minimumAllowedPrice, targetPrice, roundMoney } from '@bhavai/shared';
import { optionalAuth, requireSeller } from '../middleware/auth.js';
import { parseWith, pathParam } from '../utils/http.js';
import { getRulesForProduct, listRules, upsertRules, assertRulesConsistent } from '../services/products.js';
import { validateOffer } from '../pricing/engine.js';
import { getDb } from '../db/index.js';

export const rulesRouter = Router();
rulesRouter.use(optionalAuth);

rulesRouter.get('/', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const rules = await listRules(auth.seller.id);
    res.json({ data: { rules, currency: auth.seller.currency } });
  } catch (error) {
    next(error);
  }
});

rulesRouter.post('/validate', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const body = parseWith(
      z.object({
        rules: RulesInput,
        listedPrice: z.coerce.number().positive(),
        sampleUnitPrice: z.coerce.number().positive().optional(),
        sampleQuantity: z.coerce.number().int().positive().optional(),
      }),
      req.body,
    );
    assertRulesConsistent(body.rules, body.listedPrice);
    const policy = {
      listedPrice: body.listedPrice,
      floorPrice: body.rules.floorPrice,
      maxDiscountPercent: body.rules.maxDiscountPercent,
      minimumQuantity: body.rules.minimumQuantity,
      bulkDiscounts: body.rules.bulkDiscounts,
      maxRounds: body.rules.maxRounds,
      autoAcceptThreshold: body.rules.autoAcceptThreshold ?? null,
      requireApprovalBelow: body.rules.requireApprovalBelow ?? null,
    };
    const minimumAllowed = minimumAllowedPrice(policy);
    const target = targetPrice(policy, body.sampleQuantity ?? policy.minimumQuantity);
    const sample =
      body.sampleUnitPrice !== undefined
        ? validateOffer({
            unitPrice: body.sampleUnitPrice,
            quantity: body.sampleQuantity ?? policy.minimumQuantity,
            stock: 1_000_000,
            policy,
          })
        : null;
    res.json({
      data: {
        minimumAllowed,
        target,
        bulkTiers: body.rules.bulkDiscounts,
        sample,
        note: 'The floor price and minimum allowed price are confidential and never returned by buyer-facing APIs.',
      },
    });
  } catch (error) {
    next(error);
  }
});

rulesRouter.get('/:productId', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const rules = await getRulesForProduct(auth.seller.id, pathParam(req, 'productId'));
    const db = await getDb();
    const product = await db.query(`SELECT name, sku, listed_price, currency FROM products WHERE id = $1 AND seller_id = $2`, [
      pathParam(req, 'productId'),
      auth.seller.id,
    ]);
    res.json({
      data: {
        rules,
        product: product[0]
          ? {
              name: String(product[0].name),
              sku: String(product[0].sku),
              listedPrice: roundMoney(Number(product[0].listed_price)),
              currency: String(product[0].currency),
            }
          : null,
        minimumAllowed: minimumAllowedPrice({
          listedPrice: Number(product[0]?.listed_price ?? 0),
          floorPrice: rules.floorPrice,
          maxDiscountPercent: rules.maxDiscountPercent,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
});

rulesRouter.put('/:productId', async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(RulesInput, req.body);
    const rules = await upsertRules(auth.seller.id, pathParam(req, 'productId'), input);
    const db = await getDb();
    await db.query(`UPDATE sellers SET rules_confirmed = TRUE, updated_at = NOW() WHERE id = $1`, [auth.seller.id]);
    res.json({ data: { rules } });
  } catch (error) {
    next(error);
  }
});
