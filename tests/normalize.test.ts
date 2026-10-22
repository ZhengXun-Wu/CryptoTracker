import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toLeaderboardView } from '../src/lib/normalize';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = JSON.parse(readFileSync(path.join(root, 'data/example-leaderboard.json'), 'utf8')) as unknown;

const meta = {
  example: false,
  source: 'file' as const,
  loadedAt: '2026-10-22T06:40:00.000Z',
  now: Date.parse('2026-10-22T08:00:00Z'),
};

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysOf(child, found);
    }
  }
  return found;
}

describe('leaderboard view', () => {
  it('ranks the example bots by return and aggregates each team', () => {
    const view = toLeaderboardView(example, { ...meta, example: true, source: 'example' });
    expect(view.example).toBe(true);
    expect(view.tradingMode).toBe('demo');
    expect(view.stale).toBe(false);
    expect(view.bots.map((bot) => bot.name)).toEqual([
      'Crypto激進份子',
      'Crypto狂熱份子',
      'Crypto防禦派',
      'Crypto保守派',
    ]);
    expect(view.bots.map((bot) => bot.returnPct)).toEqual([18.64, 9.2, 3.15, -1.4]);
    const attack = view.teams.find((team) => team.group === '進攻組');
    const steady = view.teams.find((team) => team.group === '穩健組');
    expect(attack?.totalReturnPct).toBeCloseTo(27.84, 5);
    expect(attack?.averageReturnPct).toBeCloseTo(13.92, 5);
    expect(steady?.totalReturnPct).toBeCloseTo(1.75, 5);
    expect(steady?.averageReturnPct).toBeCloseTo(0.875, 5);
    const leader = view.bots[0];
    expect(leader?.instruments).toEqual(['BTC-USDT-SWAP', 'ETH-USDT-SWAP']);
    expect(leader?.positions[0]).toMatchObject({ side: '多', size: '0.15', entryPrice: '64250' });
    expect(leader?.orders.find((order) => order.kind === 'algo')).toMatchObject({
      stopLoss: '62000',
      takeProfit: '69000',
      orderType: '停損停利',
    });
    expect(leader?.orders.find((order) => order.kind === 'open')).toMatchObject({
      side: '買',
      orderType: '限價',
      price: '3180',
    });
  });

  it('hides account fields that the board does not show', () => {
    const view = toLeaderboardView(example, { ...meta, example: true, source: 'example' });
    const blob = JSON.stringify(view);
    const present = keysOf(view);
    for (const hidden of ['equity_usdt', 'pnl_usdt', 'starting_capital_usdt', 'holdings', 'lever', 'upl', 'passphrase']) {
      expect(present.has(hidden)).toBe(false);
    }
    expect(blob).not.toContain('5000');
    expect(blob).not.toContain('5932');
    expect(blob).not.toContain('upl');
  });

  it('ranks unfunded and unconfigured bots last and keeps them out of the team math', () => {
    const view = toLeaderboardView(
      {
        env: 'demo',
        generated_at: '2026-10-22T00:00:00Z',
        ranking: [{ rank: 1, bot: 'Crypto保守派', group: '穩健組', return_pct: '12345.67' }],
        groups: {
          穩健組: {
            bots: [
              { bot: 'Crypto防禦派', group: '穩健組', status: 'ok', return_pct: '1.00', instruments: ['BTC-USDT-SWAP'] },
              { bot: 'Crypto保守派', group: '穩健組', status: '未入金', return_pct: '12345.67', rank: 1 },
            ],
          },
          進攻組: {
            bots: [
              { bot: 'Crypto激進份子', status: '未設定', return_pct: '80' },
              { bot: 'Crypto狂熱份子', status: 'error', return_pct: '5' },
            ],
          },
        },
      },
      meta,
    );
    expect(view.bots.map((bot) => [bot.name, bot.status, bot.returnPct, bot.scored])).toEqual([
      ['Crypto防禦派', 'ok', 1, true],
      ['Crypto狂熱份子', '資料異常', 5, false],
      ['Crypto保守派', '未入金', null, false],
      ['Crypto激進份子', '未設定', null, false],
    ]);
    expect(JSON.stringify(view)).not.toContain('12345.67');
    const steady = view.teams.find((team) => team.group === '穩健組');
    const attack = view.teams.find((team) => team.group === '進攻組');
    expect(steady?.scoredCount).toBe(1);
    expect(steady?.averageReturnPct).toBe(1);
    expect(steady?.totalReturnPct).toBe(1);
    expect(attack?.averageReturnPct).toBeNull();
    expect(attack?.totalReturnPct).toBeNull();
  });

  it('tolerates missing fields and derives instruments from open positions', () => {
    const view = toLeaderboardView(
      {
        groups: {
          穩健組: {
            bots: [
              {
                bot: 'Crypto防禦派',
                return_pct: '2.50%',
                positions: [{ instId: 'BTC-USDT-SWAP', pos: '-1.5' }, { pos: '0' }, null],
                open_orders: [{ instId: 'ETH-USDT-SWAP', side: 'buy', px: '3000', sz: '1', state: 'filled' }],
                algo_orders: [{ instId: 'BTC-USDT-SWAP', slTriggerPx: '60000', state: 'effective' }],
              },
              { bot: '' },
              null,
            ],
          },
        },
        ranking: [null, 'nope', { bot: 'Crypto保守派' }],
      },
      meta,
    );
    const defense = view.bots.find((bot) => bot.name === 'Crypto防禦派');
    expect(defense?.returnPct).toBe(2.5);
    expect(defense?.status).toBe('ok');
    expect(defense?.instruments).toEqual(['BTC-USDT-SWAP']);
    expect(defense?.positions[0]).toMatchObject({ side: '空', size: '1.5' });
    expect(defense?.orders).toEqual([]);
    expect(view.bots.some((bot) => bot.name === 'Crypto保守派')).toBe(true);
    expect(view.teams.map((team) => team.group).slice(0, 2)).toEqual(['穩健組', '進攻組']);
  });

  it('does not throw when the payload is incomplete', () => {
    expect(() => toLeaderboardView(null, meta)).not.toThrow();
    expect(() => toLeaderboardView({ ranking: [{ bot: 'Crypto防禦派' }] }, meta)).not.toThrow();
    const view = toLeaderboardView({ env: 'live', bots: [{ name: 'Crypto防禦派', returnPct: '4' }] }, meta);
    expect(view.tradingMode).toBe('live');
    expect(view.bots[0]?.returnPct).toBe(4);
  });
});
