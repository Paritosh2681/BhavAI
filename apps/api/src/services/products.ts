import {
  CATEGORIES,
  minimumAllowedPrice,
  roundMoney,
  targetPrice,
  type PublicProduct,
  type PublicStore,
  type SellerRules,
  type BulkRule,
  type ProductInput,
  type RulesInput,
  type Product,
} from '@bhavai/shared';
import { getDb, parseJson, toNumber, toIso } from '../db/index.js';
import { newId, slugify } from '../utils/crypto.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { money } from '../utils/http.js';
import type { SellerRow } from '../middleware/auth.js';
import { audit } from './audit.js';

export function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    name: String(row.name),
    description: String(row.description ?? ''),
    sku: String(row.sku),
    category: String(row.category),
    images: parseJson<string[]>(row.images, []),
    listedPrice: roundMoney(toNumber(row.listed_price)),
    currency: String(row.currency),
    stock: toNumber(row.stock),
    unit: String(row.unit ?? 'piece'),
    countryOfOrigin: String(row.country_of_origin),
    active: row.active === true,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapRules(row: Record<string, unknown>): SellerRules {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    productId: row.product_id ? String(row.product_id) : null,
    floorPrice: roundMoney(toNumber(row.floor_price)),
    maxDiscountPercent: roundMoney(toNumber(row.max_discount_percent)),
    minimumQuantity: toNumber(row.minimum_quantity, 1),
    bulkDiscounts: parseJson<BulkRule[]>(row.bulk_discounts, []),
    maxRounds: toNumber(row.max_rounds, 5),
    autoAcceptThreshold: row.auto_accept_threshold === null ? null : roundMoney(toNumber(row.auto_accept_threshold)),
    requireApprovalBelow: row.require_approval_below === null ? null : roundMoney(toNumber(row.require_approval_below)),
    approvalRequired: row.approval_required === true,
    updatedAt: toIso(row.updated_at),
  };
}

export function policyFromRules(rules: SellerRules, product: Product) {
  return {
    listedPrice: product.listedPrice,
    floorPrice: rules.floorPrice,
    maxDiscountPercent: rules.maxDiscountPercent,
    minimumQuantity: rules.minimumQuantity,
    bulkDiscounts: rules.bulkDiscounts,
    maxRounds: rules.maxRounds,
    autoAcceptThreshold: rules.autoAcceptThreshold,
    requireApprovalBelow: rules.requireApprovalBelow,
  };
}

export async function listSellerProducts(
  sellerId: string,
  filters: { search?: string; status?: string; category?: string; page?: number; pageSize?: number },
) {
  const db = await getDb();
  const where: string[] = ['p.seller_id = $1'];
  const params: unknown[] = [sellerId];
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length})`);
  }
  if (filters.status === 'active') where.push('p.active = TRUE');
  if (filters.status === 'inactive') where.push('p.active = FALSE');
  if (filters.status === 'out') where.push('p.stock = 0');
  if (filters.category) {
    params.push(filters.category);
    where.push(`p.category = $${params.length}`);
  }
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM products p WHERE ${where.join(' AND ')}`,
    params,
  );
  const rows = await db.query(
    `SELECT p.* FROM products p WHERE ${where.join(' AND ')}
     ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset],
  );
  return {
    products: rows.map(mapProduct),
    total: Number(countRows[0]?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getSellerProduct(sellerId: string, productId: string): Promise<Product> {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM products WHERE id = $1 AND seller_id = $2`, [productId, sellerId]);
  if (!rows[0]) throw notFound('Product not found');
  return mapProduct(rows[0]);
}

export async function createProduct(seller: SellerRow, input: ProductInput): Promise<Product> {
  const db = await getDb();
  if (input.currency !== seller.currency) {
    throw badRequest(`This store is priced in ${seller.currency}. Create the product in the store currency.`);
  }
  const existing = await db.query(`SELECT id FROM products WHERE seller_id = $1 AND LOWER(sku) = LOWER($2)`, [
    seller.id,
    input.sku,
  ]);
  if (existing[0]) throw conflict(`SKU ${input.sku} already exists in your catalog.`);

  const id = newId();
  await db.query(
    `INSERT INTO products (id, seller_id, name, description, sku, category, images, listed_price, currency, stock, unit, country_of_origin, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      seller.id,
      input.name,
      input.description ?? '',
      input.sku,
      input.category,
      JSON.stringify(input.images ?? []),
      input.listedPrice,
      input.currency,
      input.stock,
      input.unit,
      input.countryOfOrigin.toUpperCase(),
      input.active ?? true,
    ],
  );

  // A seller can publish immediately: derive conservative default rules that
  // the seller must review. These are never exposed publicly.
  await db.query(
    `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
    [
      newId(),
      seller.id,
      id,
      money(input.listedPrice * 0.85),
      15,
      1,
      JSON.stringify([]),
      5,
      money(input.listedPrice * 0.95),
      null,
      false,
    ],
  );

  await audit({
    actor: { id: seller.userId, role: 'SELLER' },
    action: 'product.created',
    resourceType: 'product',
    resourceId: id,
    metadata: { sku: input.sku },
  });
  return getSellerProduct(seller.id, id);
}

export async function updateProduct(seller: SellerRow, productId: string, input: Partial<ProductInput>): Promise<Product> {
  const db = await getDb();
  const current = await getSellerProduct(seller.id, productId);
  if (input.currency && input.currency !== seller.currency) {
    throw badRequest(`This store is priced in ${seller.currency}.`);
  }
  if (input.sku && input.sku.toLowerCase() !== current.sku.toLowerCase()) {
    const dupe = await db.query(`SELECT id FROM products WHERE seller_id = $1 AND LOWER(sku) = LOWER($2) AND id <> $3`, [
      seller.id,
      input.sku,
      productId,
    ]);
    if (dupe[0]) throw conflict(`SKU ${input.sku} already exists in your catalog.`);
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  const push = (column: string, value: unknown, cast = '') => {
    params.push(value);
    fields.push(`${column} = $${params.length}${cast}`);
  };
  if (input.name !== undefined) push('name', input.name);
  if (input.description !== undefined) push('description', input.description);
  if (input.sku !== undefined) push('sku', input.sku);
  if (input.category !== undefined) push('category', input.category);
  if (input.images !== undefined) push('images', JSON.stringify(input.images), '::jsonb');
  if (input.listedPrice !== undefined) push('listed_price', input.listedPrice);
  if (input.stock !== undefined) push('stock', input.stock);
  if (input.unit !== undefined) push('unit', input.unit);
  if (input.countryOfOrigin !== undefined) push('country_of_origin', input.countryOfOrigin.toUpperCase());
  if (input.active !== undefined) push('active', input.active);
  if (fields.length === 0) return current;
  params.push(productId, seller.id);
  fields.push('updated_at = NOW()');
  await db.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND seller_id = $${params.length}`,
    params,
  );
  await audit({
    actor: { id: seller.userId, role: 'SELLER' },
    action: 'product.updated',
    resourceType: 'product',
    resourceId: productId,
  });
  return getSellerProduct(seller.id, productId);
}

export async function deleteProduct(seller: SellerRow, productId: string): Promise<{ deleted: boolean; deactivated: boolean; message: string }> {
  const db = await getDb();
  await getSellerProduct(seller.id, productId);
  const history = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM negotiations WHERE product_id = $1`,
    [productId],
  );
  if (Number(history[0]?.count ?? 0) > 0) {
    await db.query(`UPDATE products SET active = FALSE, updated_at = NOW() WHERE id = $1 AND seller_id = $2`, [
      productId,
      seller.id,
    ]);
    await audit({
      actor: { id: seller.userId, role: 'SELLER' },
      action: 'product.deactivated_for_history',
      resourceType: 'product',
      resourceId: productId,
      metadata: { negotiations: Number(history[0]?.count ?? 0) },
    });
    return {
      deleted: false,
      deactivated: true,
      message: 'This product has negotiation history, so it was deactivated instead of deleted. Historical deals stay intact.',
    };
  }
  await db.query(`DELETE FROM products WHERE id = $1 AND seller_id = $2`, [productId, seller.id]);
  await audit({
    actor: { id: seller.userId, role: 'SELLER' },
    action: 'product.deleted',
    resourceType: 'product',
    resourceId: productId,
  });
  return { deleted: true, deactivated: false, message: 'Product deleted.' };
}

export async function getRulesForProduct(sellerId: string, productId: string): Promise<SellerRules> {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM seller_rules WHERE seller_id = $1 AND product_id = $2`, [sellerId, productId]);
  if (!rows[0]) throw notFound('Pricing rules not found for this product');
  return mapRules(rows[0]);
}

export async function listRules(sellerId: string) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT r.*, p.name AS product_name, p.sku, p.listed_price, p.currency, p.stock, p.active
     FROM seller_rules r JOIN products p ON p.id = r.product_id
     WHERE r.seller_id = $1 ORDER BY p.name ASC`,
    [sellerId],
  );
  return rows.map((row) => ({
    rules: mapRules(row),
    product: {
      id: String(row.product_id),
      name: String(row.product_name),
      sku: String(row.sku),
      listedPrice: roundMoney(toNumber(row.listed_price)),
      currency: String(row.currency),
      stock: toNumber(row.stock),
      active: row.active === true,
    },
    minimumAllowed: minimumAllowedPrice({
      listedPrice: toNumber(row.listed_price),
      floorPrice: toNumber(row.floor_price),
      maxDiscountPercent: toNumber(row.max_discount_percent),
    }),
  }));
}

export function assertRulesConsistent(rules: RulesInput, listedPrice: number): void {
  if (rules.floorPrice > listedPrice) {
    throw badRequest('The confidential floor price cannot be above the listed price.');
  }
  const minimum = minimumAllowedPrice({
    listedPrice,
    floorPrice: rules.floorPrice,
    maxDiscountPercent: rules.maxDiscountPercent,
  });
  if (rules.autoAcceptThreshold != null && rules.autoAcceptThreshold > listedPrice) {
    throw badRequest('The auto-accept price cannot be above the listed price.');
  }
  if (rules.autoAcceptThreshold != null && rules.autoAcceptThreshold < minimum) {
    throw badRequest('The auto-accept price cannot be below the minimum the rules already authorise.');
  }
  if (rules.requireApprovalBelow != null && rules.requireApprovalBelow > listedPrice) {
    throw badRequest('The approval threshold cannot be above the listed price.');
  }
  const seen = new Set<number>();
  for (const tier of rules.bulkDiscounts) {
    if (seen.has(tier.minimumQuantity)) throw badRequest('Each bulk tier needs a unique minimum quantity.');
    seen.add(tier.minimumQuantity);
    if (tier.discountPercent > rules.maxDiscountPercent) {
      throw badRequest('A bulk tier discount cannot exceed the maximum discount.');
    }
  }
}

export async function upsertRules(sellerId: string, productId: string, input: RulesInput): Promise<SellerRules> {
  const db = await getDb();
  const product = await getSellerProduct(sellerId, productId);
  assertRulesConsistent(input, product.listedPrice);
  const existing = await db.query(`SELECT id FROM seller_rules WHERE product_id = $1 AND seller_id = $2`, [
    productId,
    sellerId,
  ]);
  const id = existing[0] ? String(existing[0].id) : newId();
  const payload = [
    input.floorPrice,
    input.maxDiscountPercent,
    input.minimumQuantity,
    JSON.stringify(input.bulkDiscounts ?? []),
    input.maxRounds,
    input.autoAcceptThreshold ?? null,
    input.requireApprovalBelow ?? null,
    input.approvalRequired,
  ];
  if (existing[0]) {
    await db.query(
      `UPDATE seller_rules SET floor_price=$1, max_discount_percent=$2, minimum_quantity=$3, bulk_discounts=$4::jsonb,
       max_rounds=$5, auto_accept_threshold=$6, require_approval_below=$7, approval_required=$8, updated_at=NOW()
       WHERE id=$9`,
      [...payload, id],
    );
  } else {
    await db.query(
      `INSERT INTO seller_rules (floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required, id, seller_id, product_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11)`,
      [...payload, id, sellerId, productId],
    );
  }
  await audit({
    actor: { id: null, role: 'SELLER' },
    action: 'rules.updated',
    resourceType: 'product',
    resourceId: productId,
    metadata: { maxRounds: input.maxRounds, approvalRequired: input.approvalRequired },
  });
  return getRulesForProduct(sellerId, productId);
}

export async function listPublicStores(): Promise<PublicStore[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT s.*, (SELECT COUNT(*)::int FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS product_count,
            (SELECT COALESCE(json_agg(DISTINCT p.category), '[]'::json) FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS categories,
            (SELECT COALESCE(MAX(max_rounds), 5)::int FROM seller_rules r WHERE r.seller_id = s.id) AS max_rounds
     FROM sellers s WHERE s.active = TRUE ORDER BY s.business_name ASC LIMIT 50`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    businessName: String(row.business_name),
    storeSlug: String(row.store_slug),
    description: String(row.description ?? ''),
    country: String(row.country),
    currency: String(row.currency),
    productCount: toNumber(row.product_count),
    categories: parseJson<string[]>(row.categories, []),
    negotiation: { supported: true, maxRounds: toNumber(row.max_rounds, 5) },
    regions:
      String(row.country) === 'IN'
        ? ['India (domestic, manual settlement)', 'International (PayPal Sandbox)']
        : ['International (PayPal Sandbox)'],
    purchaseConditions: [
      'Prices are shown in the store currency.',
      'AI negotiation is bounded by confidential seller rules and revalidated server-side.',
      String(row.country) === 'IN'
        ? 'Indian domestic orders settle off-platform. No domestic PayPal payment is implied.'
        : 'Cross-border orders use PayPal Sandbox in this demonstration.',
      'Stock is reserved only when a deal is accepted.',
    ],
    api: {
      storefront: `/api/public/stores/${row.store_slug}`,
      mcp: '/mcp',
      protocolVersion: '2025-06-18',
    },
  }));
}

export async function getPublicStore(slug: string): Promise<PublicStore> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT s.*, (SELECT COUNT(*)::int FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS product_count,
            (SELECT COALESCE(json_agg(DISTINCT p.category), '[]'::json) FROM products p WHERE p.seller_id = s.id AND p.active = TRUE) AS categories
     FROM sellers s WHERE s.store_slug = $1 AND s.active = TRUE`,
    [slug],
  );
  const row = rows[0];
  if (!row) throw notFound('This storefront is not published or does not exist.');
  const maxRoundsRows = await db.query<{ max_rounds: number }>(
    `SELECT COALESCE(MAX(max_rounds), 5)::int AS max_rounds FROM seller_rules WHERE seller_id = $1`,
    [row.id],
  );
  return {
    id: String(row.id),
    businessName: String(row.business_name),
    storeSlug: String(row.store_slug),
    description: String(row.description ?? ''),
    country: String(row.country),
    currency: String(row.currency),
    productCount: toNumber(row.product_count),
    categories: parseJson<string[]>(row.categories, []),
    negotiation: { supported: true, maxRounds: toNumber(maxRoundsRows[0]?.max_rounds, 5) },
    regions:
      String(row.country) === 'IN'
        ? ['India (domestic, manual settlement)', 'International (PayPal Sandbox)']
        : ['International (PayPal Sandbox)'],
    purchaseConditions: [
      'Prices are shown in the store currency.',
      'AI negotiation is bounded by confidential seller rules and revalidated server-side.',
      String(row.country) === 'IN'
        ? 'Indian domestic orders settle off-platform. No domestic PayPal payment is implied.'
        : 'Cross-border orders use PayPal Sandbox in this demonstration.',
      'Stock is reserved only when a deal is accepted.',
    ],
    api: {
      storefront: `/api/public/stores/${row.store_slug}`,
      mcp: '/mcp',
      protocolVersion: '2025-06-18',
    },
  };
}

function publicProduct(row: Record<string, unknown>): PublicProduct {
  const product = mapProduct(row);
  const rules = mapRules(row);
  return {
    ...product,
    seller: {
      businessName: String(row.business_name),
      storeSlug: String(row.store_slug),
      country: String(row.seller_country),
      currency: String(row.seller_currency),
    },
    negotiation: {
      negotiable: Boolean(row.neg_rules),
      minimumQuantity: rules.minimumQuantity,
      maxRounds: rules.maxRounds,
      bulkTiers: rules.bulkDiscounts
        .map((tier) => ({ minimumQuantity: tier.minimumQuantity, discountPercent: tier.discountPercent }))
        .sort((a, b) => a.minimumQuantity - b.minimumQuantity),
    },
  };
}

const PUBLIC_PRODUCT_SELECT = `
  SELECT p.*, s.business_name, s.store_slug, s.country AS seller_country, s.currency AS seller_currency,
         r.id AS neg_rules, r.floor_price, r.max_discount_percent, r.minimum_quantity, r.bulk_discounts,
         r.max_rounds, r.auto_accept_threshold, r.require_approval_below, r.approval_required
  FROM products p
  JOIN sellers s ON s.id = p.seller_id
  LEFT JOIN seller_rules r ON r.product_id = p.id
`;

export async function listPublicStoreProducts(
  slug: string,
  filters: {
    search?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    page?: number;
    pageSize?: number;
  },
) {
  const db = await getDb();
  const storeRows = await db.query(`SELECT id, currency FROM sellers WHERE store_slug = $1 AND active = TRUE`, [slug]);
  if (!storeRows[0]) throw notFound('This storefront is not published or does not exist.');
  const storeId = String(storeRows[0].id);

  const where = ['p.seller_id = $1', 'p.active = TRUE'];
  const params: unknown[] = [storeId];
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length} OR LOWER(p.category) LIKE $${params.length})`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`LOWER(p.category) = LOWER($${params.length})`);
  }
  if (filters.minPrice !== undefined) {
    params.push(filters.minPrice);
    where.push(`p.listed_price >= $${params.length}`);
  }
  if (filters.maxPrice !== undefined) {
    params.push(filters.maxPrice);
    where.push(`p.listed_price <= $${params.length}`);
  }
  if (filters.inStock) where.push('p.stock > 0');

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 24));
  const count = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM products p WHERE ${where.join(' AND ')}`,
    params,
  );
  const rows = await db.query(
    `${PUBLIC_PRODUCT_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY p.stock > 0 DESC, p.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    products: rows.map(publicProduct),
    total: Number(count[0]?.count ?? 0),
    page,
    pageSize,
    currency: String(storeRows[0].currency),
  };
}

export async function getPublicProduct(productId: string): Promise<PublicProduct> {
  const db = await getDb();
  const rows = await db.query(
    `${PUBLIC_PRODUCT_SELECT} WHERE p.id = $1 AND p.active = TRUE AND s.active = TRUE`,
    [productId],
  );
  if (!rows[0]) throw notFound('Product not found or the storefront is not published.');
  return publicProduct(rows[0]);
}

export async function searchMarket(filters: {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  maxTotal?: number;
  quantity?: number;
  currency?: string;
  country?: string;
  inStock?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  const where = ['p.active = TRUE', 's.active = TRUE'];
  const params: unknown[] = [];
  const terms = (filters.search ?? '')
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2)
    .slice(0, 6);
  for (const term of terms) {
    params.push(`%${term}%`);
    where.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length} OR LOWER(p.category) LIKE $${params.length})`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`LOWER(p.category) = LOWER($${params.length})`);
  }
  if (filters.minPrice !== undefined) {
    params.push(filters.minPrice);
    where.push(`p.listed_price >= $${params.length}`);
  }
  if (filters.maxPrice !== undefined) {
    params.push(filters.maxPrice);
    where.push(`p.listed_price <= $${params.length}`);
  }
  if (filters.currency) {
    params.push(filters.currency);
    where.push(`p.currency = $${params.length}`);
  }
  if (filters.country) {
    params.push(filters.country.toUpperCase());
    where.push(`s.country = $${params.length}`);
  }
  if (filters.inStock !== false) where.push('p.stock > 0');
  if (filters.quantity) {
    params.push(filters.quantity);
    where.push(`p.stock >= $${params.length}`);
    params.push(filters.quantity);
    where.push(`(SELECT COALESCE(minimum_quantity, 1) FROM seller_rules r WHERE r.product_id = p.id) <= $${params.length}`);
  }
  if (filters.maxTotal && filters.quantity) {
    params.push(filters.maxTotal, filters.quantity);
    // Compare against the listed total only; negotiation may still lower it.
    where.push(`p.listed_price * $${params.length} <= $${params.length - 1} * 1.25`);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(40, Math.max(1, filters.pageSize ?? 12));
  const rows = await db.query(
    `${PUBLIC_PRODUCT_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY p.stock > 0 DESC, p.listed_price ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  const count = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM products p JOIN sellers s ON s.id = p.seller_id WHERE ${where.join(' AND ')}`,
    params,
  );
  return {
    products: rows.map(publicProduct),
    total: Number(count[0]?.count ?? 0),
    page,
    pageSize,
    query: { ...filters, terms },
  };
}

export function categories(): readonly string[] {
  return CATEGORIES;
}

export function suggestedSlug(name: string): string {
  return slugify(name);
}
