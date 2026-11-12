import { Router, type Response } from 'express';
import { z } from 'zod';
import { COUNTRIES, type Role } from '@bhavai/shared';
import { getDb } from '../db/index.js';
import { hashPassword, newId, randomToken, sha256, verifyPassword } from '../utils/crypto.js';
import { SESSION_COOKIE, signSession } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { badRequest, conflict, unauthorized } from '../utils/errors.js';
import { parseWith } from '../utils/http.js';
import { SignupInput, LoginInput, passwordSchema, emailSchema } from '@bhavai/shared';
import { loadAuthContext, mapUser, optionalAuth, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { audit } from '../services/audit.js';
import { uniqueStoreSlug } from '../services/seller.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

const ForgotInput = z.object({ email: emailSchema });
const ResetInput = z.object({ token: z.string().min(10), password: passwordSchema });
const ProfileUpdate = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  country: z.string().length(2).optional(),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AED']).optional(),
});

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function currencyForCountry(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.currency ?? 'USD';
}

async function issueSession(user: { id: string; email: string; role: Role }, res: Response) {
  const token = await signSession({ sub: user.id, email: user.email, role: user.role });
  setSessionCookie(res, token);
}

authRouter.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(SignupInput, req.body);
    const db = await getDb();
    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [input.email]);
    if (existing.length > 0) throw conflict('An account with that email already exists. Try signing in.');

    const country = input.country.toUpperCase();
    const currency = currencyForCountry(country);
    const userId = newId();
    const createdAt = new Date();

    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, password_hash, name, role, country, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, input.email, hashPassword(input.password), input.name, input.role, country, currency, createdAt],
      );

      if (input.role === 'SELLER') {
        const slug = await uniqueStoreSlug(input.name);
        await tx.query(
          `INSERT INTO sellers (id, user_id, business_name, country, currency, store_slug, description, active, onboarding_complete)
           VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE)`,
          [newId(), userId, input.name, country, currency, slug, ''],
        );
      } else {
        await tx.query(
          `INSERT INTO buyers (id, user_id, company_name, country, currency, preferences)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newId(), userId, '', country, currency, ''],
        );
      }
    });

    const ctx = await loadAuthContext(userId, 'session');
    if (!ctx) throw new Error('Failed to load the new account');
    await issueSession(ctx.user, res);
    await audit({ actor: { id: userId, role: input.role }, action: 'auth.signup', resourceType: 'user', resourceId: userId });
    logger.info('signup', { userId, role: input.role });

    res.status(201).json({ data: { user: ctx.user, seller: ctx.seller, buyer: ctx.buyer } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(LoginInput, req.body);
    const db = await getDb();
    const rows = await db.query(`SELECT * FROM users WHERE email = $1`, [input.email]);
    const row = rows[0];
    if (!row || !verifyPassword(input.password, String(row.password_hash))) {
      throw unauthorized('Email or password is incorrect.');
    }
    const ctx = await loadAuthContext(String(row.id), 'session');
    if (!ctx) throw unauthorized('This account could not be loaded.');
    await issueSession(ctx.user, res);
    await audit({ actor: { id: ctx.user.id, role: ctx.user.role }, action: 'auth.login', resourceType: 'user', resourceId: ctx.user.id });
    res.json({ data: { user: ctx.user, seller: ctx.seller, buyer: ctx.buyer } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', (req, res) => {
  void req;
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ data: { ok: true } });
});

authRouter.get('/me', optionalAuth, async (req, res, next) => {
  try {
    if (!req.auth) {
      res.json({ data: null });
      return;
    }
    const { user, seller, buyer, source } = req.auth;
    const db = await getDb();
    const integrations = await db.query(
      `SELECT (SELECT COUNT(*)::int FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL) AS api_keys`,
      [user.id],
    );
    res.json({
      data: {
        user,
        seller,
        buyer,
        source,
        apiKeys: Number(integrations[0]?.api_keys ?? 0),
        integrations: {
          gemini: env.gemini.configured,
          paypal: env.paypal.configured,
          mcp: true,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/profile', optionalAuth, async (req, res, next) => {
  try {
    const auth = requireAuth(req);
    const input = parseWith(ProfileUpdate, req.body);
    const db = await getDb();
    const fields: string[] = [];
    const params: unknown[] = [];
    if (input.name) {
      params.push(input.name);
      fields.push(`name = $${params.length}`);
    }
    if (input.country) {
      params.push(input.country.toUpperCase());
      fields.push(`country = $${params.length}`);
    }
    if (input.currency) {
      params.push(input.currency);
      fields.push(`currency = $${params.length}`);
    }
    if (fields.length > 0) {
      params.push(auth.user.id);
      await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}`, params);
    }
    const ctx = await loadAuthContext(auth.user.id, auth.source);
    res.json({ data: { user: ctx?.user ?? mapUser({ ...auth.user, id: auth.user.id }) } });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(ForgotInput, req.body);
    if (env.isProd) {
      // No email provider is wired, so a token would be created but never delivered.
      res.status(503).json({
        error: {
          code: 'PASSWORD_RESET_NOT_CONFIGURED',
          message: 'Password reset is not available on this deployment. Contact the store operator.',
          requestId: req.requestId,
        },
      });
      return;
    }
    const db = await getDb();
    const rows = await db.query(`SELECT id FROM users WHERE email = $1`, [input.email]);
    let devResetUrl: string | null = null;

    if (rows[0]) {
      const raw = randomToken(32);
      await db.query(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
        [newId(), rows[0].id, sha256(raw)],
      );
      devResetUrl = `${env.frontendUrl}/reset-password?token=${raw}`;
      logger.info('password_reset_link', { email: input.email, url: devResetUrl });
    }

    // Always respond the same way so the endpoint cannot enumerate accounts.
    res.status(202).json({
      data: {
        accepted: true,
        delivery: 'dev_link',
        message: 'If that email has an account, a 30-minute reset link was created.',
        devResetUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const input = parseWith(ResetInput, req.body);
    const db = await getDb();
    const hash = sha256(input.token);
    const rows = await db.query(
      `SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [hash],
    );
    if (!rows[0]) throw badRequest('That reset link is invalid or has expired. Request a new one.');
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashPassword(input.password), rows[0].user_id]);
      await tx.query(`UPDATE password_resets SET used_at = NOW() WHERE id = $1`, [rows[0].id]);
    });
    await audit({
      actor: { id: String(rows[0].user_id), role: null },
      action: 'auth.password_reset',
      resourceType: 'user',
      resourceId: String(rows[0].user_id),
    });
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});
