import { describe, expect, it } from 'vitest';
import {
  authConfigError,
  createRateLimiter,
  ingestConfigError,
  passwordsMatch,
  signSession,
  tokensMatch,
  verifySession,
} from '../src/lib/auth';

const secret = 'test-session-secret-value';

describe('session auth', () => {
  it('accepts the matching password and rejects a different length', () => {
    expect(passwordsMatch('correct-horse', 'correct-horse')).toBe(true);
    expect(passwordsMatch('wrong', 'correct-horse')).toBe(false);
    expect(passwordsMatch('correct-horse', '')).toBe(false);
    expect(tokensMatch('abc', 'abd')).toBe(false);
  });

  it('signs a session and rejects tampering, the wrong secret, and expiry', () => {
    const token = signSession({ secret, now: 1_000, ttlMs: 500 });
    expect(verifySession(token, { secret, now: 1_200 })).toBe(true);
    expect(verifySession(token, { secret, now: 1_500 })).toBe(false);
    expect(verifySession(token, { secret: 'another-secret-value', now: 1_200 })).toBe(false);
    expect(verifySession(`${token}x`, { secret, now: 1_200 })).toBe(false);
    expect(verifySession(undefined, { secret })).toBe(false);
  });

  it('requires a real password and secret in production', () => {
    expect(authConfigError({ NODE_ENV: 'development' })).toBe('missing');
    expect(authConfigError({ NODE_ENV: 'development', SITE_PASSWORD: 'change-me', SESSION_SECRET: 'change-me-session-secret' })).toBeNull();
    expect(authConfigError({ NODE_ENV: 'production', SITE_PASSWORD: 'change-me', SESSION_SECRET: 'change-me-session-secret' })).toBe('weak');
    expect(authConfigError({ NODE_ENV: 'production', SITE_PASSWORD: 'short', SESSION_SECRET: secret })).toBe('weak');
    expect(authConfigError({ NODE_ENV: 'production', SITE_PASSWORD: 'a-real-password', SESSION_SECRET: secret })).toBeNull();
  });

  it('keeps ingest closed until a strong token is configured', () => {
    expect(ingestConfigError({})).toBe('disabled');
    expect(ingestConfigError({ NODE_ENV: 'development', INGEST_TOKEN: 'dev-token' })).toBeNull();
    expect(ingestConfigError({ NODE_ENV: 'production', INGEST_TOKEN: 'short-token' })).toBe('weak');
    expect(ingestConfigError({ NODE_ENV: 'production', INGEST_TOKEN: 'a-sufficiently-long-token' })).toBeNull();
  });

  it('rate limits repeated failures inside the window', () => {
    const limiter = createRateLimiter(2, 1_000);
    expect(limiter.allow('ip', 0)).toBe(true);
    expect(limiter.allow('ip', 10)).toBe(true);
    expect(limiter.allow('ip', 20)).toBe(false);
    expect(limiter.allow('ip', 2_000)).toBe(true);
    expect(limiter.allow('other', 20)).toBe(true);
  });
});
