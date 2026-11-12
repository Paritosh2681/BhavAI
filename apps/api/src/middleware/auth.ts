import type { NextFunction, Request, Response } from 'express';
import { getDb, parseJson, toIso } from '../db/index.js';
import { unauthorized } from '../utils/errors.js';
import { verifySession, SESSION_COOKIE } from '../utils/jwt.js';
import { sha256 } from '../utils/crypto.js';
import type { Role } from '@bhavai/shared';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  country: string;
  currency: string;
};

export type SellerRow = {
  id: string;
  userId: string;
  businessName: string;
  country: string;
  currency: string;
  storeSlug: string;
  description: string;
  active: boolean;
  onboardingComplete: boolean;
};

export type BuyerRow = {
  id: string;
  userId: string;
  companyName: string;
  country: string;
  currency: string;
  preferences: string;
};

export type AuthContext = {
  user: AuthUser;
  seller: SellerRow | null;
  buyer: BuyerRow | null;
  source: 'session' | 'api_key';
  apiKeyId?: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}

export function mapUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as Role,
    country: String(row.country ?? 'IN'),
    currency: String(row.currency ?? 'INR'),
  };
}

export function mapSeller(row: Record<string, unknown>): SellerRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    businessName: String(row.business_name),
    country: String(row.country),
    currency: String(row.currency),
    storeSlug: String(row.store_slug),
    description: String(row.description ?? ''),
    active: row.active === true,
    onboardingComplete: row.onboarding_complete === true,
  };
}

export function mapBuyer(row: Record<string, unknown>): BuyerRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    companyName: String(row.company_name ?? ''),
    country: String(row.country),
    currency: String(row.currency),
    preferences: String(row.preferences ?? ''),
  };
}

export async function loadAuthContext(userId: string, source: AuthContext['source'], apiKeyId?: string): Promise<AuthContext | null> {
  const db = await getDb();
  const users = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!users[0]) return null;
  const user = mapUser(users[0]);
  let seller: SellerRow | null = null;
  let buyer: BuyerRow | null = null;
  if (user.role === 'SELLER' || user.role === 'ADMIN') {
    const rows = await db.query(`SELECT * FROM sellers WHERE user_id = $1`, [userId]);
    if (rows[0]) seller = mapSeller(rows[0]);
  }
  if (user.role === 'BUYER' || user.role === 'ADMIN') {
    const rows = await db.query(`SELECT * FROM buyers WHERE user_id = $1`, [userId]);
    if (rows[0]) buyer = mapBuyer(rows[0]);
  }
  return { user, seller, buyer, source, apiKeyId };
}

export async function loadApiKey(secret: string): Promise<AuthContext | null> {
  const db = await getDb();
  const hash = sha256(secret);
  const rows = await db.query(
    `SELECT k.id AS key_id, k.user_id FROM api_keys k WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
    [hash],
  );
  if (!rows[0]) return null;
  const ctx = await loadAuthContext(String(rows[0].user_id), 'api_key', String(rows[0].key_id));
  if (ctx) {
    void db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].key_id]).catch(() => undefined);
  }
  return ctx;
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token.startsWith('bvk_')) {
      req.auth = (await loadApiKey(token)) ?? undefined;
    } else {
      const claims = await verifySession(token);
      if (claims) {
        req.auth = (await loadAuthContext(claims.sub, 'session')) ?? undefined;
      }
    }
  }
  if (!req.auth) {
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
    if (cookieToken) {
      const claims = await verifySession(cookieToken);
      if (claims) req.auth = (await loadAuthContext(claims.sub, 'session')) ?? undefined;
    }
  }
  next();
}

export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function requireRole(req: Request, ...roles: Role[]): AuthContext {
  const auth = requireAuth(req);
  if (!roles.includes(auth.user.role)) {
    throw unauthorized('This account does not have access to that area.');
  }
  return auth;
}

export function requireSeller(req: Request): AuthContext & { seller: SellerRow } {
  const auth = requireRole(req, 'SELLER', 'ADMIN');
  if (!auth.seller) throw unauthorized('Complete seller onboarding first.');
  return auth as AuthContext & { seller: SellerRow };
}

export function requireBuyer(req: Request): AuthContext & { buyer: BuyerRow } {
  const auth = requireRole(req, 'BUYER', 'ADMIN');
  if (!auth.buyer) throw unauthorized('Complete buyer onboarding first.');
  return auth as AuthContext & { buyer: BuyerRow };
}
