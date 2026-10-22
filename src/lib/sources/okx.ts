/**
 * Read-only stub for a future OKX adapter.
 * A later implementation may call only these GET endpoints:
 * /api/v5/account/balance
 * /api/v5/account/positions
 * /api/v5/trade/orders-pending
 * /api/v5/trade/orders-algo-pending
 * Credentials stay in server environment variables and never leave this process.
 */
import { toLeaderboardView } from '@/lib/normalize';
import { ROSTER } from '@/lib/roster';
import type { AppEnv, LeaderboardResult } from '@/lib/types';

export type OkxCredentialStatus = {
  code: string;
  name: string;
  group: string;
  configured: boolean;
};

function simulatedTrading(env: AppEnv): boolean {
  const value = env.OKX_SIMULATED?.trim().toLowerCase();
  if (value === '0' || value === 'false' || value === 'live') return false;
  return true;
}

export function okxCredentialStatus(env: AppEnv = process.env): OkxCredentialStatus[] {
  return ROSTER.map((bot) => {
    const key = env[`${bot.envPrefix}_API_KEY`]?.trim();
    const secret = env[`${bot.envPrefix}_SECRET_KEY`]?.trim();
    const passphrase = env[`${bot.envPrefix}_PASSPHRASE`]?.trim();
    return {
      code: bot.code,
      name: bot.name,
      group: bot.group,
      configured: Boolean(key && secret && passphrase),
    };
  });
}

export function loadOkxSource(env: AppEnv = process.env, now = new Date()): LeaderboardResult {
  const demo = simulatedTrading(env);
  const groups: Record<string, { bots: Record<string, unknown>[] }> = {};
  for (const bot of okxCredentialStatus(env)) {
    const bucket = groups[bot.group] ?? { bots: [] };
    bucket.bots.push({
      bot: bot.name,
      code: bot.code,
      group: bot.group,
      status: bot.configured ? '尚未接通' : '未設定',
      return_pct: null,
      instruments: [],
      positions: [],
      open_orders: [],
      algo_orders: [],
    });
    groups[bot.group] = bucket;
  }
  const loadedAt = now.toISOString();
  return {
    ok: true,
    view: toLeaderboardView(
      {
        env: demo ? 'demo' : 'live',
        generated_at: loadedAt,
        groups,
      },
      {
        example: false,
        source: 'okx',
        loadedAt,
        now: now.getTime(),
        notice:
          'OKX 唯讀介面仍是預留程式，尚未向交易所讀取資料。已設定金鑰的機器人以「尚未接通」顯示，未設定金鑰的機器人以「未設定」顯示。',
      },
    ),
  };
}
