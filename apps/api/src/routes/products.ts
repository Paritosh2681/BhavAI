import { Router } from 'express';
import { z } from 'zod';
import { ProductInput } from '@bhavai/shared';
import { optionalAuth, requireSeller } from '../middleware/auth.js';
import { parseWith, pathParam } from '../utils/http.js';
import {
  createProduct,
  deleteProduct,
  getSellerProduct,
  listSellerProducts,
  updateProduct,
} from '../services/products.js';
import { CSV_FIELDS, importCsv, previewCsv, suggestMapping, type CsvField } from '../services/csv.js';
import { badRequest, notFound } from '../utils/errors.js';
import { getDb } from '../db/index.js';

export const productsRouter = Router();
productsRouter.use(optionalAuth);

const Mapping = z.record(z.string(), z.string());

function castMapping(mapping: Record<string, string>): Record<string, CsvField> {
  const out: Record<string, CsvField> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!(CSV_FIELDS as readonly string[]).includes(field)) {
      throw badRequest(`Unknown CSV field “${field}”.`);
    }
    out[header] = field as CsvField;
  }
  return out;
}

productsRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const result = await listSellerProducts(auth.seller.id, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(ProductInput, req.body);
    const product = await createProduct(auth.seller, input);
    res.status(201).json({ data: { product } });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/import/template', optionalAuth, async (req, res, next) => {
  try {
    requireSeller(req);
    const csv =
      'name,sku,listed_price,stock,category,description,unit,country_of_origin,images\n' +
      'Handmade Brass Diya,DIYA-001,12,120,Home & Decor,Hand-cast brass diya with a warm antique finish.,piece,IN,\n' +
      'Brass Incense Holder,INC-002,18,80,Home & Decor,Minimal brass holder for incense sticks.,piece,IN,\n';
    res.type('text/csv').send(csv);
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/import/preview', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const body = parseWith(
      z.object({
        csv: z.string().min(1, 'Choose a CSV file').max(700_000, 'Keep the CSV under 700 KB'),
        mapping: Mapping.optional(),
      }),
      req.body,
    );
    const mapping = body.mapping ? castMapping(body.mapping) : undefined;
    const preview = await previewCsv(auth.seller, body.csv, mapping);
    if (!body.mapping) {
      const headers = preview.headers;
      res.json({ data: { ...preview, suggestedMapping: suggestMapping(headers) } });
      return;
    }
    res.json({ data: preview });
  } catch (error) {
    next(error);
  }
});

productsRouter.post('/import', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const body = parseWith(
      z.object({
        csv: z.string().min(1, 'Choose a CSV file').max(700_000, 'Keep the CSV under 700 KB'),
        mapping: Mapping.refine((m) => Object.keys(m).length > 0, 'Map at least one column'),
        defaultCurrency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AED']).optional(),
        defaultCountry: z.string().length(2).optional(),
      }),
      req.body,
    );
    const result = await importCsv(auth.seller, body.csv, castMapping(body.mapping), {
      currency: body.defaultCurrency ?? auth.seller.currency,
      country: body.defaultCountry ?? auth.seller.country,
    });
    res.status(result.imported > 0 ? 201 : 200).json({ data: result });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const product = await getSellerProduct(auth.seller.id, pathParam(req, 'id'));
    res.json({ data: { product } });
  } catch (error) {
    next(error);
  }
});

productsRouter.patch('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const input = parseWith(ProductInput.partial(), req.body);
    const product = await updateProduct(auth.seller, pathParam(req, 'id'), input);
    res.json({ data: { product } });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete('/:id', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const result = await deleteProduct(auth.seller, pathParam(req, 'id'));
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/:id/activity', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireSeller(req);
    const product = await getSellerProduct(auth.seller.id, pathParam(req, 'id'));
    const db = await getDb();
    const rows = await db.query(
      `SELECT n.id, n.status, n.created_at FROM negotiations n WHERE n.product_id = $1 AND n.seller_id = $2 ORDER BY n.created_at DESC LIMIT 10`,
      [product.id, auth.seller.id],
    );
    if (!rows) throw notFound('Product not found');
    res.json({
      data: {
        product,
        negotiations: rows.map((r) => ({ id: String(r.id), status: String(r.status), createdAt: String(r.created_at) })),
      },
    });
  } catch (error) {
    next(error);
  }
});
