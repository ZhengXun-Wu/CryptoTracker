import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeStorePath, validateIngestBody, writeIngestSnapshot } from '../src/lib/ingest';
import { loadLeaderboard } from '../src/lib/leaderboard';
import { loadFileSource } from '../src/lib/sources/file';
import { loadOkxSource, okxCredentialStatus } from '../src/lib/sources/okx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cleanups: string[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'cryptotracker-'));
  cleanups.push(dir);
  return dir;
}

describe('file source', () => {
  it('falls back to the labelled example when nothing is configured', async () => {
    const result = await loadFileSource({
      env: { INGEST_STORE_PATH: path.join(tmpdir(), 'cryptotracker-missing.json') },
      cwd: root,
      now: new Date('2026-10-22T08:00:00Z'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.example).toBe(true);
    expect(result.view.source).toBe('example');
    expect(result.view.notice).toContain('範例資料');
    expect(result.view.bots).toHaveLength(4);
  });

  it('reads an explicit file and an ingest snapshot', async () => {
    const dir = await tempDir();
    const file = path.join(dir, 'board.json');
    await writeFile(
      file,
      JSON.stringify({
        env: 'demo',
        generated_at: '2026-10-22T01:00:00Z',
        groups: { 進攻組: { bots: [{ bot: 'Crypto激進份子', return_pct: '3', status: 'ok' }] } },
      }),
    );
    const fromFile = await loadFileSource({
      env: { LEADERBOARD_SOURCE: file },
      cwd: dir,
      now: new Date('2026-10-22T08:00:00Z'),
    });
    expect(fromFile.ok && fromFile.view.source).toBe('file');
    expect(fromFile.ok && fromFile.view.example).toBe(false);
    expect(fromFile.ok && fromFile.view.stale).toBe(true);

    const stored = await writeIngestSnapshot(
      { env: 'live', groups: { 穩健組: { bots: [{ bot: 'Crypto防禦派', return_pct: '1', status: 'ok' }] } } },
      'live.json',
      dir,
    );
    const fromIngest = await loadFileSource({ env: { INGEST_STORE_PATH: stored }, cwd: dir });
    expect(fromIngest.ok && fromIngest.view.source).toBe('ingest');
    expect(fromIngest.ok && fromIngest.view.tradingMode).toBe('live');
    expect(fromIngest.ok && fromIngest.view.bots[0]?.name).toBe('Crypto防禦派');
  });

  it('reports a bad url without calling through to example data', async () => {
    const result = await loadFileSource({
      env: { LEADERBOARD_SOURCE: 'https://gateway.example/leaderboard.json' },
      cwd: root,
      fetchImpl: async () => new Response('nope', { status: 502 }),
    });
    expect(result).toMatchObject({ ok: false, source: 'url' });
  });

  it('reads a url payload', async () => {
    const result = await loadFileSource({
      env: { LEADERBOARD_SOURCE: 'https://gateway.example/leaderboard.json' },
      cwd: root,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            env: 'demo',
            groups: { 進攻組: { bots: [{ bot: 'Crypto狂熱份子', return_pct: '4', status: 'ok' }] } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });
    expect(result.ok && result.view.source).toBe('url');
    expect(result.ok && result.view.bots[0]?.name).toBe('Crypto狂熱份子');
  });

  it('rejects non-http urls and env files', async () => {
    const blockedUrl = await loadFileSource({
      env: { LEADERBOARD_SOURCE: 'file:///etc/passwd' },
      cwd: root,
    });
    expect(blockedUrl.ok).toBe(false);
    const blockedEnv = await loadFileSource({
      env: { LEADERBOARD_SOURCE: '.env' },
      cwd: root,
    });
    expect(blockedEnv).toMatchObject({ ok: false, message: '不能把環境檔當成排行榜' });
  });
});

describe('ingest store', () => {
  it('validates the gateway shape and refuses to overwrite the example or env files', () => {
    expect(validateIngestBody({ ranking: [] }).ok).toBe(true);
    expect(validateIngestBody([]).ok).toBe(false);
    expect(validateIngestBody({ env: 'demo' }).ok).toBe(false);
    expect(() => assertSafeStorePath('data/example-leaderboard.json', root)).toThrow(/範例/);
    expect(() => assertSafeStorePath('.env.local', root)).toThrow(/環境檔/);
  });
});

describe('okx stub', () => {
  it('lists the roster without calling the network or returning secrets', () => {
    const secret = 'okx-secret-do-not-leak-9f3a';
    let called = false;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('network');
    }) as typeof fetch;
    try {
      const env = {
        OKX_SIMULATED: '1',
        OKX_DEFENSE_API_KEY: 'key-id',
        OKX_DEFENSE_SECRET_KEY: secret,
        OKX_DEFENSE_PASSPHRASE: 'phrase-value',
      };
      const status = okxCredentialStatus(env);
      expect(status.find((bot) => bot.code === 'defense')?.configured).toBe(true);
      expect(status.find((bot) => bot.code === 'fanatic')?.configured).toBe(false);
      expect(JSON.stringify(status)).not.toContain(secret);
      const result = loadOkxSource(env, new Date('2026-10-22T00:00:00Z'));
      expect(called).toBe(false);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.view.tradingMode).toBe('demo');
      expect(result.view.source).toBe('okx');
      expect(JSON.stringify(result.view)).not.toContain(secret);
      expect(result.view.bots.find((bot) => bot.name === 'Crypto防禦派')?.status).toBe('尚未接通');
      expect(result.view.bots.find((bot) => bot.name === 'Crypto保守派')?.status).toBe('未設定');
      expect(result.view.bots.every((bot) => bot.scored === false)).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('is selected by DATA_SOURCE=okx and otherwise rejects unknown sources', async () => {
    const selected = await loadLeaderboard({ DATA_SOURCE: 'okx' }, { now: new Date('2026-10-22T00:00:00Z') });
    expect(selected.ok && selected.view.source).toBe('okx');
    const unknown = await loadLeaderboard({ DATA_SOURCE: 'mysql' });
    expect(unknown).toMatchObject({ ok: false, source: 'unconfigured' });
  });
});
