import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

export type SessionClaims = {
  sub: string;
  role: 'SELLER' | 'BUYER' | 'ADMIN';
  email: string;
};

const secret = new TextEncoder().encode(env.jwtSecret);
const ISSUER = 'bhavai';
const AUDIENCE = 'bhavai-web';

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub || typeof payload.role !== 'string' || typeof payload.email !== 'string') return null;
    return { sub: payload.sub, role: payload.role as SessionClaims['role'], email: payload.email };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'bhavai_session';
