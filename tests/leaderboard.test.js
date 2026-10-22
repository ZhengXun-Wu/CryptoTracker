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

test('ranks the sample file and hides account fields', () => {
  const sample = JSON.parse(readFileSync(path.join(root, 'data/leaderboard.json'), 'utf8'));
  assert.equal(sample.sample, true);
  assert.match(sample._comment, /SAMPLE DATA/);
  const board = buildBoard(sample);
  assert.equal(board.sample, true);
  assert.equal(board.tradingMode, 'demo');
  assert.match(board.updatedAtLabel, /2026/);
  assert.match(board.updatedAtLabel, /14/);
  assert.deepEqual(board.bots.map((bot) => [bot.name, bot.returnPct, bot.status]), [
    ['Crypto激進份子', 18.64, 'ok'],
    ['Crypto狂熱份子', 9.2, 'ok'],
    ['Crypto防禦派', -0.02, 'ok'],
    ['Crypto保守派', null, '未入金'],
  ]);
  const leader = board.bots[0];
  assert.deepEqual(leader.instruments, ['BTC-USDT', 'ETH-USDT']);
  assert.equal(leader.positions[0].side, '多');
  assert.equal(leader.orders.find((order) => order.kind === '停損').price, '62000');
  assert.equal(leader.orders.find((order) => order.kind === '停利').price, '69000');
  const attack = board.teams.find((team) => team.name === '進攻組');
  const steady = board.teams.find((team) => team.name === '穩健組');
  assert.ok(Math.abs(attack.totalReturnPct - 27.84) < 1e-9);
  assert.ok(Math.abs(attack.averageReturnPct - 13.92) < 1e-9);
  assert.equal(steady.scoredCount, 1);
  assert.equal(steady.averageReturnPct, -0.02);
  assert.equal(steady.totalReturnPct, -0.02);
  const blob = JSON.stringify(board);
  const present = keysOf(board);
  for (const hidden of ['equity_usdt', 'markPx', 'upl', 'clOrdId', 'uid', 'apiKey']) {
    assert.equal(present.has(hidden), false);
  }
  assert.equal(blob.includes('4999.12'), false);
  assert.equal(blob.includes('5932'), false);
  assert.equal(blob.includes('67120'), false);
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
  const banned = /okx|api[_-]?key|secret|passphrase|clOrdId|password|SITE_PASSWORD|INGEST_TOKEN/i;
  for (const file of walk(root)) {
    if (file.endsWith('leaderboard.test.js')) continue;
    const text = readFileSync(file, 'utf8');
    assert.equal(banned.test(text), false, file);
  }
});
