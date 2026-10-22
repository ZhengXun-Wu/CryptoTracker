import { buildBoard, formatReturn, returnTone } from './leaderboard.js';

const DATA_URL = 'data/leaderboard.json';
const POLL_MS = 60000;
const GIFT_LABEL = '帳戶總估值（含模擬盤贈送 1 BTC、1 ETH、100 OKB，不列入排名）';
const FOOTNOTE = '含掛單試算：把尚未成交的限價掛單當作已在掛單價成交，以現價估算；只計入虧損，試算為獲利則以 0 計。條件單不計入。已成交部位照常計算未實現損益。帳戶總估值（含模擬盤贈送 1 BTC、1 ETH、100 OKB，不列入排名）。勝率只計已平倉交易，扣除手續費後獲利才算贏。';

const root = document.querySelector('#app');
let loading = false;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatMoney(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCount(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatRate(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function formatQty(value) {
  if (!value) return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString('zh-TW', { maximumFractionDigits: 6 });
}

function formatPx(value) {
  if (!value) return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString('zh-TW', { maximumFractionDigits: 4 });
}

function formatEstimate(value) {
  const rounded = value.toFixed(2);
  return value > 0 ? `試算 +${rounded}` : `試算 ${rounded}`;
}

function isConditional(order) {
  return order.kind === '停損' || order.kind === '停利' || order.kind === '策略單';
}

function scoreText(bot) {
  return bot.status === 'ok' ? formatReturn(bot.returnPct) : bot.status;
}

function badge(className, text) {
  return el('span', `badge ${className}`, text);
}

function header(board) {
  const bar = el('header', 'topbar');
  const brandRow = el('div', 'brand-row');
  const brand = el('div', 'brand');
  const mark = el('span', 'mark', 'CT');
  mark.setAttribute('aria-hidden', 'true');
  const titles = el('div');
  titles.append(el('p', 'eyebrow', '交易機器人競賽'), el('h1', '', 'CryptoTracker'));
  brand.append(mark, titles);
  const meta = el('div', 'meta');
  if (board.sample) meta.append(badge('example', '範例資料'));
  if (board.tradingMode === 'demo') meta.append(badge('demo', '模擬盤'));
  if (board.tradingMode === 'live') meta.append(badge('live', '實盤'));
  const updated = el('p', 'updated');
  updated.append('更新 ');
  const time = el('time', '', board.updatedAtLabel);
  if (board.updatedAt) time.dateTime = board.updatedAt;
  updated.append(time);
  meta.append(updated);
  const teams = el('div', 'team-totals');
  for (const team of board.teams) {
    const chip = el('div', 'team-total');
    chip.dataset.tone = team.tone;
    const value = team.portfolio ? team.headlineReturnPct : team.totalReturnPct;
    chip.append(el('span', '', team.name), el('strong', returnTone(value), formatReturn(value)));
    if (team.portfolio) chip.append(el('span', 'tiny', `實際 ${formatReturn(team.actualReturnPct)}`));
    teams.append(chip);
  }
  const refresh = el('button', 'ghost', '重新整理');
  refresh.type = 'button';
  refresh.addEventListener('click', () => {
    refresh.disabled = true;
    load();
  });
  brandRow.append(brand, meta, teams, refresh);

  const ranks = el('ol', 'rank-strip');
  for (const bot of board.bots) {
    const item = el('li');
    item.dataset.team = bot.group;
    item.append(el('b', '', String(bot.rank)));
    item.append(el('span', 'name', bot.name));
    item.append(el('span', 'group', bot.group));
    item.append(el('strong', returnTone(bot.returnPct), scoreText(bot)));
    ranks.append(item);
  }

  bar.append(brandRow, ranks, el('p', 'footnote', FOOTNOTE));
  return bar;
}

function metric(label, value, tone) {
  const cell = el('div', 'metric');
  cell.append(el('span', 'k', label));
  cell.append(el('strong', tone || '', value));
  return cell;
}

function table(headers, rows) {
  const node = el('table', 'dense');
  const head = el('thead');
  const headRow = el('tr');
  for (const headerText of headers) headRow.append(el('th', '', headerText));
  head.append(headRow);
  const body = el('tbody');
  for (const cells of rows) {
    const row = el('tr');
    for (const cell of cells) {
      if (cell instanceof Node) row.append(cell);
      else row.append(el('td', '', cell));
    }
    body.append(row);
  }
  node.append(head, body);
  return node;
}

function estimateCell(order) {
  const cell = el('td', 'est-cell');
  if (order.estPnl != null) cell.append(el('span', `est ${returnTone(order.estPnl)}`, formatEstimate(order.estPnl)));
  if (order.estPnlRaw != null && order.estPnlRaw > 0) {
    cell.append(el('span', 'est-ignored', `試算 +${order.estPnlRaw.toFixed(2)}，不計入`));
  }
  if (!cell.childNodes.length) cell.textContent = '—';
  return cell;
}

function section(title, node, inline) {
  const block = el('section', inline ? 'detail inline' : 'detail');
  block.append(el('h3', '', title), node);
  return block;
}

function statsBlock(bot) {
  const stats = bot.stats;
  const row = el('div', 'stats');
  const cells = [
    ['已平倉筆數', stats ? formatCount(stats.closedTrades) : '—'],
    ['賺', stats ? formatCount(stats.wins) : '—'],
    ['賠', stats ? formatCount(stats.losses) : '—'],
    ['勝率', stats ? formatRate(stats.winRatePct) : '—'],
    ['平均賺', stats ? formatMoney(stats.avgWinUsdt) : '—'],
    ['平均賠', stats ? formatMoney(stats.avgLossUsdt) : '—'],
  ];
  for (const [label, value] of cells) {
    const cell = el('div');
    cell.append(el('span', 'k', label), el('b', '', value));
    row.append(cell);
  }
  return section('勝率統計', row);
}

function panel(bot) {
  const card = el('article', 'panel');
  card.dataset.team = bot.group;
  card.dataset.place = String(bot.rank);
  const head = el('header', 'panel-head');
  head.append(el('b', 'place', String(bot.rank).padStart(2, '0')));
  const identity = el('div', 'identity');
  identity.append(el('h2', '', bot.name));
  const pill = el('span', 'team-pill', bot.group);
  pill.dataset.team = bot.group;
  identity.append(pill);
  const score = el('div', 'panel-score');
  score.append(el('strong', returnTone(bot.returnPct), scoreText(bot)));
  if (bot.status === 'ok') score.append(el('span', 'tiny', `實際 ${formatReturn(bot.actualReturnPct)}`));
  head.append(identity, score);

  const body = el('div', 'panel-body');
  const equity = el('div', 'equity');
  const account = metric('帳戶總估值', bot.status === 'ok' ? formatMoney(bot.totalEq) : '—');
  account.title = GIFT_LABEL;
  account.querySelector('.k').title = GIFT_LABEL;
  equity.append(
    metric('比賽權益', bot.status === 'ok' ? formatMoney(bot.equityWithPending) : '—'),
    metric('含掛單試算', scoreText(bot), returnTone(bot.returnPct)),
    account,
  );
  body.append(equity);

  const chips = el('ul', 'chips');
  if (bot.instruments.length === 0) chips.append(el('li', 'muted', '尚無交易標的'));
  else for (const instrument of bot.instruments) chips.append(el('li', '', instrument));
  body.append(section('交易標的', chips));

  const positions = bot.positions.length
    ? table(['標的', '方向', '數量', '均價'], bot.positions.map((position) => [
      position.instrument,
      position.side || '—',
      formatQty(position.size),
      formatPx(position.avgPx),
    ]))
    : el('p', 'empty', '無持倉');
  body.append(section('持倉', positions));

  const opens = bot.orders.filter((order) => !isConditional(order));
  const orders = opens.length
    ? table(['標的', '方向', '價格', '數量', '試算'], opens.map((order) => [
      order.instrument,
      order.side || '—',
      formatPx(order.price),
      formatQty(order.size),
      estimateCell(order),
    ]))
    : el('p', 'empty', '無委託');
  body.append(section('委託', orders, opens.length === 0));

  const stops = bot.orders.filter(isConditional);
  const algos = stops.length
    ? table(['標的', '方向', '類型', '價格', '數量'], stops.map((order) => [
      order.instrument,
      order.side || '—',
      order.kind,
      formatPx(order.price),
      formatQty(order.size),
    ]))
    : el('p', 'empty', '無');
  body.append(section('停損/停利', algos, stops.length === 0), statsBlock(bot));

  card.append(head, body);
  return card;
}

function render(board) {
  root.replaceChildren();
  const main = el('main', 'dashboard');
  if (board.bots.length === 0) main.append(el('p', 'empty', '目前沒有競賽資料。'));
  else for (const bot of board.bots) main.append(panel(bot));
  root.append(header(board), main);
}

function showError(message) {
  root.replaceChildren();
  const main = el('main', 'wrap');
  main.append(el('h1', '', 'CryptoTracker'), el('p', 'banner warn', message));
  root.append(main);
}

async function load() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(buildBoard(await response.json()));
  } catch {
    if (!root.querySelector('.dashboard')) showError('無法讀取 data/leaderboard.json');
  } finally {
    loading = false;
  }
}

load();
setInterval(load, POLL_MS);
