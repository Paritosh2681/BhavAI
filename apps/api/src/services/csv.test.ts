import { describe, it, expect } from 'vitest';
import { parseCsvText, suggestMapping, mapAndValidate, type CsvField } from './csv.js';

/* ------------------------------------------------------------------ */
/* parseCsvText                                                        */
/* ------------------------------------------------------------------ */

describe('parseCsvText', () => {
  it('parses a valid CSV with headers and data rows', () => {
    const csv = `name,sku,price,stock\nWidget,W-001,19.99,50\nGadget,G-002,29.99,100`;
    const { headers, rows } = parseCsvText(csv);
    expect(headers).toEqual(['name', 'sku', 'price', 'stock']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Widget', sku: 'W-001', price: '19.99', stock: '50' });
    expect(rows[1]).toEqual({ name: 'Gadget', sku: 'G-002', price: '29.99', stock: '100' });
  });

  it('trims header whitespace', () => {
    const csv = `  name  , sku , price\nWidget,W-001,9.99`;
    const { headers } = parseCsvText(csv);
    expect(headers).toEqual(['name', 'sku', 'price']);
  });

  it('skips empty lines', () => {
    const csv = `name,sku\nA,A-1\n\nB,B-2\n`;
    const { rows } = parseCsvText(csv);
    expect(rows).toHaveLength(2);
  });

  it('throws for an empty CSV (no data rows)', () => {
    expect(() => parseCsvText('name,sku\n')).toThrow();
  });

  it('throws when the CSV is too large (> 700 KB)', () => {
    const largeCsv = 'a'.repeat(700_001);
    expect(() => parseCsvText(largeCsv)).toThrow(/too large/i);
  });
});

/* ------------------------------------------------------------------ */
/* suggestMapping                                                      */
/* ------------------------------------------------------------------ */

describe('suggestMapping', () => {
  it('maps common header aliases to canonical fields', () => {
    const mapping = suggestMapping(['Product Name', 'SKU', 'Price', 'Qty', 'Category']);
    expect(mapping['Product Name']).toBe('name');
    expect(mapping['SKU']).toBe('sku');
    expect(mapping['Price']).toBe('listedPrice');
    expect(mapping['Qty']).toBe('stock');
    expect(mapping['Category']).toBe('category');
  });

  it('is case-insensitive', () => {
    const mapping = suggestMapping(['NAME', 'sku', 'PRICE']);
    expect(mapping['NAME']).toBe('name');
    expect(mapping['sku']).toBe('sku');
    expect(mapping['PRICE']).toBe('listedPrice');
  });

  it('does not duplicate field assignments', () => {
    // Both "name" and "title" map to 'name'; only the first should be used
    const mapping = suggestMapping(['name', 'title']);
    const nameFields = Object.values(mapping).filter((v) => v === 'name');
    expect(nameFields).toHaveLength(1);
  });

  it('returns an empty mapping when no headers match', () => {
    const mapping = suggestMapping(['foo', 'bar', 'baz']);
    expect(Object.keys(mapping)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* mapAndValidate                                                      */
/* ------------------------------------------------------------------ */

// Minimal seller row stub matching the expected shape
const fakeSeller = {
  id: 'seller-1',
  userId: 'user-1',
  businessName: 'Test Co',
  country: 'IN',
  currency: 'INR',
  storeSlug: 'test-co',
  active: true,
};

describe('mapAndValidate', () => {
  const baseMapping: Record<string, CsvField> = {
    name: 'name',
    sku: 'sku',
    price: 'listedPrice',
    stock: 'stock',
    category: 'category',
  };

  it('validates well-formed rows successfully', () => {
    const rows = [
      { name: 'Widget', sku: 'W-001', price: '19.99', stock: '50', category: 'Home & Decor' },
    ];
    const { mapped, errors, duplicateSkus } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).not.toBeNull();
    expect(mapped[0].errors).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(duplicateSkus).toHaveLength(0);
  });

  it('detects duplicate SKUs within the file', () => {
    const rows = [
      { name: 'Widget A', sku: 'DUP-1', price: '10', stock: '5', category: 'Other' },
      { name: 'Widget B', sku: 'DUP-1', price: '20', stock: '10', category: 'Other' },
    ];
    const { duplicateSkus, errors } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(duplicateSkus).toContain('DUP-1');
    expect(errors.some((e) => e.field === 'sku')).toBe(true);
  });

  it('detects duplicate SKUs case-insensitively', () => {
    const rows = [
      { name: 'Product A', sku: 'abc-01', price: '10', stock: '5', category: 'Home & Decor' },
      { name: 'Product B', sku: 'ABC-01', price: '20', stock: '10', category: 'Home & Decor' },
    ];
    const { duplicateSkus } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(duplicateSkus.length).toBeGreaterThan(0);
  });

  it('reports errors for invalid price values', () => {
    const rows = [
      { name: 'Widget', sku: 'W-001', price: 'not-a-number', stock: '50', category: 'Other' },
    ];
    const { mapped, errors } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports errors for invalid stock values', () => {
    const rows = [
      { name: 'Widget', sku: 'W-001', price: '10', stock: 'abc', category: 'Other' },
    ];
    const { mapped, errors } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports errors for negative price', () => {
    const rows = [
      { name: 'Widget', sku: 'W-001', price: '-5', stock: '10', category: 'Other' },
    ];
    const { mapped, errors } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports errors when required name is missing', () => {
    const rows = [
      { name: '', sku: 'W-001', price: '10', stock: '5', category: 'Other' },
    ];
    const { mapped, errors } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports errors when required sku is missing', () => {
    const rows = [
      { name: 'Widget', sku: '', price: '10', stock: '5', category: 'Other' },
    ];
    const { mapped, errors } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('row numbers start at 2 (header is row 1)', () => {
    const rows = [
      { name: 'Widget', sku: 'W-001', price: '10', stock: '5', category: 'Other' },
    ];
    const { mapped } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].row).toBe(2);
  });

  it('uses seller defaults for unmapped optional fields', () => {
    const rows = [
      { name: 'Widget', sku: 'W-001', price: '10', stock: '5', category: 'Other' },
    ];
    const { mapped } = mapAndValidate(rows, baseMapping, fakeSeller as any);
    expect(mapped[0].value).not.toBeNull();
    // Should use seller's country as countryOfOrigin default
    expect(mapped[0].value!.countryOfOrigin).toBe('IN');
  });
});
