import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '@/lib/types';

export const SESSION_COOKIE = 'ct_session';

const WEAK_PASSWORDS = new Set(['change-me', 'changeme', 'password', 'password123']);
const WEAK_SECRETS = new Set(['change-me-session-secret', 'change-me', 'changeme']);
const WEAK_TOKENS = new Set(['change-me', 'change-me-ingest-token', 'changeme']);

export type AuthConfigProblem = 'missing' | 'weak' | null;
export type IngestConfigProblem = 'disabled' | 'weak' | null;

export function sessionTtlMs(env: AppEnv = process.env): number {
  const hours = Number(env.SESSION_HOURS ?? 12);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) return 12 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function authConfigError(env: AppEnv = process.env): AuthConfigProblem {
  const password = env.SITE_PASSWORD ?? '';
  const secret = env.SESSION_SECRET ?? '';
  if (!password || !secret) return 'missing';
  if (env.NODE_ENV === 'production') {
    if (password.length < 8 || WEAK_PASSWORDS.has(password)) return 'weak';
    if (secret.length < 16 || WEAK_SECRETS.has(secret)) return 'weak';
  }
  return null;
}

export function ingestConfigError(env: AppEnv = process.env): IngestConfigProblem {
  const token = env.INGEST_TOKEN?.trim() ?? '';
  if (!token) return 'disabled';
  if (env.NODE_ENV === 'production' && (token.length < 16 || WEAK_TOKENS.has(token))) return 'weak';
  return null;
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (expected.length === 0) return false;
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function tokensMatch(input: string, expected: string): boolean {
  return passwordsMatch(input, expected);
}

export function signSession(options: { secret: string; now?: number; ttlMs?: number }): string {
  const now = options.now ?? Date.now();
  const exp = now + (options.ttlMs ?? sessionTtlMs());
  const payload = `v1.${exp}`;
  const signature = createHmac('sha256', options.secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(
  token: string | undefined,
  options: { secret: string; now?: number },
): boolean {
  if (!token || !options.secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [version, expText, signature] = parts;
  if (version !== 'v1' || !expText || !signature || !/^\d+$/.test(expText)) return false;
  const expected = createHmac('sha256', options.secret).update(`v1.${expText}`).digest('base64url');
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return false;
  return Number(expText) > (options.now ?? Date.now());
}

export function sessionCookieOptions(env: AppEnv = process.env): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(sessionTtlMs(env) / 1000),
  };
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim().slice(0, 80) || 'unknown';
  return 'local';
}
