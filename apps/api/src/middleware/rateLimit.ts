import { rateLimit } from 'express-rate-limit';
import type { Request } from 'express';

const json = (message: string) => ({
  error: { code: 'RATE_LIMITED', message, requestId: '' },
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: json('Too many sign-in attempts. Wait a few minutes and try again.'),
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many sign-in attempts. Wait a few minutes and try again.',
        requestId: req.requestId,
      },
    });
  },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'You are moving faster than the API allows. Try again in a minute.',
        requestId: req.requestId,
      },
    });
  },
});

export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again shortly.',
        requestId: req.requestId,
      },
    });
  },
});

/** Simple in-memory limiter for MCP tool calls, keyed by API key or IP. */
const buckets = new Map<string, { count: number; resetAt: number }>();
let sweepAt = 2_000;
export function mcpRateLimit(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  // shortcut: per-process buckets; Render runs one instance, so no shared store needed.
  if (buckets.size >= sweepAt) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    sweepAt = Math.max(buckets.size * 2, 2_000);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  return req.ip || 'unknown';
}
