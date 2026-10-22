import { loadFileSource } from '@/lib/sources/file';
import { loadOkxSource } from '@/lib/sources/okx';
import type { AppEnv, LeaderboardResult } from '@/lib/types';

export type LoadDeps = {
  cwd?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
};

export async function loadLeaderboard(env: AppEnv = process.env, deps: LoadDeps = {}): Promise<LeaderboardResult> {
  const kind = (env.DATA_SOURCE ?? 'file').trim().toLowerCase() || 'file';
  if (kind === 'okx') return loadOkxSource(env, deps.now ?? new Date());
  if (kind === 'file') {
    return loadFileSource({
      env,
      cwd: deps.cwd,
      fetchImpl: deps.fetchImpl,
      now: deps.now,
    });
  }
  return { ok: false, message: '不支援的 DATA_SOURCE', source: 'unconfigured' };
}

let cache: { key: string; at: number; result: LeaderboardResult } | null = null;
const CACHE_MS = 3000;

export async function getLeaderboard(): Promise<LeaderboardResult> {
  const key = JSON.stringify({
    DATA_SOURCE: process.env.DATA_SOURCE ?? '',
    LEADERBOARD_SOURCE: process.env.LEADERBOARD_SOURCE ?? '',
    INGEST_STORE_PATH: process.env.INGEST_STORE_PATH ?? '',
    OKX_SIMULATED: process.env.OKX_SIMULATED ?? '',
  });
  const now = Date.now();
  if (cache && cache.key === key && now - cache.at < CACHE_MS) return cache.result;
  const result = await loadLeaderboard();
  cache = { key, at: now, result };
  return result;
}

export function clearLeaderboardCache(): void {
  cache = null;
}

export function pollIntervalMs(env: AppEnv = process.env): number {
  const value = Number(env.POLL_MS ?? 15_000);
  if (!Number.isFinite(value)) return 15_000;
  return Math.min(300_000, Math.max(5_000, Math.trunc(value)));
}
