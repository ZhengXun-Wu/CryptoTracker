import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildBoard, formatReturn } from '../leaderboard.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function keysOf(value, found = new Set()) {
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

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

test('formats return percentages', () => {
  assert.equal(formatReturn(18.64), '+18.64%');
  assert.equal(formatReturn(-0.02), '-0.02%');
  assert.equal(formatReturn(0), '0.00%');
  assert.equal(formatReturn(null), '—');
});

test('reads the committed leaderboard without leaking hidden fields', () => {
  const sample = JSON.parse(readFileSync(path.join(root, 'data/leaderboard.json'), 'utf8'));
  const board = buildBoard(sample);
  const names = board.bots.map((bot) => bot.name);
  for (const name of ['Crypto防禦派', 'Crypto保守派', 'Crypto激進份子', 'Crypto狂熱份子']) {
    assert.ok(names.includes(name), name);
  }
  for (const bot of board.bots) {
    assert.ok(bot.equityWithPending == null || Number.isFinite(bot.equityWithPending));
    assert.ok(bot.totalEq == null || Number.isFinite(bot.totalEq));
    if (bot.stats) assert.ok(bot.stats.closedTrades > 0);
  }
  const present = keysOf(board);
  for (const hidden of ['equity_usdt', 'equity_actual_usdt', 'equity_with_pending_usdt', 'pending_pnl_usdt', 'starting_capital_usdt', 'total_eq_usdt', 'markPx', 'upl', 'ordId', 'clOrdId', 'uid', 'apiKey', 'accFillSz', 'instType']) {
    assert.equal(present.has(hidden), false);
  }
});

test('reads competition equity, account equity, and closed-trade stats', () => {
  const board = buildBoard({
    ranking: [
      {
        rank: '1',
        bot: '甲',
        group: '穩健組',
        status: 'ok',
        return_pct_with_pending: '1.25',
        return_pct_actual: '1',
        equity_with_pending_usdt: '5062.5',
        total_eq_usdt: '81234.5',
        stats: { closed_trades: '4', wins: '3', losses: '1', win_rate_pct: '75%', avg_win_usdt: '12.5', avg_loss_usdt: '-4' },
      },
      { rank: '2', bot: '乙', group: '進攻組', status: 'ok', return_pct_with_pending: '0', return_pct_actual: '0', equity_with_pending_usdt: '5000', stats: { closed_trades: '0', wins: '0', losses: '0', win_rate_pct: null, avg_win_usdt: null, avg_loss_usdt: null } },
      { rank: '3', bot: '丙', group: '進攻組', status: '未入金', return_pct_with_pending: '40', equity_with_pending_usdt: '9000', total_eq_usdt: '1' },
    ],
    groups: { 穩健組: { return_pct_with_pending: '1.25', return_pct_actual: '1', bots: [] }, 進攻組: { return_pct_with_pending: '0', return_pct_actual: '0', bots: [] } },
  });
  assert.equal(board.bots[0].equityWithPending, 5062.5);
  assert.equal(board.bots[0].totalEq, 81234.5);
  assert.deepEqual(board.bots[0].stats, { closedTrades: 4, wins: 3, losses: 1, winRatePct: 75, avgWinUsdt: 12.5, avgLossUsdt: -4 });
  assert.equal(board.bots[1].stats, null);
  assert.equal(board.bots[1].totalEq, null);
  assert.equal(board.bots[2].equityWithPending, null);
  assert.equal(board.bots[2].totalEq, null);
  assert.equal(board.bots[2].stats, null);
  assert.equal(JSON.stringify(board).includes('9000'), false);
});

test('ranks by return_pct_with_pending and keeps older return_pct files', () => {
  const board = buildBoard({
    bots: [
      { name: '甲', group: '穩健組', funded: true, return_pct: 10, return_pct_actual: 10, return_pct_with_pending: 1 },
      { name: '乙', group: '進攻組', funded: true, return_pct: 2, return_pct_actual: 2, return_pct_with_pending: 5 },
    ],
  });
  assert.deepEqual(board.bots.map((bot) => [bot.name, bot.returnPct, bot.actualReturnPct]), [
    ['乙', 5, 2],
    ['甲', 1, 10],
  ]);
  assert.equal(board.teams.find((team) => team.name === '進攻組').totalReturnPct, 5);
  assert.equal(board.teams.find((team) => team.name === '穩健組').totalReturnPct, 1);

  const older = buildBoard({
    bots: [{ name: '丙', group: '穩健組', funded: true, return_pct: 3 }],
  });
  assert.equal(older.bots[0].returnPct, 3);
  assert.equal(older.bots[0].actualReturnPct, 3);

  const split = buildBoard({
    bots: [{
      name: '丁',
      group: '進攻組',
      funded: true,
      return_pct: 1,
      return_pct_actual: 2,
      return_pct_with_pending: 5,
      orders: [
        { instId: 'BTC-USDT', side: 'buy', ordType: 'limit', sz: '1', px: '1', kind: 'order', est_pnl: 1.5 },
        { instId: 'BTC-USDT', side: 'sell', ordType: 'limit', sz: '1', px: '2', kind: 'stop' },
      ],
    }],
  });
  assert.equal(split.bots[0].returnPct, 5);
  assert.equal(split.bots[0].actualReturnPct, 2);
  assert.equal(split.bots[0].orders[0].estPnl, 1.5);
  assert.equal(split.bots[0].orders[0].estPnlRaw, null);
  assert.equal(split.bots[0].orders[1].estPnl, null);
});

test('reads the gateway shape, keeps ranking order, and drops ids', () => {
  const board = buildBoard({
    env: 'demo',
    generated_at: '2026-10-22T15:05:00+08:00',
    rank_by: 'return_pct_with_pending',
    ranking: [
      { rank: '1', bot: '低報酬', group: '穩健組', status: 'ok', return_pct_actual: '1', return_pct_with_pending: '1', open_orders: '1', open_algo_orders: '0' },
      { rank: '2', bot: '高報酬', group: '進攻組', status: 'ok', return_pct_actual: '9', return_pct_with_pending: '9', open_orders: '0', open_algo_orders: '0' },
      { rank: '3', bot: '尚未設定', group: '進攻組', status: '未設定', return_pct_with_pending: '80', equity_actual_usdt: '9000' },
      { rank: '4', bot: '讀取失敗', group: '穩健組', status: '錯誤', return_pct_actual: '4', return_pct_with_pending: '4' },
    ],
    groups: {
      穩健組: {
        return_pct_actual: '1',
        return_pct_with_pending: '1',
        equity_actual_usdt: '5000',
        bots: [
          {
            bot: '低報酬',
            status: 'ok',
            return_pct_actual: '1',
            return_pct_with_pending: '1',
            instruments: ['BTC-USDT'],
            positions: [{ instId: 'BTC-USDT-SWAP', posSide: 'long', pos: '1', avgPx: '1', markPx: '2', upl: '3' }],
            open_orders: [{ instId: 'BTC-USDT', side: 'buy', ordType: 'limit', px: '1', sz: '1', est_pnl: '0', est_pnl_raw: '4.5', ordId: '9', clOrdId: 'abc', uid: 'u' }],
            open_algo_orders: [],
          },
        ],
      },
      進攻組: {
        return_pct_actual: '9',
        return_pct_with_pending: '9',
        bots: [
          { bot: '高報酬', status: 'ok', return_pct_actual: '9', return_pct_with_pending: '9', instruments: [], positions: [], open_orders: [], open_algo_orders: [] },
          { bot: '尚未設定', status: '未設定', return_pct_with_pending: '80', instruments: [], positions: [], open_orders: [], open_algo_orders: [] },
        ],
      },
    },
  });
  assert.deepEqual(board.bots.map((bot) => [bot.name, bot.returnPct, bot.status]), [
    ['低報酬', 1, 'ok'],
    ['高報酬', 9, 'ok'],
    ['尚未設定', null, '未設定'],
    ['讀取失敗', null, '錯誤'],
  ]);
  assert.equal(board.bots[0].orders[0].estPnl, 0);
  assert.equal(board.bots[0].orders[0].estPnlRaw, 4.5);
  assert.equal(board.bots[2].returnPct, null);
  assert.equal(JSON.stringify(board).includes('80'), false);
  assert.equal(JSON.stringify(board).includes('9000'), false);
  const present = keysOf(board);
  for (const hidden of ['ordId', 'clOrdId', 'uid', 'markPx', 'upl', 'equity_actual_usdt']) {
    assert.equal(present.has(hidden), false);
  }
  assert.match(board.updatedAtLabel, /15:05|15:05:00|03:05/);
});

test('shows 未入金 instead of a return when funded is false', () => {
  const board = buildBoard({
    env: 'demo',
    updated_at: '2026-10-22T14:40:00+08:00',
    groups: [
      { name: '穩健組', bots: ['Crypto防禦派'] },
      { name: '進攻組', bots: ['Crypto激進份子'] },
    ],
    bots: [
      { name: 'Crypto激進份子', group: '進攻組', funded: false, return_pct: 99, equity_usdt: 9000, instruments: ['BTC-USDT'] },
      { name: 'Crypto防禦派', group: '穩健組', funded: true, return_pct: 1.5, instruments: [], positions: [{ instId: 'ETH-USDT-SWAP', side: 'short', size: '2' }] },
    ],
  });
  assert.equal(board.bots[0].name, 'Crypto防禦派');
  assert.equal(board.bots[0].instruments[0], 'ETH-USDT-SWAP');
  assert.equal(board.bots[1].status, '未入金');
  assert.equal(board.bots[1].returnPct, null);
  assert.equal(board.bots[1].actualReturnPct, null);
  assert.equal(JSON.stringify(board).includes('99'), false);
  assert.equal(board.teams.find((team) => team.name === '進攻組').averageReturnPct, null);
});

test('tolerates a partial payload', () => {
  const board = buildBoard({ bots: [{ name: 'Crypto防禦派' }, null, { funded: true }] });
  assert.equal(board.bots.length, 1);
  assert.equal(board.bots[0].status, '未入金');
  assert.deepEqual(board.teams.map((team) => team.name).slice(0, 2), ['穩健組', '進攻組']);
  assert.doesNotThrow(() => buildBoard(null));
});

test('the site only fetches the committed relative JSON and has no secrets', () => {
  const app = readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /const DATA_URL = 'data\/leaderboard\.json'/);
  assert.equal(app.includes('innerHTML'), false);
  assert.match(app, /比賽權益/);
  assert.match(app, /含掛單試算/);
  assert.match(app, /實際/);
  assert.match(app, /帳戶總估值（含模擬盤贈送 1 BTC、1 ETH、100 OKB，不列入排名）/);
  assert.match(app, /停損\/停利/);
  assert.match(app, /已平倉筆數/);
  assert.match(app, /勝率只計已平倉交易，扣除手續費後獲利才算贏。/);
  assert.match(app, /const POLL_MS = 60000/);
  assert.match(app, /setInterval\(load, POLL_MS\)/);
  assert.match(app, /含掛單試算：把尚未成交的限價掛單當作已在掛單價成交，以現價估算；只計入虧損，試算為獲利則以 0 計。條件單不計入。已成交部位照常計算未實現損益。/);
  assert.match(app, /試算 \+\$\{order\.estPnlRaw\.toFixed\(2\)\}，不計入/);
  const banned = /okx|api[_-]?key|secret|passphrase|clOrdId|password|SITE_PASSWORD|INGEST_TOKEN/i;
  for (const file of walk(root)) {
    if (file.endsWith('leaderboard.test.js')) continue;
    const text = readFileSync(file, 'utf8');
    assert.equal(banned.test(text), false, file);
  }
});
