import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '../test/db.js';

const { captured } = vi.hoisted(() => ({
  captured: [] as Array<Record<string, unknown>>,
}));

vi.mock('./agent.js', () => ({
  analyticsNarrative: async (input: Record<string, unknown>) => {
    captured.push(input);
    return { text: 'ok', mode: 'POLICY' };
  },
}));

let harness: TestDb;
let getSellerAnalytics: typeof import('./analytics.js')['getSellerAnalytics'];

beforeAll(async () => {
  harness = await createTestDb();
  ({ getSellerAnalytics } = await import('./analytics.js'));
  const db = harness.db;
  await db.query(
    `INSERT INTO users (id, email, password_hash, name, role, country, currency) VALUES
       ('u-seller','seller@test.local','x','Test Seller','SELLER','US','USD'),
       ('u-buyer','buyer@test.local','x','Test Buyer','BUYER','US','USD')`,
  );
  await db.query(
    `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, active, onboarding_complete)
     VALUES ('s1','u-seller','Test Store','US','USD','test-store',TRUE,TRUE)`,
  );
  await db.query(
    `INSERT INTO buyers (id, user_id, company_name, country, currency) VALUES ('b1','u-buyer','Test Co','US','USD')`,
  );
  await db.query(
    `INSERT INTO products (id, seller_id, name, sku, category, listed_price, currency, stock, unit, country_of_origin, active)
     VALUES ('p1','s1','Test Product','SKU-1','Home',100.00,'USD',10,'piece','IN',TRUE)`,
  );
  await db.query(
    `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
       market_type, rounds_used, max_rounds, last_actor, expires_at)
     VALUES
       ('n1','b1','s1','p1','AGREED',1,'USD',100.00,'CROSS_BORDER',1,5,'SELLER_AGENT',NOW() + INTERVAL '1 day'),
       ('n2','b1','s1','p1','AGREED',1,'USD',100.00,'CROSS_BORDER',1,5,'SELLER_AGENT',NOW() + INTERVAL '1 day')`,
  );
  await db.query(
    `INSERT INTO deals (id, negotiation_id, agreed_unit_price, agreed_quantity, total_amount, currency, status, market_type, accepted_at)
     VALUES
       ('d1','n1',100.00,1,100.00,'USD','ACCEPTED','CROSS_BORDER',NOW()),
       ('d2','n2',250.00,1,250.00,'USD','ACCEPTED','CROSS_BORDER',NOW() - INTERVAL '10 days')`,
  );
  await db.query(
    `INSERT INTO orders (id, deal_id, seller_id, buyer_id, payment_provider, external_order_id, market_type, status, payment_state, total_amount, currency, created_at)
     VALUES
       ('o-today','d1','s1','b1','PAYPAL','PAYPAL-1','CROSS_BORDER','PAID','COMPLETED',100.00,'USD',NOW()),
       ('o-old','d2','s1','b1','PAYPAL','PAYPAL-2','CROSS_BORDER','PAID','COMPLETED',250.00,'USD',NOW() - INTERVAL '10 days')`,
  );
}, 30_000);

afterAll(async () => {
  await harness?.close();
}, 30_000);

describe('analytics narrative inputs', () => {
  it('reports today\'s revenue as today, not the last seven days', async () => {
    const seller = (await harness.db.query(`SELECT * FROM sellers WHERE id = 's1'`))[0];
    const summary = await getSellerAnalytics(seller as never);
    const input = captured.at(-1) as { salesToday: number; salesTotal: number };
    expect(input.salesTotal).toBe(350);
    expect(input.salesToday).toBe(100);
    expect(summary.totals.totalSales).toBe(350);
  });
});
