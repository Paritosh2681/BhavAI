import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthContext, BuyerRow } from '../middleware/auth.js';
import { createTestDb, resetDb, type TestDb } from '../test/db.js';

let harness: TestDb;
let submitBuyerOffer: typeof import('./negotiation-offers.js')['submitBuyerOffer'];
let runNegotiationStep: typeof import('./negotiation.js')['runNegotiationStep'];

const auth: AuthContext & { buyer: BuyerRow } = {
  user: { id: 'u-buyer', email: 'buyer@test.local', name: 'Test Buyer', role: 'BUYER', country: 'US', currency: 'USD' },
  seller: null,
  buyer: { id: 'b1', userId: 'u-buyer', companyName: 'Test Co', country: 'US', currency: 'USD', preferences: '' },
  source: 'session',
};

async function seed(roundsUsed = 1) {
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
     VALUES ('r1','s1','p1',70.00,30,1,2)`,
  );
  await db.query(
    `INSERT INTO negotiations (id, buyer_id, seller_id, product_id, status, requested_quantity, currency, listed_price,
       market_type, rounds_used, max_rounds, last_actor, expires_at)
     VALUES ('n1','b1','s1','p1','OPEN',1,'USD',100.00,'CROSS_BORDER',$1,2,'BUYER_AGENT',NOW() + INTERVAL '1 day')`,
    [roundsUsed],
  );
  await db.query(
    `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
     VALUES ('o-open','n1','BUYER_AGENT','POLICY',80.00,80.00,1,'VALID','OFFER','Opening offer','Opening',1,NOW() - INTERVAL '2 minutes')`,
  );
  await db.query(
    `INSERT INTO offers (id, negotiation_id, submitted_by, agent_type, unit_price, total_price, quantity, validation_status, kind, message, explanation, round, created_at)
     VALUES ('o-seller','n1','SELLER_AGENT','POLICY',95.00,95.00,1,'VALID','OFFER','Counter','Counter',1,NOW() - INTERVAL '1 minute')`,
  );
}

async function state() {
  const rows = await harness.db.query(
    `SELECT n.rounds_used, n.status,
       (SELECT COUNT(*) FROM offers WHERE negotiation_id = 'n1' AND submitted_by = 'BUYER') AS human_offers,
       (SELECT COUNT(*) FROM offers WHERE negotiation_id = 'n1' AND validation_status <> 'VALID') AS invalid_offers
     FROM negotiations n WHERE n.id = 'n1'`,
  );
  return {
    roundsUsed: Number(rows[0].rounds_used),
    status: String(rows[0].status),
    humanOffers: Number(rows[0].human_offers),
    invalidOffers: Number(rows[0].invalid_offers),
  };
}

beforeAll(async () => {
  harness = await createTestDb();
  ({ submitBuyerOffer } = await import('./negotiation-offers.js'));
  ({ runNegotiationStep } = await import('./negotiation.js'));
}, 30_000);

beforeEach(async () => {
  await resetDb(harness.db);
  await seed();
});

afterAll(async () => {
  await harness?.close();
}, 30_000);

describe('submitBuyerOffer round accounting', () => {
  it('does not consume a round for a valid human counter', async () => {
    await submitBuyerOffer('n1', auth, { unitPrice: 85, quantity: 1, message: '' });
    const after = await state();
    expect(after.humanOffers).toBe(1);
    expect(after.roundsUsed).toBe(1);
    expect(after.status).toBe('OPEN');
  });

  it('records an invalid offer for audit without consuming a round', async () => {
    await submitBuyerOffer('n1', auth, { unitPrice: 50, quantity: 1, message: '' });
    const after = await state();
    expect(after.invalidOffers).toBe(1);
    expect(after.roundsUsed).toBe(1);
    expect(after.status).toBe('OPEN');
  });

  it('cannot exhaust rounds with repeated submissions', async () => {
    for (const price of [50, 40, 30, 20]) {
      await submitBuyerOffer('n1', auth, { unitPrice: price, quantity: 1, message: '' });
    }
    await submitBuyerOffer('n1', auth, { unitPrice: 90, quantity: 1, message: '' });
    const after = await state();
    expect(after.roundsUsed).toBe(1);
    expect(after.status).toBe('OPEN');
  });

  it('lets a human counter at the round limit without consuming it', async () => {
    await resetDb(harness.db);
    await seed(2);
    await submitBuyerOffer('n1', auth, { unitPrice: 85, quantity: 1, message: '' });
    const after = await state();
    expect(after.roundsUsed).toBe(2);
    expect(after.status).toBe('OPEN');
  });

  it('makes the seller agent answer the human counter, not an invalid later attempt', async () => {
    await submitBuyerOffer('n1', auth, { unitPrice: 85, quantity: 1, message: '' });
    await submitBuyerOffer('n1', auth, { unitPrice: 20, quantity: 1, message: '' });

    const detail = await runNegotiationStep('n1', auth);
    const last = detail.offers[detail.offers.length - 1];
    expect(last.submittedBy).toBe('SELLER_AGENT');
    expect(last.round).toBe(1);
    expect(last.unitPrice).toBeGreaterThanOrEqual(70);
  });
});
