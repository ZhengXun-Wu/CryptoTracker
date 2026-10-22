import { buildBoard, formatReturn, returnTone } from './leaderboard.js';

const DATA_URL = 'data/leaderboard.json';
const root = document.querySelector('#app');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function badge(className, text) {
  return el('span', `badge ${className}`, text);
}

function line(parts) {
  const item = el('li');
  for (const part of parts) {
    if (part) item.append(el('span', '', part));
  }
  return item;
}

function book(bot) {
  const block = el('div', 'book');
  block.append(el('p', 'label', '持單'));
  const conditional = (order) => order.kind === '停損' || order.kind === '停利' || order.kind === '策略單';
  const stops = bot.orders.filter(conditional);
  const opens = bot.orders.filter((order) => !conditional(order));
  if (bot.positions.length === 0 && bot.orders.length === 0) {
    block.append(el('p', 'empty', '目前沒有持單'));
    return block;
  }
  const groups = el('div', 'book-groups');
  if (bot.positions.length) {
    const section = el('div');
    section.append(el('p', 'sublabel', '持倉'));
    const list = el('ul');
    for (const position of bot.positions) {
      list.append(line([
        position.instrument,
        position.side,
        position.size ? `數量 ${position.size}` : '',
        position.avgPx ? `均價 ${position.avgPx}` : '',
      ]));
    }
    section.append(list);
    groups.append(section);
  }
  if (opens.length) {
    groups.append(orderGroup('委託', opens));
  }
  if (stops.length) {
    groups.append(orderGroup('策略單', stops));
  }
  block.append(groups);
  return block;
}

function formatEstimate(value) {
  const rounded = value.toFixed(2);
  return value > 0 ? `試算 +${rounded}` : `試算 ${rounded}`;
}

function orderGroup(title, orders) {
  const section = el('div');
  section.append(el('p', 'sublabel', title));
  const list = el('ul');
  for (const order of orders) {
    const item = line([
      order.instrument,
      order.side,
      order.kind === '委託' ? '' : order.kind,
      order.orderType,
      order.price ? `價格 ${order.price}` : '',
      order.size ? `數量 ${order.size}` : '',
    ]);
    if (order.estPnl != null) item.append(el('span', `est-pnl ${returnTone(order.estPnl)}`, formatEstimate(order.estPnl)));
    if (order.estPnlRaw != null && order.estPnlRaw > 0) {
      item.append(el('span', 'est-ignored', `試算 +${order.estPnlRaw.toFixed(2)}，不計入`));
    }
    list.append(item);
  }
  section.append(list);
  return section;
}

function instruments(bot) {
  const block = el('div', 'instruments');
  block.append(el('p', 'label', '交易標的'));
  if (bot.instruments.length === 0) {
    block.append(el('p', 'empty', '尚無交易標的'));
    return block;
  }
  const list = el('ul', 'chips');
  for (const instrument of bot.instruments) list.append(el('li', '', instrument));
  block.append(list);
  return block;
}

function botCard(bot, compact) {
  const card = el('article', compact ? 'bot-card compact' : 'bot-card');
  card.dataset.team = bot.group;
  card.dataset.place = String(bot.rank);
  card.dataset.scored = bot.scored ? 'yes' : 'no';
  const place = el('div', 'place', String(bot.rank).padStart(2, '0'));
  place.setAttribute('aria-hidden', 'true');
  const identity = el('div', 'identity');
  identity.append(el('p', 'sr-only', `第 ${bot.rank} 名`));
  identity.append(el(compact ? 'h4' : 'h3', '', bot.name));
  const meta = el('div', 'meta-row');
  const pill = el('span', 'team-pill', bot.group);
  pill.dataset.team = bot.group;
  meta.append(pill);
  identity.append(meta);
  const score = el('div', 'score');
  const lineBox = el('div', 'score-line');
  const headline = el('div', 'score-headline');
  headline.append(el('p', 'label', '權益金含掛單試算'));
  headline.append(el('strong', returnTone(bot.returnPct), bot.status === 'ok' ? formatReturn(bot.returnPct) : bot.status));
  lineBox.append(headline);
  if (bot.status === 'ok') {
    const actual = el('div', 'score-actual');
    actual.append(el('p', 'label', '實際'));
    actual.append(el('strong', returnTone(bot.actualReturnPct), formatReturn(bot.actualReturnPct)));
    lineBox.append(actual);
  }
  score.append(lineBox);
  card.append(place, identity, score, instruments(bot), book(bot));
  return card;
}

function render(board) {
  root.replaceChildren();
  const header = el('header', 'topbar');
  const inner = el('div', 'topbar-inner');
  const brand = el('div', 'brand');
  const mark = el('span', 'mark', 'CT');
  mark.setAttribute('aria-hidden', 'true');
  const titles = el('div');
  titles.append(el('p', 'eyebrow', '交易機器人競賽'));
  titles.append(el('h1', '', 'CryptoTracker'));
  brand.append(mark, titles);
  const actions = el('div', 'actions');
  const badges = el('div', 'badges');
  if (board.sample) badges.append(badge('example', '範例資料'));
  if (board.tradingMode === 'demo') badges.append(badge('demo', '模擬盤'));
  if (board.tradingMode === 'live') badges.append(badge('live', '實盤'));
  actions.append(badges);
  const updated = el('p', 'updated');
  updated.append('最後更新 ');
  const time = el('time', '', board.updatedAtLabel);
  if (board.updatedAt) time.dateTime = board.updatedAt;
  updated.append(time, el('span', 'tz', ' 台北時間'));
  actions.append(updated);
  const refresh = el('button', 'ghost', '重新整理');
  refresh.type = 'button';
  refresh.addEventListener('click', () => {
    refresh.disabled = true;
    refresh.textContent = '更新中';
    load();
  });
  actions.append(refresh);
  inner.append(brand, actions);
  header.append(inner);

  const main = el('main', 'wrap');
  if (board.sample) {
    main.append(el('p', 'banner', '畫面目前使用檔案內的範例資料。'));
  }
  if (board.tradingMode === 'demo') {
    main.append(el('p', 'banner demo-note', '目前為模擬盤資料。'));
  }

  const overall = el('section', 'panel');
  overall.setAttribute('aria-labelledby', 'overall-heading');
  const overallHead = el('div', 'section-head');
  overallHead.append(el('h2', '', '總排行'));
  overallHead.querySelector('h2').id = 'overall-heading';
  overallHead.append(el('p', '', '依權益金含掛單試算排序'));
  overall.append(overallHead);
  if (board.bots.length === 0) {
    overall.append(el('p', 'empty', '目前沒有競賽資料。'));
  } else {
    const list = el('ol', 'ranks');
    for (const bot of board.bots) {
      const item = el('li');
      item.append(botCard(bot, false));
      list.append(item);
    }
    overall.append(list);
  }

  const teams = el('section', 'panel');
  teams.setAttribute('aria-labelledby', 'teams-heading');
  const teamHead = el('div', 'section-head');
  const teamsHeading = el('h2', '', '分組戰況');
  teamsHeading.id = 'teams-heading';
  teamHead.append(teamsHeading, el('p', '', '未入金、未設定與錯誤不計入組別報酬。'));
  teams.append(teamHead);
  const grid = el('div', 'team-grid');
  for (const team of board.teams) {
    const card = el('article', 'team-card');
    card.dataset.tone = team.tone;
    const head = el('header', 'team-head');
    head.append(el('h3', '', team.name), el('p', 'count', `計入 ${team.scoredCount} 位`));
    const stats = el('div', 'stats');
    const pairs = team.portfolio
      ? [['權益金含掛單試算', team.headlineReturnPct], ['實際', team.actualReturnPct]]
      : [['平均（含掛單）', team.averageReturnPct], ['合計（含掛單）', team.totalReturnPct]];
    for (const [label, value] of pairs) {
      const stat = el('div', 'stat');
      stat.append(el('p', 'label', label), el('strong', returnTone(value), formatReturn(value)));
      stats.append(stat);
    }
    card.append(head, stats);
    if (team.bots.length === 0) {
      card.append(el('p', 'empty', '這一組目前沒有選手。'));
    } else {
      const members = el('div', 'team-bots');
      for (const bot of team.bots) members.append(botCard(bot, true));
      card.append(members);
    }
    grid.append(card);
  }
  teams.append(grid);
  main.append(overall, teams, el('p', 'footer-note', '含掛單試算：把尚未成交的限價掛單當作已在掛單價成交，以現價估算；只計入虧損，試算為獲利則以 0 計。條件單不計入。已成交部位照常計算未實現損益。'));
  root.append(header, main);
}

function showError(message) {
  root.replaceChildren();
  const main = el('main', 'wrap');
  main.append(el('h1', '', 'CryptoTracker'), el('p', 'banner warn', message));
  root.append(main);
}

async function load() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(buildBoard(await response.json()));
  } catch {
    showError('無法讀取 data/leaderboard.json');
  }
}

load();
