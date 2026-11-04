import { parse } from 'csv-parse/sync';
import { ProductInput, type ProductInput as ProductInputType } from '@bhavai/shared';
import type { SellerRow } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { newId } from '../utils/crypto.js';
import { conflict } from '../utils/errors.js';
import { money } from '../utils/http.js';
import { audit } from './audit.js';
import { mapProduct } from './products.js';

export const CSV_FIELDS = ['name', 'sku', 'listedPrice', 'stock', 'category', 'description', 'unit', 'countryOfOrigin', 'images', 'currency', 'active'] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

const ALIASES: Record<CsvField, string[]> = {
  name: ['name', 'product name', 'product', 'title', 'item'],
  sku: ['sku', 'code', 'product code', 'item code', 'item no', 'id'],
  listedPrice: ['listed price', 'listed_price', 'price', 'unit price', 'mrp', 'rate'],
  stock: ['stock', 'quantity', 'qty', 'inventory', 'available'],
  category: ['category', 'type', 'collection'],
  description: ['description', 'desc', 'details'],
  unit: ['unit', 'uom', 'unit name'],
  countryOfOrigin: ['country of origin', 'origin', 'country', 'country_of_origin'],
  images: ['images', 'image', 'image url', 'photo', 'photos'],
  currency: ['currency', 'currency code'],
  active: ['active', 'status', 'published'],
};

export type CsvPreview = {
  headers: string[];
  totalRows: number;
  sampleRows: Record<string, string>[];
  suggestedMapping: Record<string, CsvField>;
  unmappedHeaders: string[];
  errors: Array<{ row: number; field: string; message: string }>;
  validCount: number;
  duplicateSkus: string[];
  products?: Array<Record<string, unknown>>;
};

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\s]+/g, ' ');
}

export function suggestMapping(headers: string[]): Record<string, CsvField> {
  const mapping: Record<string, CsvField> = {};
  for (const header of headers) {
    const norm = normaliseHeader(header);
    for (const field of CSV_FIELDS) {
      if (!Object.values(mapping).includes(field) && ALIASES[field].includes(norm)) {
        mapping[header] = field;
        break;
      }
    }
  }
  return mapping;
}

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  if (text.length > 700_000) throw conflict('That CSV is too large. Keep it under 700 KB.');
  const rows = parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  if (rows.length === 0) throw conflict('The CSV has no data rows.');
  if (rows.length > 2000) throw conflict('Import up to 2,000 products at a time.');
  const headers = Object.keys(rows[0] ?? {});
  return { headers, rows };
}

function parseImages(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseActive(value: string | undefined): boolean {
  if (!value) return true;
  return !['false', 'no', '0', 'inactive', 'draft', 'unpublished'].includes(value.trim().toLowerCase());
}

export type MappedRow = { row: number; value: ProductInputType | null; errors: Array<{ field: string; message: string }>; rawSku: string; raw: Record<string, string> };

export function mapAndValidate(
  rows: Record<string, string>[],
  mapping: Record<string, CsvField>,
  seller: SellerRow,
): { mapped: MappedRow[]; errors: Array<{ row: number; field: string; message: string }>; duplicateSkus: string[] } {
  const errors: Array<{ row: number; field: string; message: string }> = [];
  const seen = new Map<string, number>();
  const duplicateSkus: string[] = [];

  const mapped = rows.map((raw, index) => {
    const rowNumber = index + 2; // header is row 1
    const get = (field: CsvField): string | undefined => {
      const header = Object.keys(mapping).find((h) => mapping[h] === field);
      if (!header) return undefined;
      const value = raw[header];
      return value === undefined ? undefined : String(value).trim();
    };

    const candidate = {
      name: get('name'),
      description: get('description') || '',
      sku: get('sku'),
      category: get('category') || 'Other',
      images: parseImages(get('images')),
      listedPrice: get('listedPrice'),
      currency: get('currency') || seller.currency,
      stock: get('stock') || '0',
      unit: get('unit') || 'piece',
      countryOfOrigin: get('countryOfOrigin') || seller.country,
      active: parseActive(get('active')),
    };

    const parsed = ProductInput.safeParse(candidate);
    if (!parsed.success) {
      const rowErrors = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'row',
        message: issue.message,
      }));
      for (const err of rowErrors) errors.push({ row: rowNumber, ...err });
      return { row: rowNumber, value: null, errors: rowErrors, rawSku: candidate.sku ?? '', raw };
    }

    const skuKey = parsed.data.sku.toLowerCase();
    if (seen.has(skuKey)) {
      const message = `Duplicate SKU in file (also on row ${seen.get(skuKey)})`;
      errors.push({ row: rowNumber, field: 'sku', message });
      if (!duplicateSkus.includes(parsed.data.sku)) duplicateSkus.push(parsed.data.sku);
      return { row: rowNumber, value: null, errors: [{ field: 'sku', message }], rawSku: candidate.sku ?? '', raw };
    }
    seen.set(skuKey, rowNumber);
    return { row: rowNumber, value: parsed.data, errors: [], rawSku: candidate.sku ?? '', raw };
  });

  return { mapped, errors, duplicateSkus };
}

export async function previewCsv(
  seller: SellerRow,
  text: string,
  mapping?: Record<string, CsvField>,
): Promise<CsvPreview> {
  const { headers, rows } = parseCsvText(text);
  const effectiveMapping = mapping && Object.keys(mapping).length > 0 ? mapping : suggestMapping(headers);
  const db = await getDb();

  const existing = await db.query<{ sku: string }>(`SELECT sku FROM products WHERE seller_id = $1`, [seller.id]);
  const existingSet = new Set(existing.map((r) => String(r.sku).toLowerCase()));

  const { mapped, errors, duplicateSkus } = mapAndValidate(rows, effectiveMapping, seller);
  for (const row of mapped) {
    if (row.value && existingSet.has(row.value.sku.toLowerCase())) {
      errors.push({ row: row.row, field: 'sku', message: `SKU ${row.value.sku} already exists in your catalog` });
    }
  }

  const valid = mapped.filter((r) => r.value && !errors.some((e) => e.row === r.row));
  const sample = rows.slice(0, 6).map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = String(r[h] ?? '').slice(0, 120);
    return out;
  });

  return {
    headers,
    totalRows: rows.length,
    sampleRows: sample,
    suggestedMapping: effectiveMapping,
    unmappedHeaders: headers.filter((h) => !effectiveMapping[h]),
    errors: errors.slice(0, 100),
    validCount: valid.length,
    duplicateSkus,
    products: valid.slice(0, 25).map((r) => ({ ...(r.value as object), row: r.row })),
  };
}

export async function importCsv(
  seller: SellerRow,
  text: string,
  mapping: Record<string, CsvField>,
  defaults?: { currency?: string; country?: string },
): Promise<{ imported: number; skipped: number; products: ReturnType<typeof mapProduct>[]; errors: Array<{ row: number; field: string; message: string }> }> {
  const { rows } = parseCsvText(text);
  const effectiveMapping = { ...mapping };
  if (!Object.values(effectiveMapping).includes('currency') && defaults?.currency) {
    const header = Object.keys(effectiveMapping)[0];
    if (header) effectiveMapping[header] = effectiveMapping[header]; // keep mapping intact
  }
  const { mapped, errors } = mapAndValidate(rows, effectiveMapping, seller);
  const db = await getDb();
  const existing = await db.query<{ sku: string }>(`SELECT sku FROM products WHERE seller_id = $1`, [seller.id]);
  const existingSet = new Set(existing.map((r) => String(r.sku).toLowerCase()));

  const productsToInsert = mapped.filter((row) => {
    if (!row.value) return false;
    if (existingSet.has(row.value.sku.toLowerCase())) {
      errors.push({ row: row.row, field: 'sku', message: `SKU ${row.value.sku} already exists in your catalog` });
      return false;
    }
    return !errors.some((e) => e.row === row.row);
  });

  if (productsToInsert.length === 0) {
    return { imported: 0, skipped: rows.length, products: [], errors };
  }

  const inserted: ReturnType<typeof mapProduct>[] = [];
  await db.transaction(async (tx) => {
    for (const row of productsToInsert) {
      if (!row.value) continue;
      const value = row.value;
      const id = newId();
      const currency = defaults?.currency && !Object.values(effectiveMapping).includes('currency') ? defaults.currency : value.currency;
      if (currency !== seller.currency) {
        errors.push({ row: row.row, field: 'currency', message: `Expected store currency ${seller.currency}` });
        continue;
      }
      const country = defaults?.country && !Object.values(effectiveMapping).includes('countryOfOrigin') ? defaults.country : value.countryOfOrigin;
      await tx.query(
        `INSERT INTO products (id, seller_id, name, description, sku, category, images, listed_price, currency, stock, unit, country_of_origin, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
        [
          id,
          seller.id,
          value.name,
          value.description ?? '',
          value.sku,
          value.category,
          JSON.stringify(value.images ?? []),
          value.listedPrice,
          currency,
          value.stock,
          value.unit,
          country.toUpperCase(),
          value.active ?? true,
        ],
      );
      await tx.query(
        `INSERT INTO seller_rules (id, seller_id, product_id, floor_price, max_discount_percent, minimum_quantity, bulk_discounts, max_rounds, auto_accept_threshold, require_approval_below, approval_required)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
        [
          newId(),
          seller.id,
          id,
          money(value.listedPrice * 0.85),
          15,
          1,
          JSON.stringify([]),
          5,
          money(value.listedPrice * 0.95),
          null,
          false,
        ],
      );
      const rowsOut = await tx.query(`SELECT * FROM products WHERE id = $1`, [id]);
      if (rowsOut[0]) inserted.push(mapProduct(rowsOut[0]));
    }
  });

  await audit({
    actor: { id: seller.userId, role: 'SELLER' },
    action: 'product.imported',
    resourceType: 'seller',
    resourceId: seller.id,
    metadata: { imported: inserted.length, skipped: rows.length - inserted.length },
  });

  return { imported: inserted.length, skipped: rows.length - inserted.length, products: inserted, errors };
}
