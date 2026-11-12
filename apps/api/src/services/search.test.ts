import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../test/db.js';

let harness: TestDb;
let searchMarket: typeof import('./products.js')['searchMarket'];
let getPublicProduct: typeof import('./products.js')['getPublicProduct'];
let getPublicStore: typeof import('./products.js')['getPublicStore'];
let listPublicStoreProducts: typeof import('./products.js')['listPublicStoreProducts'];

beforeAll(async () => {
  harness = await createTestDb();
  ({ searchMarket, getPublicProduct, getPublicStore, listPublicStoreProducts } = await import('./products.js'));
  const db = harness.db;
  await db.query(
    `INSERT INTO users (id, email, password_hash, name, role, country, currency)
     VALUES ('u-seller','seller@test.local','x','Test Seller','SELLER','US','USD')`,
  );
  await db.query(
    `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, active, onboarding_complete)
     VALUES ('s1','u-seller','Test Store','US','USD','test-store',TRUE,TRUE)`,
  );
  await db.query(
    `INSERT INTO products (id, seller_id, name, sku, category, listed_price, currency, stock, unit, country_of_origin, active)
     VALUES
       ('p-cheap','s1','Within Budget','SKU-1','Home',90.00,'USD',10,'piece','IN',TRUE),
       ('p-pricey','s1','Over Budget','SKU-2','Home',120.00,'USD',10,'piece','IN',TRUE)`,
  );
  await db.query(
    `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, max_rounds)
     VALUES
       ('r-cheap','s1','p-cheap',60.00,30,1,5),
       ('r-pricey','s1','p-pricey',80.00,30,1,5)`,
  );
}, 30_000);

afterAll(async () => {
  await harness?.close();
}, 30_000);

describe('searchMarket maxTotal', () => {
  it('excludes products whose listed total exceeds the budget', async () => {
    const result = await searchMarket({ maxTotal: 100, quantity: 1 });
    const ids = result.products.map((product) => product.id);
    expect(ids).toContain('p-cheap');
    expect(ids).not.toContain('p-pricey');
  });

  it('includes a product at exactly the budget', async () => {
    const result = await searchMarket({ maxTotal: 90, quantity: 1 });
    expect(result.products.map((product) => product.id)).toEqual(['p-cheap']);
  });
});

describe('public projection', () => {
  const confidential = [
    'floorPrice',
    'floor_price',
    'maxDiscountPercent',
    'max_discount_percent',
    'autoAcceptThreshold',
    'requireApprovalBelow',
    'neg_rules',
  ];

  it('never exposes confidential pricing rules on product payloads', async () => {
    const product = await getPublicProduct('p-cheap');
    const storeProducts = await listPublicStoreProducts('test-store', {});
    for (const payload of [product, storeProducts, await searchMarket({})]) {
      const json = JSON.stringify(payload);
      for (const key of confidential) expect(json).not.toContain(key);
    }
  });

  it('keeps confidential pricing rules out of the storefront payload', async () => {
    const store = await getPublicStore('test-store');
    const json = JSON.stringify(store);
    for (const key of confidential) expect(json).not.toContain(key);
  });
});
