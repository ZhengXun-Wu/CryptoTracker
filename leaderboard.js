const REQUIRED_GROUPS = ['穩健組', '進攻組'];

const ORDER_TYPES = {
  market: '市價',
  limit: '限價',
  post_only: '只掛單',
  fok: '全數成交',
  ioc: '立即成交',
  conditional: '條件',
  oco: '條件',
  trigger: '條件',
};

const KNOWN_STATUS = new Set(['ok', '未入金', '未設定', '錯誤']);

export function formatReturn(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function returnTone(value) {
  if (value == null || !Number.isFinite(value)) return 'none';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

export function formatUpdatedAt(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function text(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  const found = [];
  for (const item of value) {
    const label = text(item);
    if (label && !found.includes(label)) found.push(label);
  }
  return found;
}

function sideLabel(value, kind) {
  const raw = (text(value) || '').toLowerCase();
  if (kind === 'position') {
    if (raw === 'long') return '多';
    if (raw === 'short') return '空';
    if (raw === 'net') return '淨';
  }
  if (raw === 'buy') return '買';
  if (raw === 'sell') return '賣';
  if (raw === 'long') return '多';
  if (raw === 'short') return '空';
  if (raw === 'net') return '淨';
  return '';
}

function orderKindLabel(value) {
  const raw = (text(value) || '').toLowerCase();
  if (raw === 'stop') return '停損';
  if (raw === 'take_profit') return '停利';
  if (raw === 'order') return '委託';
  return '委託';
}

function orderTypeLabel(value) {
  const raw = (text(value) || '').toLowerCase();
  if (!raw) return '';
  return ORDER_TYPES[raw] || (/^[\w.-]{1,24}$/.test(raw) ? raw : '');
}

function finiteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function scalarText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return text(value);
}

function priceText(value) {
  const px = scalarText(value.px);
  if (px && px !== '-1') return px;
  const stop = scalarText(value.slTriggerPx);
  const takeProfit = scalarText(value.tpTriggerPx);
  const stopPrice = stop && stop !== '-1' ? stop : null;
  const takeProfitPrice = takeProfit && takeProfit !== '-1' ? takeProfit : null;
  if (stopPrice && takeProfitPrice) return `停損 ${stopPrice}、停利 ${takeProfitPrice}`;
  return stopPrice || takeProfitPrice;
}

function normalizePosition(value) {
  if (!value || typeof value !== 'object') return null;
  const instrument = text(value.instId);
  if (!instrument) return null;
  return {
    instrument,
    side: sideLabel(value.posSide || value.side, 'position'),
    size: scalarText(value.size) || scalarText(value.pos) || scalarText(value.sz),
    avgPx: scalarText(value.avgPx),
  };
}

function algoKind(value) {
  const explicit = text(value.kind);
  if (explicit) return orderKindLabel(explicit);
  const stop = scalarText(value.slTriggerPx);
  const takeProfit = scalarText(value.tpTriggerPx);
  if (stop && takeProfit) return '策略單';
  if (stop) return '停損';
  if (takeProfit) return '停利';
  return '策略單';
}

function normalizeOrder(value, algo = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const instrument = text(value.instId);
  if (!instrument) return null;
  return {
    instrument,
    side: sideLabel(value.side || value.posSide, 'order'),
    orderType: orderTypeLabel(value.ordType),
    size: scalarText(value.sz) || scalarText(value.size),
    price: priceText(value),
    kind: algo ? algoKind(value) : orderKindLabel(value.kind),
    estPnl: finiteNumber(value.est_pnl),
    estPnlRaw: finiteNumber(value.est_pnl_raw),
  };
}

function metricNumber(primary, secondary, key) {
  for (const source of [primary, secondary]) {
    if (!source || typeof source !== 'object' || !Object.prototype.hasOwnProperty.call(source, key)) continue;
    const parsed = finiteNumber(source[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function statNumber(value) {
  if (typeof value === 'string') return finiteNumber(value.replace(/%$/, '').replace(/,/g, ''));
  return finiteNumber(value);
}

function readStats(primary, secondary) {
  const source = primary && primary.stats != null ? primary : (secondary && secondary.stats != null ? secondary : null);
  const stats = source && source.stats;
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null;
  const closedTrades = statNumber(stats.closed_trades);
  if (closedTrades == null || closedTrades === 0) return null;
  return {
    closedTrades,
    wins: statNumber(stats.wins),
    losses: statNumber(stats.losses),
    winRatePct: statNumber(stats.win_rate_pct),
    avgWinUsdt: statNumber(stats.avg_win_usdt),
    avgLossUsdt: statNumber(stats.avg_loss_usdt),
  };
}

function listedOrders(bot) {
  if (!bot || typeof bot !== 'object') return [];
  const plain = Array.isArray(bot.open_orders) ? bot.open_orders : (Array.isArray(bot.orders) ? bot.orders : []);
  const algos = Array.isArray(bot.open_algo_orders) ? bot.open_algo_orders : [];
  return [
    ...plain.map((item) => normalizeOrder(item, false)),
    ...algos.map((item) => normalizeOrder(item, true)),
  ].filter(Boolean);
}

function normalizeBot(value) {
  if (!value || typeof value !== 'object') return null;
  const name = text(value.name);
  if (!name) return null;
  const funded = value.funded === true;
  const legacyReturn = finiteNumber(value.return_pct);
  const withPending = finiteNumber(value.return_pct_with_pending);
  const actual = finiteNumber(value.return_pct_actual);
  const returnPct = withPending ?? legacyReturn;
  const actualReturnPct = actual ?? legacyReturn;
  const positions = Array.isArray(value.positions) ? value.positions.map(normalizePosition).filter(Boolean) : [];
  const orders = listedOrders(value);
  const declared = stringList(value.instruments);
  const instruments = declared.length
    ? declared
    : [...new Set([...positions.map((item) => item.instrument), ...orders.map((item) => item.instrument)])];
  return {
    name,
    group: text(value.group) || '未分組',
    funded,
    status: funded ? 'ok' : '未入金',
    returnPct: funded ? returnPct : null,
    actualReturnPct: funded ? actualReturnPct : null,
    equityWithPending: funded ? metricNumber(value, null, 'equity_with_pending_usdt') : null,
    totalEq: funded ? metricNumber(value, null, 'total_eq_usdt') : null,
    stats: funded ? readStats(value, null) : null,
    scored: funded && returnPct != null,
    instruments,
    positions,
    orders,
  };
}

function tradingMode(env) {
  const value = (text(env) || '').toLowerCase();
  if (value === 'demo' || value === 'simulated' || value === 'paper') return 'demo';
  if (value === 'live' || value === 'real' || value === 'prod' || value === 'production') return 'live';
  return 'unknown';
}

function groupNames(data, bots) {
  const declared = [];
  if (Array.isArray(data.groups)) {
    for (const group of data.groups) {
      const name = group && typeof group === 'object' ? text(group.name) : null;
      if (name && !declared.includes(name)) declared.push(name);
    }
  }
  const names = [...declared];
  for (const name of REQUIRED_GROUPS) {
    if (!names.includes(name)) names.push(name);
  }
  for (const bot of bots) {
    if (!names.includes(bot.group)) names.push(bot.group);
  }
  return names;
}

function teamTone(name) {
  if (name === '穩健組') return 'steady';
  if (name === '進攻組') return 'attack';
  return 'other';
}

function compareReturn(left, right) {
  const delta = right.returnPct - left.returnPct;
  return delta === 0 ? left.name.localeCompare(right.name, 'zh-Hant') : delta;
}

function sortBots(drafts) {
  const active = drafts.filter((bot) => bot.scored).sort(compareReturn);
  const inactive = drafts.filter((bot) => !bot.scored).sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));
  return [...active, ...inactive];
}

function withRanks(bots) {
  return bots.map((bot, index) => ({ ...bot, rank: index + 1 }));
}

function isGateway(data) {
  if (Array.isArray(data.ranking)) return true;
  return Boolean(data.groups) && typeof data.groups === 'object' && !Array.isArray(data.groups);
}

function botLabel(value) {
  if (!value || typeof value !== 'object') return null;
  return text(value.bot) || text(value.name);
}

function resolveStatus(value) {
  const source = value && typeof value === 'object' ? value : {};
  const raw = text(source.status);
  if (raw && KNOWN_STATUS.has(raw)) return raw;
  if (source.funded === true) return 'ok';
  return '未入金';
}

function normalizeGatewayBot(summary, detailEntry) {
  const detail = detailEntry && detailEntry.bot;
  const name = botLabel(detail) || botLabel(summary);
  if (!name) return null;
  const statusSource = detail && text(detail.status) ? detail : (summary && text(summary.status) ? summary : (detail || summary || {}));
  const status = resolveStatus(statusSource);
  const returns = detail || summary || {};
  const legacyReturn = finiteNumber(returns.return_pct);
  const returnPct = finiteNumber(returns.return_pct_with_pending) ?? legacyReturn;
  const actualReturnPct = finiteNumber(returns.return_pct_actual) ?? legacyReturn;
  const active = status === 'ok';
  const positions = detail && Array.isArray(detail.positions) ? detail.positions.map(normalizePosition).filter(Boolean) : [];
  const orders = listedOrders(detail);
  const declared = stringList(detail && detail.instruments);
  const instruments = declared.length
    ? declared
    : [...new Set([...positions.map((item) => item.instrument), ...orders.map((item) => item.instrument)])];
  return {
    name,
    group: text(detail && detail.group) || text(summary && summary.group) || (detailEntry && detailEntry.groupName) || '未分組',
    funded: active,
    status: active ? 'ok' : status,
    returnPct: active ? returnPct : null,
    actualReturnPct: active ? actualReturnPct : null,
    equityWithPending: active ? metricNumber(detail, summary, 'equity_with_pending_usdt') : null,
    totalEq: active ? metricNumber(detail, summary, 'total_eq_usdt') : null,
    stats: active ? readStats(detail, summary) : null,
    scored: active && returnPct != null,
    instruments,
    positions,
    orders,
  };
}

function gatewayDrafts(data) {
  const details = new Map();
  if (data.groups && typeof data.groups === 'object' && !Array.isArray(data.groups)) {
    for (const [groupName, group] of Object.entries(data.groups)) {
      if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
      const list = Array.isArray(group.bots) ? group.bots : [];
      for (const bot of list) {
        const name = botLabel(bot);
        if (!name || details.has(name)) continue;
        details.set(name, { groupName, bot });
      }
    }
  }
  const summaries = new Map();
  if (Array.isArray(data.ranking)) {
    for (const row of data.ranking) {
      const name = botLabel(row);
      if (!name || summaries.has(name)) continue;
      summaries.set(name, row);
    }
  }
  const names = [...summaries.keys()];
  for (const name of details.keys()) {
    if (!summaries.has(name)) names.push(name);
  }
  return names.map((name) => normalizeGatewayBot(summaries.get(name), details.get(name))).filter(Boolean);
}

function orderGatewayBots(data, drafts) {
  if (!Array.isArray(data.ranking)) return sortBots(drafts);
  const rankedNames = [];
  for (const row of data.ranking) {
    const name = botLabel(row);
    if (name && !rankedNames.includes(name)) rankedNames.push(name);
  }
  const byName = new Map(drafts.map((bot) => [bot.name, bot]));
  const head = rankedNames.map((name) => byName.get(name)).filter(Boolean);
  const tail = sortBots(drafts.filter((bot) => !rankedNames.includes(bot.name)));
  return [...head, ...tail];
}

function gatewayGroupNames(data, bots) {
  const names = [];
  if (data.groups && typeof data.groups === 'object' && !Array.isArray(data.groups)) {
    for (const name of Object.keys(data.groups)) {
      if (name && !names.includes(name)) names.push(name);
    }
  }
  for (const name of REQUIRED_GROUPS) {
    if (!names.includes(name)) names.push(name);
  }
  for (const bot of bots) {
    if (!names.includes(bot.group)) names.push(bot.group);
  }
  return names;
}

function teamStats(name, bots, group) {
  const members = bots.filter((bot) => bot.group === name);
  const scored = members.filter((bot) => bot.scored);
  const portfolio = Boolean(group && typeof group === 'object' && !Array.isArray(group)
    && (Object.prototype.hasOwnProperty.call(group, 'return_pct_with_pending') || Object.prototype.hasOwnProperty.call(group, 'return_pct_actual')));
  const total = scored.reduce((sum, bot) => sum + bot.returnPct, 0);
  return {
    name,
    tone: teamTone(name),
    portfolio,
    headlineReturnPct: portfolio ? finiteNumber(group.return_pct_with_pending) : null,
    actualReturnPct: portfolio ? finiteNumber(group.return_pct_actual) : null,
    averageReturnPct: portfolio ? null : (scored.length ? total / scored.length : null),
    totalReturnPct: portfolio ? null : (scored.length ? total : null),
    scoredCount: scored.length,
    bots: members,
  };
}

export function buildBoard(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const gateway = isGateway(data);
  const drafts = gateway ? gatewayDrafts(data) : (Array.isArray(data.bots) ? data.bots : []).map(normalizeBot).filter(Boolean);
  const ordered = gateway ? orderGatewayBots(data, drafts) : sortBots(drafts);
  const bots = withRanks(ordered);
  const names = gateway ? gatewayGroupNames(data, bots) : groupNames(data, bots);
  const teams = names.map((name) => teamStats(name, bots, gateway ? data.groups?.[name] : null));
  const updatedAt = text(data.generated_at) || text(data.updated_at);
  return {
    sample: data.sample === true,
    tradingMode: tradingMode(data.env),
    updatedAt,
    updatedAtLabel: formatUpdatedAt(updatedAt),
    bots,
    teams,
  };
}
