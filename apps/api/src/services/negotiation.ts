import {
  NEGOTIATION_LABEL,
  formatMoney,
  resolveMarket,
  roundMoney,
  type NegotiationDetail,
  type NegotiationSummary,
  type Offer,
  type Deal,
  type OrderSummary,
  type PaymentProvider,
  type PaymentStatus,
  type MarketType,
  type NegotiationStatus,
} from '@bhavai/shared';
import { getDb, toIso, toNumber, type DbClient } from '../db/index.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { newId } from '../utils/crypto.js';
import { money } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import type { AuthContext, BuyerRow, SellerRow } from '../middleware/auth.js';
import { buyerDecision, requiresApproval, sellerDecision, validateOffer } from '../pricing/engine.js';
import { policyFromRules, mapRules, mapProduct } from '../services/products.js';
import type { Product, SellerRules } from '@bhavai/shared';
import { agentMode, buyerAgentMessage, sellerAgentMessage } from './agent.js';
import { audit } from './audit.js';

const NEG_SELECT = `
  SELECT n.*, b.user_id AS buyer_user_id, b.country AS buyer_country, b.company_name AS buyer_company,
         bu.name AS buyer_name, bu.email AS buyer_email,
         s.user_id AS seller_user_id, s.business_name AS seller_name, s.country AS seller_country,
         p.name AS product_name, p.sku AS product_sku, p.category AS product_category, p.stock AS product_stock,
         p.active AS product_active, p.unit AS product_unit, p.images AS product_images, p.description AS product_description,
         d.id AS deal_id, d.agreed_unit_price, d.agreed_quantity, d.total_amount, d.status AS deal_status,
         d.accepted_at, d.buyer_confirmed_at, d.is_sample AS deal_is_sample,
         d.market_type AS deal_market_type, d.currency AS deal_currency,
         o.id AS order_id, o.status AS order_status, o.payment_provider, o.payment_state, o.external_order_id,
         o.settlement_note, o.is_sample AS order_is_sample, o.market_type AS order_market_type,
         o.total_amount AS order_total, o.currency AS order_currency, o.created_at AS order_created_at,
         o.updated_at AS order_updated_at
  FROM negotiations n
  JOIN buyers b ON b.id = n.buyer_id
  JOIN users bu ON bu.id = b.user_id
  JOIN sellers s ON s.id = n.seller_id
  JOIN products p ON p.id = n.product_id
  LEFT JOIN deals d ON d.negotiation_id = n.id
  LEFT JOIN orders o ON o.deal_id = d.id
`;

function mapOffer(row: Record<string, unknown>): Offer {
  return {
    id: String(row.id),
    negotiationId: String(row.negotiation_id),
    submittedBy: row.submitted_by as Offer['submittedBy'],
    agentType: String(row.agent_type ?? 'POLICY'),
    unitPrice: roundMoney(toNumber(row.unit_price)),
    totalPrice: roundMoney(toNumber(row.total_price)),
    quantity: toNumber(row.quantity),
    validationStatus: row.validation_status as Offer['validationStatus'],
    kind: (row.kind as Offer['kind']) ?? 'OFFER',
    message: String(row.message ?? ''),
    explanation: String(row.explanation ?? ''),
    round: toNumber(row.round, 1),
    createdAt: toIso(row.created_at),
  };
}

function mapDeal(row: Record<string, unknown>): Deal {
  return {
    id: String(row.deal_id ?? row.id),
    negotiationId: String(row.negotiation_id),
    agreedUnitPrice: roundMoney(toNumber(row.agreed_unit_price)),
    agreedQuantity: toNumber(row.agreed_quantity),
    totalAmount: roundMoney(toNumber(row.total_amount)),
    currency: String(row.deal_currency ?? row.currency),
    status: row.deal_status as Deal['status'],
    marketType: (row.deal_market_type ?? row.market_type) as MarketType,
    acceptedAt: row.accepted_at ? toIso(row.accepted_at) : null,
    buyerConfirmedAt: row.buyer_confirmed_at ? toIso(row.buyer_confirmed_at) : null,
    createdAt: row.created_at ? toIso(row.created_at) : undefined,
  };
}

function mapOrder(row: Record<string, unknown>): OrderSummary {
  return {
    id: String(row.order_id),
    dealId: String(row.deal_id),
    sellerId: String(row.seller_id),
    buyerId: String(row.buyer_id),
    customerName: row.buyer_name ? String(row.buyer_name) : undefined,
    productName: row.product_name ? String(row.product_name) : undefined,
    paymentProvider: row.payment_provider as PaymentProvider,
    externalOrderId: row.external_order_id ? String(row.external_order_id) : null,
    marketType: row.order_market_type as MarketType,
    status: row.order_status as OrderSummary['status'],
    paymentState: row.payment_state as PaymentStatus,
    totalAmount: roundMoney(toNumber(row.order_total)),
    currency: String(row.order_currency),
    isSample: row.order_is_sample === true,
    settlementNote: row.settlement_note ? String(row.settlement_note) : null,
    createdAt: toIso(row.order_created_at),
    updatedAt: toIso(row.order_updated_at),
  };
}

export function mapNegotiationSummary(row: Record<string, unknown>, currentOffer: Offer | null): NegotiationSummary {
  const agreed = row.deal_status === 'ACCEPTED' || row.deal_status === 'CONSUMED';
  return {
    id: String(row.id),
    status: row.status as NegotiationStatus,
    buyerId: String(row.buyer_id),
    buyerName: String(row.buyer_name),
    buyerCountry: String(row.buyer_country),
    sellerId: String(row.seller_id),
    sellerName: String(row.seller_name),
    sellerCountry: String(row.seller_country),
    productId: String(row.product_id),
    productName: String(row.product_name),
    productSku: String(row.product_sku),
    category: String(row.product_category),
    quantity: toNumber(row.requested_quantity),
    currency: String(row.currency),
    listedPrice: roundMoney(toNumber(row.listed_price)),
    budgetTotal: row.budget_total === null ? null : roundMoney(toNumber(row.budget_total)),
    marketType: row.market_type as MarketType,
    roundsUsed: toNumber(row.rounds_used),
    maxRounds: toNumber(row.max_rounds),
    agentMode: String(row.agent_mode ?? 'POLICY'),
    isSample: row.is_sample === true,
    currentOffer,
    agreedUnitPrice: agreed ? roundMoney(toNumber(row.agreed_unit_price)) : null,
    totalAmount: agreed ? roundMoney(toNumber(row.total_amount)) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function canAccess(row: Record<string, unknown>, auth: AuthContext): boolean {
  if (auth.user.role === 'ADMIN') return true;
  if (auth.buyer && String(row.buyer_user_id) === auth.user.id) return true;
  if (auth.seller && String(row.seller_user_id) === auth.user.id) return true;
  return false;
}

async function loadOffers(negotiationId: string, tx?: DbClient): Promise<Offer[]> {
  const db = tx ?? (await getDb());
  const rows = await db.query(`SELECT * FROM offers WHERE negotiation_id = $1 ORDER BY created_at ASC, round ASC`, [
    negotiationId,
  ]);
  return rows.map(mapOffer);
}

export async function getNegotiationDetail(id: string, auth: AuthContext): Promise<NegotiationDetail> {
  const db = await getDb();
  const rows = await db.query(`${NEG_SELECT} WHERE n.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw notFound('Negotiation not found');
  if (!canAccess(row, auth)) throw forbidden('This negotiation belongs to another business or buyer.');

  if (row.status === 'OPEN' && new Date(toIso(row.expires_at)).getTime() < Date.now()) {
    await db.query(`UPDATE negotiations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1 AND status = 'OPEN'`, [id]);
    row.status = 'EXPIRED';
  }

  const offers = await loadOffers(id);
  const lastOffer = [...offers].reverse().find((o) => o.kind !== 'REJECTION') ?? offers[offers.length - 1] ?? null;
  const rulesRows = await db.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [row.product_id]);
  const rules = rulesRows[0] ? mapRules(rulesRows[0]) : null;
  const deal = row.deal_id
    ? mapDeal({ ...row, negotiation_id: row.id })
    : null;

  return {
    ...mapNegotiationSummary(row, lastOffer),
    offers,
    deal,
    order: row.order_id ? mapOrder(row) : null,
    policy: {
      minimumQuantity: rules?.minimumQuantity ?? 1,
      maxRounds: toNumber(row.max_rounds, 5),
      bulkTiers: (rules?.bulkDiscounts ?? []).map((t) => ({
        minimumQuantity: t.minimumQuantity,
        discountPercent: t.discountPercent,
      })),
      approvalRequired: Boolean(rules?.approvalRequired),
      roundLimitReached: toNumber(row.rounds_used) >= toNumber(row.max_rounds),
    },
    expiresAt: toIso(row.expires_at),
    availableStock: toNumber(row.product_stock),
  };
}

export async function createNegotiation(
  auth: AuthContext & { buyer: BuyerRow },
  input: { productId: string; quantity: number; unitPrice?: number; budgetTotal?: number | null; message?: string },
): Promise<NegotiationDetail> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT p.*, s.business_name, s.store_slug, s.country AS seller_country, s.currency AS seller_currency,
            s.active AS seller_active
     FROM products p JOIN sellers s ON s.id = p.seller_id
     WHERE p.id = $1`,
    [input.productId],
  );
  const row = rows[0];
  if (!row || row.active !== true || row.seller_active !== true) throw notFound('This product is not available.');
  const ruleRows = await db.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [input.productId]);
  if (!ruleRows[0]) throw conflict('This product does not have negotiation rules yet.');

  const product = mapProduct(row);
  const rules = mapRules(ruleRows[0]);
  const policy = policyFromRules(rules, product);

  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw badRequest('Enter a quantity of at least one.');
  if (input.quantity < rules.minimumQuantity) {
    throw badRequest(`This seller’s minimum order is ${rules.minimumQuantity} units.`);
  }
  if (input.quantity > product.stock) {
    throw conflict(`Only ${product.stock} units are in stock. Reduce the quantity or ask the seller.`);
  }
  if (input.unitPrice !== undefined) {
    if (input.unitPrice <= 0 || input.unitPrice > product.listedPrice) {
      throw badRequest('The opening offer must be above zero and no higher than the listed price.');
    }
  }
  if (input.budgetTotal != null && input.budgetTotal <= 0) throw badRequest('Enter a budget above zero.');

  const marketType = resolveMarket(String(row.seller_country), auth.buyer.country);
  const negotiationId = newId();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
        budget_total, market_type, rounds_used, max_rounds, agent_mode, last_actor, is_sample, expires_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,$9,0,$10,$11,NULL,FALSE,$12,NOW(),NOW())`,
      [
        negotiationId,
        auth.buyer.id,
        row.seller_id,
        input.productId,
        input.quantity,
        product.currency,
        product.listedPrice,
        input.budgetTotal ?? null,
        marketType,
        rules.maxRounds,
        agentMode(),
        expiresAt,
      ],
    );

    if (input.unitPrice !== undefined) {
      const check = validateOffer({
        unitPrice: input.unitPrice,
        quantity: input.quantity,
        stock: product.stock,
        policy,
      });
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,$7,'OFFER',$8,$9,1)`,
        [
          newId(),
          negotiationId,
          agentMode(),
          input.unitPrice,
          money(input.unitPrice * input.quantity),
          input.quantity,
          check.code,
          input.message || `Opening offer of ${formatMoney(input.unitPrice, product.currency)} per unit.`,
          check.message,
        ],
      );
      await tx.query(
        `UPDATE negotiations SET rounds_used = 1, last_actor = 'BUYER_AGENT', updated_at = NOW() WHERE id = $1`,
        [negotiationId],
      );
    }
  });

  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: 'negotiation.created',
    resourceType: 'negotiation',
    resourceId: negotiationId,
    metadata: { productId: input.productId, quantity: input.quantity, marketType },
  });

  return getNegotiationDetail(negotiationId, auth);
}

type StepContext = {
  offerId: string | null;
  agent: 'BUYER_AGENT' | 'SELLER_AGENT';
  kind: 'OFFER' | 'ACCEPTANCE' | 'REJECTION';
  decision: 'OFFER' | 'COUNTER' | 'ACCEPT' | 'REJECT';
  unitPrice: number;
  quantity: number;
  currency: string;
  productName: string;
  businessName: string;
  listedPrice: number;
  round: number;
  explanation: string;
  budgetTotal: number | null;
};

async function reserveStock(tx: DbClient, productId: string, quantity: number): Promise<void> {
  const updated = await tx.query(
    `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $1 RETURNING stock`,
    [quantity, productId],
  );
  if (updated.length === 0) {
    throw conflict('Stock changed while this deal was being finalised. The deal was not accepted.');
  }
}

async function createDeal(
  tx: DbClient,
  row: Record<string, unknown>,
  unitPrice: number,
  needsApproval: boolean,
): Promise<void> {
  const quantity = toNumber(row.requested_quantity);
  const currency = String(row.currency);
  const dealId = newId();
  const total = money(unitPrice * quantity);

  if (needsApproval) {
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING_APPROVAL',$7,FALSE,NULL)`,
      [dealId, row.id, unitPrice, quantity, total, currency, row.market_type],
    );
    await tx.query(`UPDATE negotiations SET status = 'AWAITING_APPROVAL', updated_at = NOW() WHERE id = $1`, [row.id]);
  } else {
    await reserveStock(tx, String(row.product_id), quantity);
    await tx.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, is_sample, accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6,'ACCEPTED',$7,FALSE,NOW())`,
      [dealId, row.id, unitPrice, quantity, total, currency, row.market_type],
    );
    await tx.query(`UPDATE negotiations SET status = 'AGREED', updated_at = NOW() WHERE id = $1`, [row.id]);
  }
}

/**
 * Advance a negotiation by exactly one agent move. Turns alternate: the buyer
 * agent opens and responds to counters; the seller agent always answers a buyer
 * offer. Everything is decided by the pricing engine inside a row-locked
 * transaction. Gemini may phrase the message afterwards, never the numbers.
 */
export async function runNegotiationStep(id: string, auth: AuthContext): Promise<NegotiationDetail> {
  const db = await getDb();

  const result = await db.transaction<StepContext | null>(async (tx) => {
    const negRows = await tx.query(`${NEG_SELECT} WHERE n.id = $1 FOR UPDATE OF n`, [id]);
    const row = negRows[0];
    if (!row) throw notFound('Negotiation not found');
    if (!canAccess(row, auth)) throw forbidden('This negotiation belongs to another business or buyer.');

    if (row.status !== 'OPEN') return null;
    if (new Date(toIso(row.expires_at)).getTime() < Date.now()) {
      await tx.query(`UPDATE negotiations SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`, [id]);
      return null;
    }

    const productRows = await tx.query(`SELECT * FROM products WHERE id = $1 FOR UPDATE`, [row.product_id]);
    const product = mapProduct(productRows[0]);
    const rulesRows = await tx.query(`SELECT * FROM seller_rules WHERE product_id = $1`, [row.product_id]);
    if (!rulesRows[0]) throw conflict('Pricing rules are missing for this product.');
    const rules = mapRules(rulesRows[0]);
    const policy = policyFromRules(rules, product);

    // Invalid attempts are kept in the history but are not moves: the agents
    // answer the last valid offer, and humans on either side count as their side.
    const offers = (await loadOffers(id, tx)).filter((o) => o.validationStatus === 'VALID');
    const isBuyerSide = (o: Offer) => o.submittedBy === 'BUYER' || o.submittedBy === 'BUYER_AGENT';
    const isSellerSide = (o: Offer) => o.submittedBy === 'SELLER' || o.submittedBy === 'SELLER_AGENT';
    const lastOffer = offers[offers.length - 1] ?? null;
    const lastBuyer = [...offers].reverse().find((o) => isBuyerSide(o) && o.kind === 'OFFER') ?? null;
    const lastSeller = [...offers].reverse().find((o) => isSellerSide(o) && o.kind === 'OFFER') ?? null;

    const buyerTurn = !lastOffer || isSellerSide(lastOffer) || lastOffer.kind === 'ACCEPTANCE';
    const quantity = toNumber(row.requested_quantity);
    const currency = String(row.currency);
    const listedPrice = roundMoney(toNumber(row.listed_price));
    const budgetTotal = row.budget_total === null ? null : toNumber(row.budget_total);
    const round = Math.max(1, toNumber(row.rounds_used));

    /* ---------------------------- buyer move ---------------------------- */
    if (buyerTurn) {
      const buyerRound = toNumber(row.rounds_used) + 1;
      const decision = buyerDecision({
        listedPrice,
        sellerUnitPrice: lastSeller?.unitPrice ?? null,
        quantity,
        budgetTotal,
        previousOwnOffer: lastBuyer?.unitPrice ?? null,
        round: buyerRound,
        maxRounds: rules.maxRounds,
      });

      if (decision.type === 'ACCEPT' && lastSeller) {
        const offerId = newId();
        await tx.query(
          `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
           VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,'VALID','ACCEPTANCE',$7,$8,$9)`,
          [
            offerId,
            id,
            agentMode(),
            lastSeller.unitPrice,
            money(lastSeller.unitPrice * quantity),
            quantity,
            `Accepted at ${formatMoney(lastSeller.unitPrice, currency)} per unit.`,
            decision.explanation,
            lastSeller.round,
          ],
        );
        const needsApproval = rules.approvalRequired || requiresApproval(policy, lastSeller.unitPrice);
        await createDeal(tx, row, lastSeller.unitPrice, needsApproval);
        await tx.query(`UPDATE negotiations SET last_actor = 'BUYER_AGENT', updated_at = NOW() WHERE id = $1`, [id]);
        return {
          offerId,
          agent: 'BUYER_AGENT',
          kind: 'ACCEPTANCE',
          decision: 'ACCEPT',
          unitPrice: lastSeller.unitPrice,
          quantity,
          currency,
          productName: String(row.product_name),
          businessName: String(row.seller_name),
          listedPrice,
          round: lastSeller.round,
          explanation: decision.explanation,
          budgetTotal,
        };
      }

      if (decision.type === 'REJECT' || decision.unitPrice === null) {
        const reference = lastSeller?.unitPrice ?? lastBuyer?.unitPrice ?? listedPrice;
        const offerId = newId();
        await tx.query(
          `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
           VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,'VALID','REJECTION',$7,$8,$9)`,
          [
            offerId,
            id,
            agentMode(),
            reference,
            money(reference * quantity),
            quantity,
            'The buyer ended the negotiation without a deal.',
            decision.explanation,
            round,
          ],
        );
        await tx.query(
          `UPDATE negotiations SET status = 'REJECTED', last_actor = 'BUYER_AGENT', updated_at = NOW() WHERE id = $1`,
          [id],
        );
        return {
          offerId,
          agent: 'BUYER_AGENT',
          kind: 'REJECTION',
          decision: 'REJECT',
          unitPrice: reference,
          quantity,
          currency,
          productName: String(row.product_name),
          businessName: String(row.seller_name),
          listedPrice,
          round,
          explanation: decision.explanation,
          budgetTotal,
        };
      }

      const unitPrice = roundMoney(decision.unitPrice);
      const check = validateOffer({ unitPrice, quantity, stock: product.stock, policy });
      const offerId = newId();
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'BUYER_AGENT',$3,$4,$5,$6,$7,'OFFER',$8,$9,$10)`,
        [
          offerId,
          id,
          agentMode(),
          unitPrice,
          money(unitPrice * quantity),
          quantity,
          check.code,
          `Offering ${formatMoney(unitPrice, currency)} per unit for ${quantity} units.`,
          decision.explanation,
          buyerRound,
        ],
      );
      await tx.query(
        `UPDATE negotiations SET rounds_used = $1, last_actor = 'BUYER_AGENT', agent_mode = $2, updated_at = NOW() WHERE id = $3`,
        [buyerRound, agentMode(), id],
      );
      return {
        offerId,
        agent: 'BUYER_AGENT',
        kind: 'OFFER',
        decision: 'OFFER',
        unitPrice,
        quantity,
        currency,
        productName: String(row.product_name),
        businessName: String(row.seller_name),
        listedPrice,
        round: buyerRound,
        explanation: decision.explanation,
        budgetTotal,
      };
    }

    /* ---------------------------- seller move --------------------------- */
    if (!lastBuyer) throw conflict('The buyer has not placed an offer yet.');
    const decision = sellerDecision({
      offerUnitPrice: lastBuyer.unitPrice,
      quantity,
      stock: product.stock,
      policy,
      round: lastBuyer.round,
    });

    if (decision.type === 'ACCEPT') {
      const offerId = newId();
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'SELLER_AGENT',$3,$4,$5,$6,'VALID','ACCEPTANCE',$7,$8,$9)`,
        [
          offerId,
          id,
          agentMode(),
          decision.unitPrice,
          money(decision.unitPrice * quantity),
          quantity,
          `Accepted at ${formatMoney(decision.unitPrice, currency)} per unit.`,
          decision.explanation,
          lastBuyer.round,
        ],
      );
      const needsApproval = rules.approvalRequired || requiresApproval(policy, decision.unitPrice);
      await createDeal(tx, row, decision.unitPrice, needsApproval);
      await tx.query(`UPDATE negotiations SET last_actor = 'SELLER_AGENT', updated_at = NOW() WHERE id = $1`, [id]);
      return {
        offerId,
        agent: 'SELLER_AGENT',
        kind: 'ACCEPTANCE',
        decision: 'ACCEPT',
        unitPrice: decision.unitPrice,
        quantity,
        currency,
        productName: String(row.product_name),
        businessName: String(row.seller_name),
        listedPrice,
        round: lastBuyer.round,
        explanation: decision.explanation,
        budgetTotal,
      };
    }

    if (decision.type === 'REJECT') {
      const offerId = newId();
      await tx.query(
        `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
         VALUES ($1,$2,'SELLER_AGENT',$3,$4,$5,$6,$7,'REJECTION',$8,$9,$10)`,
        [
          offerId,
          id,
          agentMode(),
          lastBuyer.unitPrice,
          money(lastBuyer.unitPrice * quantity),
          quantity,
          lastBuyer.validationStatus,
          'The seller ended the negotiation without a deal.',
          decision.explanation,
          lastBuyer.round,
        ],
      );
      await tx.query(
        `UPDATE negotiations SET status = 'REJECTED', last_actor = 'SELLER_AGENT', updated_at = NOW() WHERE id = $1`,
        [id],
      );
      return {
        offerId,
        agent: 'SELLER_AGENT',
        kind: 'REJECTION',
        decision: 'REJECT',
        unitPrice: lastBuyer.unitPrice,
        quantity,
        currency,
        productName: String(row.product_name),
        businessName: String(row.seller_name),
        listedPrice,
        round: lastBuyer.round,
        explanation: decision.explanation,
        budgetTotal,
      };
    }

    const counter = roundMoney(decision.unitPrice);
    const counterCheck = validateOffer({ unitPrice: counter, quantity, stock: product.stock, policy });
    if (!counterCheck.valid) {
      logger.error('counter_outside_authority', { negotiationId: id, counter });
      throw new Error('Generated counteroffer failed authoritative validation');
    }
    const offerId = newId();
    await tx.query(
      `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round)
       VALUES ($1,$2,'SELLER_AGENT',$3,$4,$5,$6,'VALID','OFFER',$7,$8,$9)`,
      [
        offerId,
        id,
        agentMode(),
        counter,
        money(counter * quantity),
        quantity,
        `Countering at ${formatMoney(counter, currency)} per unit.`,
        decision.explanation,
        lastBuyer.round,
      ],
    );
    await tx.query(`UPDATE negotiations SET last_actor = 'SELLER_AGENT', agent_mode = $1, updated_at = NOW() WHERE id = $2`, [
      agentMode(),
      id,
    ]);
    return {
      offerId,
      agent: 'SELLER_AGENT',
      kind: 'OFFER',
      decision: 'COUNTER',
      unitPrice: counter,
      quantity,
      currency,
      productName: String(row.product_name),
      businessName: String(row.seller_name),
      listedPrice,
      round: lastBuyer.round,
      explanation: decision.explanation,
      budgetTotal,
    };
  });

  if (result && result.offerId) {
    // Language is generated after the decision is committed and cannot change
    // the numbers. On failure the deterministic message stays in place.
    try {
      const generated =
        result.agent === 'SELLER_AGENT'
          ? await sellerAgentMessage({
              businessName: result.businessName,
              productName: result.productName,
              quantity: result.quantity,
              currency: result.currency,
              listedPrice: result.listedPrice,
              unitPrice: result.unitPrice,
              round: result.round,
              decision: result.decision === 'ACCEPT' ? 'ACCEPT' : result.decision === 'REJECT' ? 'REJECT' : 'COUNTER',
              explanation: result.explanation,
            })
          : await buyerAgentMessage({
              productName: result.productName,
              quantity: result.quantity,
              unitPrice: result.unitPrice,
              currency: result.currency,
              round: result.round,
              decision: result.decision === 'ACCEPT' ? 'ACCEPT' : result.decision === 'REJECT' ? 'REJECT' : 'OFFER',
              budgetTotal: result.budgetTotal,
              explanation: result.explanation,
            });
      if (generated.mode === 'GEMINI') {
        await db.query(`UPDATE offers SET message = $1, agent_type = 'GEMINI' WHERE id = $2`, [
          generated.message,
          result.offerId,
        ]);
      }
    } catch (error) {
      logger.warn('agent_message_fallback', { message: (error as Error).message });
    }
  }

  return getNegotiationDetail(id, auth);
}

export async function listNegotiations(
  auth: AuthContext,
  filters: { status?: string; search?: string; page?: number; pageSize?: number },
) {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (auth.buyer) {
    params.push(auth.buyer.id);
    where.push(`n.buyer_id = $${params.length}`);
  } else if (auth.seller) {
    params.push(auth.seller.id);
    where.push(`n.seller_id = $${params.length}`);
  } else {
    where.push('1=0');
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`n.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(COALESCE(bu.name,'')) LIKE $${params.length})`);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const rows = await db.query(
    `${NEG_SELECT} WHERE ${where.join(' AND ')} ORDER BY n.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM negotiations n
     JOIN products p ON p.id = n.product_id
     JOIN buyers b ON b.id = n.buyer_id JOIN users bu ON bu.id = b.user_id
     WHERE ${where.join(' AND ')}`,
    params,
  );

  const ids = rows.map((r) => String(r.id));
  const latest = new Map<string, Offer>();
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const offerRows = await db.query(
      `SELECT DISTINCT ON (negotiation_id) * FROM offers WHERE negotiation_id IN (${placeholders})
       ORDER BY negotiation_id, created_at DESC, round DESC`,
      ids,
    );
    for (const offerRow of offerRows) latest.set(String(offerRow.negotiation_id), mapOffer(offerRow));
  }

  return {
    negotiations: rows.map((row) => {
      const summary = mapNegotiationSummary(row, latest.get(String(row.id)) ?? null);
      return {
        ...summary,
        orderStatus: row.order_status ? String(row.order_status) : null,
        orderId: row.order_id ? String(row.order_id) : null,
        paymentProvider: row.payment_provider ? String(row.payment_provider) : null,
      };
    }),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function confirmDeal(id: string, auth: AuthContext & { buyer: BuyerRow }) {
  const db = await getDb();
  const detail = await getNegotiationDetail(id, auth);
  if (!detail.deal) throw conflict('There is no agreed deal to confirm yet.');
  if (detail.deal.status !== 'ACCEPTED') throw conflict('This deal is not ready for confirmation.');
  if (detail.status !== 'AGREED') throw conflict('This negotiation is not in an agreed state.');

  await db.query(
    `UPDATE deals SET buyer_confirmed_at = COALESCE(buyer_confirmed_at, NOW()) WHERE id = $1`,
    [detail.deal.id],
  );
  await audit({
    actor: { id: auth.user.id, role: 'BUYER' },
    action: 'deal.confirmed',
    resourceType: 'deal',
    resourceId: detail.deal.id,
    metadata: { total: detail.deal.totalAmount, currency: detail.deal.currency },
  });
  return getNegotiationDetail(id, auth);
}

export async function approveDeal(id: string, auth: AuthContext & { seller: SellerRow }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const rows = await tx.query(`${NEG_SELECT} WHERE n.id = $1 FOR UPDATE OF n`, [id]);
    const row = rows[0];
    if (!row) throw notFound('Negotiation not found');
    if (String(row.seller_user_id) !== auth.user.id) throw forbidden('Only the seller can approve this deal.');
    if (row.deal_status !== 'PENDING_APPROVAL') throw conflict('This deal is not awaiting seller approval.');
    const productRows = await tx.query(`SELECT * FROM products WHERE id = $1 FOR UPDATE`, [row.product_id]);
    const product = mapProduct(productRows[0]);
    if (product.stock < toNumber(row.agreed_quantity)) {
      throw conflict('Not enough stock remains to approve this deal. Restock or reject the deal.');
    }
    await reserveStock(tx, product.id, toNumber(row.agreed_quantity));
    await tx.query(`UPDATE deals SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = $1`, [row.deal_id]);
    await tx.query(`UPDATE negotiations SET status = 'AGREED', updated_at = NOW() WHERE id = $1`, [id]);
  });

  await audit({
    actor: { id: auth.user.id, role: 'SELLER' },
    action: 'deal.approved',
    resourceType: 'negotiation',
    resourceId: id,
  });
  return getNegotiationDetail(id, auth);
}

export async function rejectNegotiation(id: string, auth: AuthContext, reason?: string) {
  const detail = await getNegotiationDetail(id, auth);
  if (!['OPEN', 'AWAITING_APPROVAL'].includes(detail.status)) {
    throw conflict('This negotiation can no longer be rejected.');
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (detail.deal && detail.deal.status === 'PENDING_APPROVAL') {
      await tx.query(`UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING_APPROVAL'`, [detail.deal.id]);
    }
    await tx.query(
      `UPDATE negotiations SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 AND status IN ('OPEN','AWAITING_APPROVAL')`,
      [id],
    );
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: 'negotiation.rejected',
    resourceType: 'negotiation',
    resourceId: id,
    metadata: { reason: reason ?? null },
  });
  return getNegotiationDetail(id, auth);
}

export async function cancelNegotiation(id: string, auth: AuthContext, reason?: string) {
  const detail = await getNegotiationDetail(id, auth);
  if (detail.order && ['PAID', 'SETTLED', 'FULFILLED'].includes(detail.order.status)) {
    throw conflict('A paid order cannot be cancelled here.');
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    // Payment capture and cancellation serialize on the payment row.
    if (detail.deal) {
      const payRows = await tx.query(
        `SELECT status FROM payments WHERE order_id IN (SELECT id FROM orders WHERE deal_id = $1) FOR UPDATE`,
        [detail.deal.id],
      );
      if (payRows.some((p) => p.status === 'COMPLETED')) {
        throw conflict('This order is already paid. Refund handling is out of scope for this Sandbox build.');
      }
    }
    if (detail.deal) {
      const rows = await tx.query(
        `UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'ACCEPTED' RETURNING agreed_quantity, negotiation_id`,
        [detail.deal.id],
      );
      if (rows[0]) {
        await tx.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [
          toNumber(rows[0].agreed_quantity),
          detail.productId,
        ]);
      } else {
        await tx.query(`UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING_APPROVAL'`, [
          detail.deal.id,
        ]);
      }
    }
    if (detail.order) {
      await tx.query(
        `UPDATE orders SET status = 'CANCELLED', payment_state = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('PAID','SETTLED','FULFILLED')`,
        [detail.order.id],
      );
      await tx.query(`UPDATE payments SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1 AND status <> 'COMPLETED'`, [
        detail.order.id,
      ]);
    }
    await tx.query(
      `UPDATE negotiations SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND status IN ('OPEN','AWAITING_APPROVAL','AGREED')`,
      [id],
    );
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: 'negotiation.cancelled',
    resourceType: 'negotiation',
    resourceId: id,
    metadata: { reason: reason ?? null },
  });
  return getNegotiationDetail(id, auth);
}

export async function getNegotiationForPayment(id: string, auth: AuthContext): Promise<NegotiationDetail> {
  const detail = await getNegotiationDetail(id, auth);
  if (!detail.deal) throw conflict('No deal exists for this negotiation.');
  if (detail.deal.status !== 'ACCEPTED') throw conflict('The deal must be accepted before payment.');
  return detail;
}

export const NEGOTIATION_STATUSES = Object.keys(NEGOTIATION_LABEL);
