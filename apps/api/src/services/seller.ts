import { getDb } from '../db/index.js';
import { slugify } from '../utils/crypto.js';

export async function uniqueStoreSlug(base: string, excludeSellerId?: string): Promise<string> {
  const db = await getDb();
  const root = slugify(base) || 'store';
  let candidate = root;
  for (let i = 0; i < 50; i += 1) {
    const rows = excludeSellerId
      ? await db.query(`SELECT id FROM sellers WHERE store_slug = $1 AND id <> $2`, [candidate, excludeSellerId])
      : await db.query(`SELECT id FROM sellers WHERE store_slug = $1`, [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${root}-${i + 2}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}
