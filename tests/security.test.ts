import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_ENDPOINTS = new Set([
  '/api/v5/account/balance',
  '/api/v5/account/positions',
  '/api/v5/trade/orders-pending',
  '/api/v5/trade/orders-algo-pending',
]);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe('read-only boundaries', () => {
  it('keeps secrets out of git and leaves the example labelled', () => {
    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toContain('data/live-leaderboard.json');
    expect(gitignore).toContain('!.env.example');
    const exampleEnv = readFileSync(path.join(root, '.env.example'), 'utf8');
    for (const line of exampleEnv.split('\n')) {
      if (!/^OKX_[A-Z]+_(API_KEY|SECRET_KEY|PASSPHRASE)=/.test(line)) continue;
      expect(line.slice(line.indexOf('=') + 1).trim()).toBe('');
    }
    const example = readFileSync(path.join(root, 'data/example-leaderboard.json'), 'utf8');
    expect(example).toContain('EXAMPLE DATA');
  });

  it('has no order placement path and no exchange secrets in client code', () => {
    const files = walk(path.join(root, 'src'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/placeOrder|createOrder|cancelOrder|place-order/);
      expect(text).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|OKX)/);
      const endpoints = text.match(/\/api\/v5\/[A-Za-z0-9/_-]+/g) ?? [];
      for (const endpoint of endpoints) expect(ALLOWED_ENDPOINTS.has(endpoint)).toBe(true);
      if (text.includes("'use client'") || text.includes('"use client"')) {
        expect(text).not.toMatch(/@\/lib\/(sources|auth|leaderboard|ingest|session|roster)/);
        expect(text).not.toMatch(/SITE_PASSWORD|SESSION_SECRET|INGEST_TOKEN|SECRET_KEY|PASSPHRASE|OKX_/);
      }
    }
  });
});
