import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestDb, resetDb, type TestDb } from '../test/db.js';
import type { AuthContext } from '../middleware/auth.js';

const { createOrderMock, captureMock, orderMock } = vi.hoisted(() => ({
  createOrderMock: vi.fn(),
  captureMock: vi.fn(),
  orderMock: vi.fn(),
}));

vi.mock('../payments/paypal.js', () => ({
  createPayPalOrder: createOrderMock,
  capturePayPalOrder: captureMock,
  getPayPalOrder: orderMock,
  approvalUrl: (order: { links?: Array<{ rel: string; href: string }> } | string) =>
    typeof order === 'string'
      ? `https://paypal.test/checkoutnow?token=${order}`
      : (order.links?.find((l) => l.rel === 'approve')?.href ?? null),
  PayPalError: class PayPalError extends Error {
    status: number;
    constructor(message: string, status = 502) {
      super(message);
      this.status = status;
    }
  },
}));

let harness: TestDb;
let orders: typeof import('./orders.js');

const buyerAuth: AuthContext = {
  user: { id: 'u-buyer', email: 'buyer@test.local', name: 'Test Buyer', role: 'BUYER', country: 'US', currency: 'USD' },
  seller: null,
  buyer: { id: 'b1', userId: 'u-buyer', companyName: 'Test Co', country: 'US', currency: 'USD', preferences: '' },
  source: 'session',
};

beforeAll(async () => {
  harness = await createTestDb();
  orders = await import('./orders.js');
}, 30_000);

afterAll(async () => {
  await harness.close();
}, 30_000);

beforeEach(async () => {
  await resetDb(harness.db);
  createOrderMock.mockReset();
  captureMock.mockReset();
  orderMock.mockReset();
  createOrderMock.mockResolvedValue({
    id: 'PAYPAL-ORDER-NEW',
    status: 'CREATED',
    links: [{ rel: 'approve', href: 'https://paypal.test/checkoutnow?token=PAYPAL-ORDER-NEW' }],
  });
  captureMock.mockResolvedValue({
    id: 'CAP-1',
    status: 'COMPLETED',
    purchase_units: [
      { payments: { captures: [{ id: 'CAP-1', amount: { value: '100.00', currency_code: 'USD' } }] } },
    ],
  });
});

async function seedPayment(opts: { orderStatus?: string; orderPaymentState?: string; paymentStatus?: string } = {}) {
  const db = harness.db;
  await db.query(
    `INSERT INTO users (id, email, password_hash, name, role, country, currency) VALUES
       ('u-seller','seller@test.local','x','Test Seller','SELLER','US','USD'),
       ('u-buyer','buyer@test.local','x','Test Buyer','BUYER','US','USD')`,
  );
  await db.query(
    `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, onboarding_complete)
     VALUES ('s1','u-seller','Test Store','US','USD','test-store',TRUE)`,
  );
  await db.query(
    `INSERT INTO buyers (id, user_id, company_name, country, currency) VALUES ('b1','u-buyer','Test Co','US','USD')`,
  );
  await db.query(
    `INSERT INTO products (id, seller_id, name, sku, category, listed_price, currency, stock, unit, country_of_origin)
     VALUES ('p1','s1','Test Product','SKU-1','Home',100.00,'USD',10,'piece','IN')`,
  );
  await db.query(
    `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, max_rounds)
     VALUES ('r1','s1','p1',70.00,30,1,5)`,
  );
  await db.query(
    `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
       market_type, rounds_used, max_rounds, last_actor, expires_at)
     VALUES ('n1','b1','s1','p1','AGREED',1,'USD',100.00,'CROSS_BORDER',1,5,'SELLER_AGENT',NOW() + INTERVAL '1 day')`,
  );
  await db.query(
    `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, accepted_at)
     VALUES ('d1','n1',100.00,1,100.00,'USD','ACCEPTED','CROSS_BORDER',NOW())`,
  );
  await db.query(
    `INSERT INTO orders (id, deal_id, seller_id, buyer_id, payment_provider, external_order_id, market_type, status, payment_state, total_amount, currency)
     VALUES ('o1','d1','s1','b1','PAYPAL','PAYPAL-ORDER-1','CROSS_BORDER',$1,$2,100.00,'USD')`,
    [opts.orderStatus ?? 'PENDING_PAYMENT', opts.orderPaymentState ?? 'APPROVED'],
  );
  await db.query(
    `INSERT INTO payments (id, order_id, provider, provider_order_id, amount, currency, status)
     VALUES ('pay1','o1','PAYPAL','PAYPAL-ORDER-1',100.00,'USD',$1)`,
    [opts.paymentStatus ?? 'APPROVED'],
  );
}

async function state() {
  const [order] = await harness.db.query<{ status: string; payment_state: string }>(
    `SELECT status, payment_state FROM orders WHERE id = 'o1'`,
  );
  const [payment] = await harness.db.query<{ status: string }>(`SELECT status FROM payments WHERE id = 'pay1'`);
  const [deal] = await harness.db.query<{ status: string }>(`SELECT status FROM deals WHERE id = 'd1'`);
  const [product] = await harness.db.query<{ stock: number }>(`SELECT stock FROM products WHERE id = 'p1'`);
  return {
    order: order.status,
    orderPaymentState: order.payment_state,
    payment: payment.status,
    deal: deal.status,
    stock: Number(product.stock),
  };
}

function captureEvent(eventId = 'evt-1') {
  return {
    id: eventId,
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAP-9',
      amount: { value: '100.00', currency_code: 'USD' },
      supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } },
    },
  };
}

describe('payment completion guards', () => {
  it('marks a valid capture paid and consumes the deal', async () => {
    await seedPayment();
    const result = await orders.capturePayment('pay1', buyerAuth);

    expect(result.payment.status).toBe('COMPLETED');
    expect(await state()).toMatchObject({
      order: 'PAID',
      orderPaymentState: 'COMPLETED',
      payment: 'COMPLETED',
      deal: 'CONSUMED',
      stock: 10,
    });
    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent on duplicate capture', async () => {
    await seedPayment();
    await orders.capturePayment('pay1', buyerAuth);
    await orders.capturePayment('pay1', buyerAuth);

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(await state()).toMatchObject({ order: 'PAID', deal: 'CONSUMED' });
  });

  it('refuses to capture a cancelled order', async () => {
    await seedPayment({ orderStatus: 'CANCELLED', orderPaymentState: 'CANCELLED', paymentStatus: 'CANCELLED' });

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 409 });
    expect(captureMock).not.toHaveBeenCalled();
    expect(await state()).toMatchObject({ order: 'CANCELLED', payment: 'CANCELLED', deal: 'ACCEPTED' });
  });

  it('refuses to capture a failed order', async () => {
    await seedPayment({ orderStatus: 'FAILED', orderPaymentState: 'FAILED', paymentStatus: 'FAILED' });

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 409 });
    expect(captureMock).not.toHaveBeenCalled();
    expect(await state()).toMatchObject({ order: 'FAILED', deal: 'ACCEPTED' });
  });

  it('refuses to capture a cancelled payment on an active order', async () => {
    await seedPayment({ paymentStatus: 'CANCELLED' });

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 409 });
    expect(captureMock).not.toHaveBeenCalled();
    expect(await state()).toMatchObject({ order: 'PENDING_PAYMENT', payment: 'CANCELLED', deal: 'ACCEPTED' });
  });

  it('records a capture webhook that arrives after cancellation as refund-required', async () => {
    await seedPayment({ orderStatus: 'CANCELLED', orderPaymentState: 'CANCELLED', paymentStatus: 'CANCELLED' });

    await orders.handlePayPalWebhookEvent(captureEvent(), 'PROCESSED');

    expect(await state()).toMatchObject({
      order: 'CANCELLED',
      orderPaymentState: 'CANCELLED',
      payment: 'COMPLETED',
      deal: 'ACCEPTED',
    });
    const audits = await harness.db.query<{ action: string }>(`SELECT action FROM audit_logs WHERE resource_id = 'pay1'`);
    expect(audits.map((a) => a.action)).toContain('payment.refund_required');
  });

  it('does not revive a cancelled order when the cancelled payment completes', async () => {
    await seedPayment({ paymentStatus: 'CANCELLED' });

    await orders.handlePayPalWebhookEvent(captureEvent('evt-2'), 'PROCESSED');

    expect(await state()).toMatchObject({ order: 'PENDING_PAYMENT', payment: 'COMPLETED', deal: 'ACCEPTED' });
  });

  it('reconciles a capture after cancellation without reviving the sale', async () => {
    await seedPayment({ orderStatus: 'CANCELLED', orderPaymentState: 'CANCELLED', paymentStatus: 'CANCELLED' });
    orderMock.mockResolvedValue({
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: 'CAP-9' }] } }],
    });

    await expect(orders.reconcilePayPal('PAYPAL-ORDER-1', 'pay1')).resolves.toBe(true);
    expect(await state()).toMatchObject({ order: 'CANCELLED', payment: 'COMPLETED', deal: 'ACCEPTED' });
  });

  it('serializes capture then cancel', async () => {
    await seedPayment();
    await orders.capturePayment('pay1', buyerAuth);

    await expect(orders.cancelOrder('o1', buyerAuth, 'race')).rejects.toMatchObject({ status: 409 });
    expect(await state()).toMatchObject({ order: 'PAID', payment: 'COMPLETED', deal: 'CONSUMED', stock: 10 });
  });

  it('serializes cancel then capture', async () => {
    await seedPayment();
    await orders.cancelOrder('o1', buyerAuth, 'race');

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 409 });
    expect(await state()).toMatchObject({ order: 'CANCELLED', payment: 'CANCELLED', deal: 'CANCELLED', stock: 11 });
  });

  it('keeps order unpaid on CHECKOUT.ORDER.APPROVED webhook without capture', async () => {
    await seedPayment({ orderStatus: 'APPROVAL_PENDING', orderPaymentState: 'APPROVAL_PENDING', paymentStatus: 'APPROVAL_PENDING' });

    await orders.handlePayPalWebhookEvent(
      { id: 'evt-approve-1', event_type: 'CHECKOUT.ORDER.APPROVED', resource: { id: 'PAYPAL-ORDER-1' } },
      'PROCESSED',
    );

    expect(await state()).toMatchObject({
      order: 'APPROVAL_PENDING',
      orderPaymentState: 'APPROVED',
      payment: 'APPROVED',
      deal: 'ACCEPTED',
    });
  });

  it('rejects capture when captured amount does not match local payment', async () => {
    await seedPayment();
    captureMock.mockResolvedValueOnce({
      id: 'CAP-WRONG-AMT',
      status: 'COMPLETED',
      purchase_units: [
        { payments: { captures: [{ id: 'CAP-WRONG-AMT', amount: { value: '50.00', currency_code: 'USD' } }] } },
      ],
    });

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 409 });
    expect(await state()).toMatchObject({ order: 'PENDING_PAYMENT', payment: 'FAILED', deal: 'ACCEPTED' });
  });

  it('rejects capture when captured currency does not match local payment', async () => {
    await seedPayment();
    captureMock.mockResolvedValueOnce({
      id: 'CAP-WRONG-CUR',
      status: 'COMPLETED',
      purchase_units: [
        { payments: { captures: [{ id: 'CAP-WRONG-CUR', amount: { value: '100.00', currency_code: 'EUR' } }] } },
      ],
    });

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 409 });
    expect(await state()).toMatchObject({ order: 'PENDING_PAYMENT', payment: 'FAILED', deal: 'ACCEPTED' });
  });

  it('rejects capture webhook with mismatched amount without marking paid', async () => {
    await seedPayment();
    await expect(
      orders.handlePayPalWebhookEvent(
        {
          id: 'evt-bad-amt',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'CAP-BAD',
            amount: { value: '10.00', currency_code: 'USD' },
            supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } },
          },
        },
        'PROCESSED',
      ),
    ).rejects.toThrow(/did not match/i);

    expect(await state()).toMatchObject({ order: 'PENDING_PAYMENT', payment: 'APPROVED', deal: 'ACCEPTED' });
  });

  it('marks payment FAILED on capture timeout / PayPal API unavailable when reconcile is false', async () => {
    await seedPayment();
    captureMock.mockRejectedValueOnce(new Error('PayPal request timed out'));
    orderMock.mockResolvedValueOnce({ status: 'APPROVED', purchase_units: [] });

    await expect(orders.capturePayment('pay1', buyerAuth)).rejects.toMatchObject({ status: 502, code: 'PAYPAL_ERROR' });
    expect(await state()).toMatchObject({ order: 'PENDING_PAYMENT', orderPaymentState: 'FAILED', payment: 'FAILED' });
  });

  it('persists full capture payload on completion', async () => {
    await seedPayment();
    await orders.capturePayment('pay1', buyerAuth);

    const [row] = await harness.db.query<{ payload: Record<string, unknown> }>(`SELECT payload FROM payments WHERE id = 'pay1'`);
    expect(row.payload).toHaveProperty('capture');
  });

  it('handles PAYMENT.CAPTURE.REFUNDED webhook by cancelling order and recording audit', async () => {
    await seedPayment();
    await orders.capturePayment('pay1', buyerAuth);

    await orders.handlePayPalWebhookEvent(
      {
        id: 'evt-refund-1',
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: {
          id: 'REFUND-1',
          supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } },
        },
      },
      'PROCESSED',
    );

    expect(await state()).toMatchObject({ order: 'CANCELLED', orderPaymentState: 'CANCELLED', payment: 'CANCELLED' });
    const audits = await harness.db.query<{ action: string }>(`SELECT action FROM audit_logs WHERE resource_id = 'pay1'`);
    expect(audits.map((a) => a.action)).toContain('payment.refunded');
  });

  it('marks order and payment FAILED when PayPal order creation fails', async () => {
    const db = harness.db;
    await db.query(
      `INSERT INTO users (id, email, password_hash, name, role, country, currency) VALUES
         ('u-seller','seller@test.local','x','Test Seller','SELLER','IN','USD'),
         ('u-buyer','buyer@test.local','x','Test Buyer','BUYER','US','USD')`,
    );
    await db.query(
      `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, onboarding_complete)
       VALUES ('s1','u-seller','Test Store','IN','USD','test-store',TRUE)`,
    );
    await db.query(
      `INSERT INTO buyers (id, user_id, company_name, country, currency) VALUES ('b1','u-buyer','Test Co','US','USD')`,
    );
    await db.query(
      `INSERT INTO products (id, seller_id, name, sku, category, listed_price, currency, stock, unit, country_of_origin)
       VALUES ('p1','s1','Test Product','SKU-1','Home',100.00,'USD',10,'piece','IN')`,
    );
    await db.query(
      `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, max_rounds)
       VALUES ('r1','s1','p1',70.00,30,1,5)`,
    );
    await db.query(
      `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
         market_type, rounds_used, max_rounds, last_actor, expires_at)
       VALUES ('n1','b1','s1','p1','AGREED',1,'USD',100.00,'CROSS_BORDER',1,5,'SELLER_AGENT',NOW() + INTERVAL '1 day')`,
    );
    await db.query(
      `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, accepted_at, buyer_confirmed_at)
       VALUES ('d1','n1',100.00,1,100.00,'USD','ACCEPTED','CROSS_BORDER',NOW(),NOW())`,
    );

    const { env } = await import('../config/env.js');
    const prevId = env.paypal.clientId;
    const prevSecret = env.paypal.clientSecret;
    const prevConfigured = env.paypal.configured;
    (env.paypal as { clientId: string; clientSecret: string; configured: boolean }).clientId = 'test-id';
    (env.paypal as { clientId: string; clientSecret: string; configured: boolean }).clientSecret = 'test-secret';
    (env.paypal as { clientId: string; clientSecret: string; configured: boolean }).configured = true;
    createOrderMock.mockRejectedValueOnce(new Error('PayPal create failed'));

    try {
      await expect(orders.createPaymentForDeal('n1', buyerAuth as never, 'http://localhost:5173')).rejects.toMatchObject({
        status: 502,
      });
      const [ord] = await db.query<{ status: string }>(`SELECT status FROM orders WHERE deal_id = 'd1'`);
      expect(ord.status).toBe('FAILED');
    } finally {
      (env.paypal as { clientId: string; clientSecret: string; configured: boolean }).clientId = prevId;
      (env.paypal as { clientId: string; clientSecret: string; configured: boolean }).clientSecret = prevSecret;
      (env.paypal as { clientId: string; clientSecret: string; configured: boolean }).configured = prevConfigured;
    }
  });
});
