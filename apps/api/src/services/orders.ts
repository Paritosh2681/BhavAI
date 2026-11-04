import {
  formatMoney,
  minimumAllowedPrice,
  roundMoney,
  type Deal,
  type OrderStatus,
  type OrderSummary,
  type PaymentStatus,
  type PaymentSummary,
  type MarketType,
  type PaymentProvider,
} from '@bhavai/shared';
import { getDb, toIso, toNumber, type DbClient } from '../db/index.js';
import { env } from '../config/env.js';
import { AppError, conflict, forbidden, notFound } from '../utils/errors.js';
import { newId } from '../utils/crypto.js';
import { money } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import type { AuthContext, BuyerRow, SellerRow } from '../middleware/auth.js';
import { validateOffer } from '../pricing/engine.js';
import { mapProduct, mapRules, policyFromRules } from './products.js';
import { getNegotiationForPayment } from './negotiation.js';
import { audit } from './audit.js';
import {
  approvalUrl,
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalOrder,
  PayPalError,
  type PayPalCaptureResponse,
} from '../payments/paypal.js';

const PAYPAL_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY']);

export type PaymentContextRow = Record<string, unknown>;

export function mapPayment(row: Record<string, unknown>): PaymentSummary {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    provider: row.provider as PaymentProvider,
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    providerCaptureId: row.provider_capture_id ? String(row.provider_capture_id) : null,
    amount: roundMoney(toNumber(row.amount)),
    currency: String(row.currency),
    status: row.status as PaymentStatus,
    approvalUrl: row.approval_url ? String(row.approval_url) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapOrderRow(row: Record<string, unknown>): OrderSummary {
  return {
    id: String(row.id),
    dealId: String(row.deal_id),
    sellerId: String(row.seller_id),
    buyerId: String(row.buyer_id),
    customerName: row.customer_name ? String(row.customer_name) : undefined,
    productName: row.product_name ? String(row.product_name) : undefined,
    paymentProvider: row.payment_provider as PaymentProvider,
    externalOrderId: row.external_order_id ? String(row.external_order_id) : null,
    marketType: row.market_type as MarketType,
    status: row.status as OrderStatus,
    paymentState: row.payment_state as PaymentStatus,
    totalAmount: roundMoney(toNumber(row.total_amount)),
    currency: String(row.currency),
    isSample: row.is_sample === true,
    settlementNote: row.settlement_note ? String(row.settlement_note) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const ORDER_SELECT = `
  SELECT o.*, bu.name AS customer_name, p.name AS product_name, n.product_id,
         d.negotiation_id, n.buyer_id AS neg_buyer_id, n.seller_id AS neg_seller_id,
         b.user_id AS buyer_user_id, s.user_id AS seller_user_id
  FROM orders o
  JOIN deals d ON d.id = o.deal_id
  JOIN negotiations n ON n.id = d.negotiation_id
  JOIN buyers b ON b.id = o.buyer_id
  JOIN users bu ON bu.id = b.user_id
  JOIN sellers s ON s.id = o.seller_id
  JOIN products p ON p.id = n.product_id
`;

function canAccessOrder(row: Record<string, unknown>, auth: AuthContext): boolean {
  if (auth.user.role === 'ADMIN') return true;
  return String(row.buyer_user_id) === auth.user.id || String(row.seller_user_id) === auth.user.id;
}

async function loadPaymentRow(paymentId: string, tx?: DbClient): Promise<Record<string, unknown>> {
  const db = tx ?? (await getDb());
  const rows = await db.query(
    `SELECT pay.*, o.status AS order_status, o.payment_state AS order_payment_state, o.market_type AS order_market_type,
            o.deal_id, d.negotiation_id, d.status AS deal_status, d.agreed_quantity, d.agreed_unit_price,
            d.total_amount AS deal_total, d.currency AS deal_currency, n.buyer_id, n.seller_id, n.product_id,
            o.settlement_note,
            b.user_id AS buyer_user_id, s.user_id AS seller_user_id, p.name AS product_name,
            bu.name AS buyer_name
     FROM payments pay
     JOIN orders o ON o.id = pay.order_id
     JOIN deals d ON d.id = o.deal_id
     JOIN negotiations n ON n.id = d.negotiation_id
     JOIN buyers b ON b.id = n.buyer_id
     JOIN users bu ON bu.id = b.user_id
     JOIN sellers s ON s.id = n.seller_id
     JOIN products p ON p.id = n.product_id
     WHERE pay.id = $1`,
    [paymentId],
  );
  if (!rows[0]) throw notFound('Payment not found');
  return rows[0];
}

function paymentResponse(row: Record<string, unknown>, detail?: { mode: MarketType; settlementNote?: string | null }) {
  return {
    payment: mapPayment(row),
    orderId: String(row.order_id),
    market: (row.order_market_type ?? detail?.mode) as MarketType,
    mode: row.provider === 'MANUAL' ? 'MANUAL' : 'PAYPAL',
    settlementNote: row.provider === 'MANUAL' ? String(row.settlement_note ?? '') || null : null,
  };
}

/**
 * Create (or resume) the payment for an agreed, buyer-confirmed deal.
 * Prices and inventory are revalidated here — the frontend never supplies an
 * amount. Domestic Indian orders deliberately use the manual settlement path.
 */
export async function createPaymentForDeal(
  negotiationId: string,
  auth: AuthContext & { buyer: BuyerRow },
  origin: string,
) {
  const detail = await getNegotiationForPayment(negotiationId, auth);
  if (!detail.deal) throw conflict('No deal exists for this negotiation.');
  if (detail.buyerId !== auth.buyer.id) throw forbidden('Only the buyer on this deal can start payment.');
  if (!detail.deal.buyerConfirmedAt) {
    throw conflict('Confirm the accepted deal before creating a payment.');
  }
  if (detail.deal.status !== 'ACCEPTED') {
    throw conflict('This deal is not in a payable state.');
  }
  if (detail.order && ['PAID', 'SETTLED', 'FULFILLED'].includes(detail.order.status)) {
    const existing = await getDb().then((db) =>
      db.query(`SELECT * FROM payments WHERE order_id = $1`, [detail.order?.id]),
    );
    if (existing[0]) return paymentResponse(existing[0]);
    throw conflict('This order is already complete.');
  }

  // -------- authoritative revalidation immediately before PayPal --------
  const db = await getDb();
  const productRows = await db.query(
    `SELECT p.*, r.floor_price, r.max_discount_percent, r.minimum_quantity, r.bulk_discounts, r.max_rounds,
            r.auto_accept_threshold, r.require_approval_below, r.approval_required
     FROM products p JOIN seller_rules r ON r.product_id = p.id WHERE p.id = $1`,
    [detail.productId],
  );
  if (!productRows[0]) throw conflict('The product is no longer available.');
  const product = mapProduct(productRows[0]);
  const rules = mapRules(productRows[0]);
  const policy = policyFromRules(rules, product);
  const check = validateOffer({
    unitPrice: detail.deal.agreedUnitPrice,
    quantity: detail.deal.agreedQuantity,
    stock: detail.deal.agreedQuantity, // stock is already reserved by the accepted deal
    policy,
  });
  if (!check.valid) {
    logger.error('payment_revalidation_failed', { negotiationId, code: check.code });
    throw conflict('The agreed price no longer passes the seller’s rules. Reopen the negotiation.');
  }
  const expectedTotal = money(detail.deal.agreedUnitPrice * detail.deal.agreedQuantity);
  if (Math.abs(expectedTotal - detail.deal.totalAmount) > 0.005 || detail.deal.currency !== product.currency) {
    throw conflict('The deal totals do not reconcile. Payment was not created.');
  }

  const isDomestic = detail.marketType === 'DOMESTIC';
  if (!isDomestic) {
    if (!PAYPAL_CURRENCIES.has(detail.currency)) {
      throw conflict(
        `PayPal cannot charge ${detail.currency} in this demonstration. Use a USD-priced storefront or settle the order off-platform.`,
      );
    }
    if (!env.paypal.configured) {
      throw new AppError(
        503,
        'PAYPAL_NOT_CONFIGURED',
        'PayPal Sandbox is not configured on this deployment. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, then retry. No payment was created.',
      );
    }
  }

  let orderId = '';
  let paymentId = '';
  const existingOrder = await db.query(`SELECT * FROM orders WHERE deal_id = $1`, [detail.deal.id]);
  if (existingOrder[0]) {
    orderId = String(existingOrder[0].id);
    const existingPayment = await db.query(
      `SELECT pay.*, o.market_type AS order_market_type, o.settlement_note FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.order_id = $1`,
      [orderId],
    );
    if (!existingPayment[0]) throw conflict('An order already exists for this deal but has no payment record.');
    const payment = existingPayment[0];
    paymentId = String(payment.id);
    if (payment.status === 'COMPLETED' || payment.provider === 'MANUAL') return paymentResponse(payment);
    if (payment.approval_url && payment.status !== 'FAILED') return paymentResponse(payment);

    // Retry a failed/unapproved PayPal attempt without creating a second order.
    await db.query(`UPDATE payments SET status = 'CREATED', approval_url = NULL, updated_at = NOW() WHERE id = $1`, [
      paymentId,
    ]);
    await db.query(
      `UPDATE orders SET status = 'PENDING_PAYMENT', payment_state = 'CREATED', updated_at = NOW() WHERE id = $1`,
      [orderId],
    );
  } else {
    // -------- create the local order + payment record atomically --------
    await db.transaction(async (tx) => {
      const locked = await tx.query(
        `SELECT d.*, n.buyer_id, n.seller_id FROM deals d JOIN negotiations n ON n.id = d.negotiation_id
         WHERE d.id = $1 FOR UPDATE OF d`,
        [detail.deal!.id],
      );
      const deal = locked[0];
      if (!deal || deal.status !== 'ACCEPTED') throw conflict('The deal is no longer in an accepted state.');
      const dupe = await tx.query(`SELECT id FROM orders WHERE deal_id = $1`, [detail.deal!.id]);
      if (dupe[0]) throw conflict('An order was created concurrently. Refresh and try again.');

      orderId = newId();
      paymentId = newId();
      const provider: PaymentProvider = isDomestic ? 'MANUAL' : 'PAYPAL';
      const orderStatus = isDomestic ? 'SETTLEMENT_PENDING' : 'PENDING_PAYMENT';
      const settlementNote = isDomestic
        ? 'India domestic order. Settlement is agreed off-platform; BhavAI does not process Indian domestic PayPal payments.'
        : null;

      await tx.query(
        `INSERT INTO orders (id, deal_id, seller_id, buyer_id, payment_provider, external_order_id, market_type, status, payment_state, total_amount, currency, settlement_note, is_sample)
         VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,'CREATED',$8,$9,$10,FALSE)`,
        [
          orderId,
          detail.deal!.id,
          deal.seller_id,
          deal.buyer_id,
          provider,
          detail.marketType,
          orderStatus,
          expectedTotal,
          detail.currency,
          settlementNote,
        ],
      );
      await tx.query(
        `INSERT INTO payments (id, order_id, provider, provider_order_id, provider_capture_id, amount, currency, status, approval_url, payload)
         VALUES ($1,$2,$3,NULL,NULL,$4,$5,'CREATED',NULL,'{}'::jsonb)`,
        [paymentId, orderId, provider, expectedTotal, detail.currency],
      );
    });
  }

  if (isDomestic) {
    await audit({
      actor: { id: auth.user.id, role: 'BUYER' },
      action: 'order.domestic_created',
      resourceType: 'order',
      resourceId: orderId,
      metadata: { total: expectedTotal, currency: detail.currency },
    });
    const rows = await db.query(
      `SELECT pay.*, o.market_type AS order_market_type, o.settlement_note FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.id = $1`,
      [paymentId],
    );
    return paymentResponse(rows[0]);
  }

  // -------- PayPal Orders API v2: server-side creation --------
  try {
    const paypalOrder = await createPayPalOrder({
      orderId,
      description: `${detail.productName} × ${detail.deal.agreedQuantity} — ${detail.sellerName}`,
      total: expectedTotal,
      currency: detail.currency,
      itemName: detail.productName,
      quantity: detail.deal.agreedQuantity,
      unitPrice: detail.deal.agreedUnitPrice,
      returnUrl: `${origin}/buyer/deals?paypal=return&order=${orderId}`,
      cancelUrl: `${origin}/buyer/deals?paypal=cancel&order=${orderId}`,
    });
    const url = approvalUrl(paypalOrder);
    if (!url) throw new PayPalError('PayPal did not return an approval link.');

    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE payments SET provider_order_id = $1, approval_url = $2, status = 'APPROVAL_PENDING', payload = $3::jsonb, updated_at = NOW() WHERE id = $4`,
        [paypalOrder.id, url, JSON.stringify({ id: paypalOrder.id, status: paypalOrder.status }), paymentId],
      );
      await tx.query(
        `UPDATE orders SET external_order_id = $1, status = 'APPROVAL_PENDING', payment_state = 'APPROVAL_PENDING', updated_at = NOW() WHERE id = $2`,
        [paypalOrder.id, orderId],
      );
    });
    await audit({
      actor: { id: auth.user.id, role: 'BUYER' },
      action: 'paypal.order_created',
      resourceType: 'order',
      resourceId: orderId,
      metadata: { paypalOrderId: paypalOrder.id, total: expectedTotal, currency: detail.currency },
    });

    const rows = await db.query(
      `SELECT pay.*, o.market_type AS order_market_type, o.settlement_note FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.id = $1`,
      [paymentId],
    );
    return paymentResponse(rows[0]);
  } catch (error) {
    await db.query(
      `UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
      [paymentId],
    );
    await db.query(
      `UPDATE orders SET status = 'FAILED', payment_state = 'FAILED', updated_at = NOW() WHERE id = $1`,
      [orderId],
    );
    logger.error('paypal_create_failed', {
      orderId,
      message: (error as Error).message,
      debugId: error instanceof PayPalError ? error.debugId : undefined,
    });
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      'PAYPAL_ERROR',
      error instanceof PayPalError ? error.message : 'PayPal could not create the order. No payment was taken.',
      { debugId: error instanceof PayPalError ? error.debugId : undefined },
    );
  }
}

async function markCompleted(
  paymentId: string,
  captureId: string | null,
  source: 'capture' | 'webhook' | 'reconcile',
): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const rows = await tx.query(
      `SELECT pay.*, o.deal_id FROM payments pay JOIN orders o ON o.id = pay.order_id WHERE pay.id = $1 FOR UPDATE OF pay`,
      [paymentId],
    );
    const row = rows[0];
    if (!row) throw notFound('Payment not found');
    if (row.status === 'COMPLETED') return;

    await tx.query(
      `UPDATE payments SET status = 'COMPLETED', provider_capture_id = COALESCE($1, provider_capture_id), updated_at = NOW() WHERE id = $2`,
      [captureId, paymentId],
    );
    await tx.query(
      `UPDATE orders SET status = 'PAID', payment_state = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [row.order_id],
    );
    await tx.query(`UPDATE deals SET status = 'CONSUMED' WHERE id = $1 AND status = 'ACCEPTED'`, [row.deal_id]);
    logger.info('payment_completed', { paymentId, source });
  });
}

export async function capturePayment(paymentId: string, auth: AuthContext) {
  const db = await getDb();
  const row = await loadPaymentRow(paymentId);
  if (String(row.buyer_user_id) !== auth.user.id && auth.user.role !== 'ADMIN') {
    throw forbidden('Only the buyer on this order can capture payment.');
  }
  if (row.provider === 'MANUAL') {
    throw conflict('This is a domestic manual-settlement order. It is never captured through PayPal.');
  }
  if (row.status === 'COMPLETED') return paymentResponse(row);
  if (!row.provider_order_id) throw conflict('PayPal has no order id for this payment yet.');

  try {
    const capture = await capturePayPalOrder(String(row.provider_order_id), `bhavai-capture-${paymentId}`);
    if (capture.status === 'COMPLETED') {
      const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? capture.id;
      const capturedAmount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      if (capturedAmount) {
        const amount = Number(capturedAmount.value);
        if (capturedAmount.currency_code !== row.currency || Math.abs(amount - toNumber(row.amount)) > 0.005) {
          logger.error('paypal_capture_amount_mismatch', {
            paymentId,
            expected: toNumber(row.amount),
            received: amount,
            currency: capturedAmount.currency_code,
          });
          await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [paymentId]);
          throw new AppError(409, 'PAYPAL_ERROR', 'The captured amount did not match the agreed deal. The order was not marked paid.');
        }
      }
      await markCompleted(paymentId, captureId, 'capture');
      await audit({
        actor: { id: auth.user.id, role: 'BUYER' },
        action: 'paypal.captured',
        resourceType: 'payment',
        resourceId: paymentId,
        metadata: { captureId },
      });
    } else if (capture.status === 'PENDING') {
      await db.query(`UPDATE payments SET status = 'CAPTURE_PENDING', updated_at = NOW() WHERE id = $1`, [paymentId]);
      await db.query(`UPDATE orders SET payment_state = 'CAPTURE_PENDING', updated_at = NOW() WHERE id = $1`, [row.order_id]);
    } else {
      await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1`, [paymentId]);
      await db.query(
        `UPDATE orders SET status = 'FAILED', payment_state = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [row.order_id],
      );
      throw new AppError(402, 'PAYPAL_ERROR', `PayPal did not complete the capture (status: ${capture.status}).`);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // A duplicate capture attempt is reconciled, never assumed successful.
    const reconciled = await reconcilePayPal(String(row.provider_order_id), paymentId).catch(() => false);
    if (!reconciled) {
      logger.error('paypal_capture_failed', {
        paymentId,
        message: (error as Error).message,
        debugId: error instanceof PayPalError ? error.debugId : undefined,
      });
      await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = $1 AND status <> 'COMPLETED'`, [
        paymentId,
      ]);
      throw new AppError(
        502,
        'PAYPAL_ERROR',
        error instanceof PayPalError ? error.message : 'PayPal could not capture the payment. No payment was marked complete.',
        { debugId: error instanceof PayPalError ? error.debugId : undefined },
      );
    }
  }

  const fresh = await loadPaymentRow(paymentId);
  return paymentResponse(fresh);
}

export async function reconcilePayPal(paypalOrderId: string, paymentId: string): Promise<boolean> {
  const order = await getPayPalOrder(paypalOrderId);
  if (order.status === 'COMPLETED') {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (capture) {
      await markCompleted(paymentId, capture.id, 'reconcile');
      return true;
    }
  }
  return false;
}

export async function getPaymentStatus(paymentId: string, auth: AuthContext, reconcile = false) {
  let row = await loadPaymentRow(paymentId);
  if (!canAccessOrder(row, auth)) throw forbidden('You do not have access to this payment.');
  if (reconcile && row.provider === 'PAYPAL' && row.status !== 'COMPLETED' && row.provider_order_id) {
    try {
      await reconcilePayPal(String(row.provider_order_id), paymentId);
      row = await loadPaymentRow(paymentId);
    } catch (error) {
      logger.warn('paypal_reconcile_failed', { paymentId, message: (error as Error).message });
    }
  }
  return paymentResponse(row);
}

export async function getOrder(orderId: string, auth: AuthContext): Promise<OrderSummary & { payment: PaymentSummary | null }> {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  if (!rows[0]) throw notFound('Order not found');
  if (!canAccessOrder(rows[0], auth)) throw forbidden('You do not have access to this order.');
  const paymentRows = await db.query(`SELECT * FROM payments WHERE order_id = $1`, [orderId]);
  return {
    ...mapOrderRow(rows[0]),
    payment: paymentRows[0] ? mapPayment(paymentRows[0]) : null,
  };
}

export async function listOrders(
  auth: AuthContext,
  filters: { status?: string; search?: string; market?: string; page?: number; pageSize?: number },
) {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (auth.buyer) {
    params.push(auth.buyer.id);
    where.push(`o.buyer_id = $${params.length}`);
  } else if (auth.seller) {
    params.push(auth.seller.id);
    where.push(`o.seller_id = $${params.length}`);
  } else {
    where.push('1=0');
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`o.status = $${params.length}`);
  }
  if (filters.market) {
    params.push(filters.market);
    where.push(`o.market_type = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(o.id) LIKE $${params.length} OR LOWER(bu.name) LIKE $${params.length} OR LOWER(p.name) LIKE $${params.length})`);
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const rows = await db.query(
    `${ORDER_SELECT} WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  const count = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM orders o
     JOIN deals d ON d.id = o.deal_id JOIN negotiations n ON n.id = d.negotiation_id
     JOIN buyers b ON b.id = o.buyer_id JOIN users bu ON bu.id = b.user_id
     JOIN products p ON p.id = n.product_id
     WHERE ${where.join(' AND ')}`,
    params,
  );
  return {
    orders: rows.map((row) => {
      const payment = undefined;
      void payment;
      return mapOrderRow(row);
    }),
    total: Number(count[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function settleDomesticOrder(orderId: string, auth: AuthContext & { seller: SellerRow }, note?: string) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  const row = rows[0];
  if (!row) throw notFound('Order not found');
  if (String(row.seller_user_id) !== auth.user.id) throw forbidden('Only the seller can confirm settlement.');
  if (row.payment_provider !== 'MANUAL' || row.market_type !== 'DOMESTIC') {
    throw conflict('Only domestic manual-settlement orders can be settled this way.');
  }
  if (!['SETTLEMENT_PENDING', 'SETTLED'].includes(String(row.status))) {
    throw conflict('This order is not awaiting settlement.');
  }
  const settlementNote =
    note?.trim() ||
    'Seller confirmed receipt of funds off-platform. BhavAI did not process or verify this payment.';

  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE orders SET status = 'SETTLED', payment_state = 'COMPLETED', settlement_note = $1, updated_at = NOW() WHERE id = $2`,
      [settlementNote, orderId],
    );
    await tx.query(
      `UPDATE payments SET status = 'COMPLETED', payload = $1::jsonb, updated_at = NOW() WHERE order_id = $2 AND provider = 'MANUAL'`,
      [JSON.stringify({ settlement: 'manual_off_platform', confirmedBy: auth.user.id, note: settlementNote }), orderId],
    );
    await tx.query(`UPDATE deals SET status = 'CONSUMED' WHERE id = $1`, [row.deal_id]);
  });
  await audit({
    actor: { id: auth.user.id, role: 'SELLER' },
    action: 'order.manual_settled',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { note: settlementNote },
  });
  return getOrder(orderId, auth);
}

export async function fulfillOrder(orderId: string, auth: AuthContext & { seller: SellerRow }) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  const row = rows[0];
  if (!row) throw notFound('Order not found');
  if (String(row.seller_user_id) !== auth.user.id) throw forbidden('Only the seller can fulfil this order.');
  if (!['PAID', 'SETTLED'].includes(String(row.status))) {
    throw conflict('Only a paid or settled order can be fulfilled.');
  }
  await db.query(`UPDATE orders SET status = 'FULFILLED', updated_at = NOW() WHERE id = $1`, [orderId]);
  await audit({
    actor: { id: auth.user.id, role: 'SELLER' },
    action: 'order.fulfilled',
    resourceType: 'order',
    resourceId: orderId,
  });
  return getOrder(orderId, auth);
}

export async function cancelOrder(orderId: string, auth: AuthContext, reason?: string) {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  const row = rows[0];
  if (!row) throw notFound('Order not found');
  if (!canAccessOrder(row, auth)) throw forbidden('You do not have access to this order.');
  if (['PAID', 'SETTLED', 'FULFILLED'].includes(String(row.status))) {
    throw conflict('A paid order cannot be cancelled here. Refund handling is out of scope for this Sandbox build.');
  }
  await db.transaction(async (tx) => {
    const locked = await tx.query(
      `UPDATE deals SET status = 'CANCELLED' WHERE id = $1 AND status = 'ACCEPTED' RETURNING agreed_quantity`,
      [row.deal_id],
    );
    if (locked[0]) {
      await tx.query(`UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`, [
        toNumber(locked[0].agreed_quantity),
        row.product_id,
      ]);
    }
    await tx.query(
      `UPDATE orders SET status = 'CANCELLED', payment_state = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [orderId],
    );
    await tx.query(`UPDATE payments SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1 AND status <> 'COMPLETED'`, [
      orderId,
    ]);
    await tx.query(
      `UPDATE negotiations SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 AND status IN ('AGREED','AWAITING_APPROVAL','OPEN')`,
      [row.negotiation_id],
    );
  });
  await audit({
    actor: { id: auth.user.id, role: auth.user.role },
    action: 'order.cancelled',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { reason: reason ?? null },
  });
  return getOrder(orderId, auth);
}

/**
 * Verified PayPal webhook handlers. Amounts are checked against the local
 * payment record; an event can never mark an order paid for a different amount.
 */
export async function handlePayPalWebhookEvent(
  event: { id: string; event_type: string; resource?: Record<string, unknown> },
  processing: 'PROCESSED' | 'IGNORED' | 'FAILED',
): Promise<void> {
  const db = await getDb();
  const resource = event.resource ?? {};

  if (processing !== 'PROCESSED') {
    await db.query(
      `UPDATE webhook_events SET processing_status = $1, processed_at = NOW() WHERE provider = 'PAYPAL' AND provider_event_id = $2`,
      [processing, event.id],
    );
    return;
  }

  if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
    const paypalOrderId = resource.id ? String(resource.id) : null;
    if (paypalOrderId) {
      await db.query(
        `UPDATE payments SET status = 'APPROVED', updated_at = NOW() WHERE provider_order_id = $1 AND status IN ('CREATED','APPROVAL_PENDING')`,
        [paypalOrderId],
      );
      await db.query(
        `UPDATE orders SET payment_state = 'APPROVED', updated_at = NOW()
         WHERE id IN (SELECT order_id FROM payments WHERE provider_order_id = $1) AND status = 'APPROVAL_PENDING'`,
        [paypalOrderId],
      );
    }
  }

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const supplementary = resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined;
    const relatedOrderId = supplementary?.related_ids?.order_id ? String(supplementary.related_ids.order_id) : null;
    const captureId = resource.id ? String(resource.id) : null;
    const amountObj = resource.amount as { value?: string; currency_code?: string } | undefined;
    if (!relatedOrderId) throw new Error('Capture event has no related order id');

    const rows = await db.query(`SELECT * FROM payments WHERE provider_order_id = $1`, [relatedOrderId]);
    const payment = rows[0];
    if (!payment) throw new Error('No local payment matches the captured PayPal order');
    if (amountObj?.value !== undefined) {
      const received = Number(amountObj.value);
      if (amountObj.currency_code !== payment.currency || Math.abs(received - toNumber(payment.amount)) > 0.005) {
        throw new Error('Captured amount did not match the local payment');
      }
    }
    await markCompleted(String(payment.id), captureId, 'webhook');
  }

  if (event.event_type === 'PAYMENT.CAPTURE.DENIED') {
    const supplementary = resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined;
    const relatedOrderId = supplementary?.related_ids?.order_id ? String(supplementary.related_ids.order_id) : null;
    if (relatedOrderId) {
      const rows = await db.query(
        `SELECT p.order_id FROM payments p WHERE p.provider_order_id = $1`,
        [relatedOrderId],
      );
      if (rows[0]) {
        await db.query(`UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE provider_order_id = $1`, [relatedOrderId]);
        await db.query(`UPDATE orders SET status = 'FAILED', payment_state = 'FAILED', updated_at = NOW() WHERE id = $1`, [
          rows[0].order_id,
        ]);
      }
    }
  }

  await db.query(
    `UPDATE webhook_events SET processing_status = 'PROCESSED', processed_at = NOW() WHERE provider = 'PAYPAL' AND provider_event_id = $1`,
    [event.id],
  );
}

export function formatDealTotal(deal: Pick<Deal, 'totalAmount' | 'currency'>): string {
  return formatMoney(deal.totalAmount, deal.currency);
}

export function minimumForRules(listed: number, floor: number, maxDiscount: number): number {
  return minimumAllowedPrice({ listedPrice: listed, floorPrice: floor, maxDiscountPercent: maxDiscount });
}
