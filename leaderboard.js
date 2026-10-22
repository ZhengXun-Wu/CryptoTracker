const REQUIRED_GROUPS = ['穩健組', '進攻組'];

const ORDER_TYPES = {
  market: '市價',
  limit: '限價',
  post_only: '只掛單',
  fok: '全數成交',
  ioc: '立即成交',
};

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

function normalizePosition(value) {
  if (!value || typeof value !== 'object') return null;
  const instrument = text(value.instId);
  if (!instrument) return null;
  return {
    instrument,
    side: sideLabel(value.side, 'position'),
    size: text(value.size),
    avgPx: text(value.avgPx),
  };
}

function normalizeOrder(value) {
  if (!value || typeof value !== 'object') return null;
  const instrument = text(value.instId);
  if (!instrument) return null;
  return {
    instrument,
    side: sideLabel(value.side, 'order'),
    orderType: orderTypeLabel(value.ordType),
    size: text(value.sz),
    price: text(value.px),
    kind: orderKindLabel(value.kind),
  };
}

function normalizeBot(value) {
  if (!value || typeof value !== 'object') return null;
  const name = text(value.name);
  if (!name) return null;
  const funded = value.funded === true;
  const returnPct = typeof value.return_pct === 'number' && Number.isFinite(value.return_pct) ? value.return_pct : null;
  const positions = Array.isArray(value.positions) ? value.positions.map(normalizePosition).filter(Boolean) : [];
  const orders = Array.isArray(value.orders) ? value.orders.map(normalizeOrder).filter(Boolean) : [];
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

export function buildBoard(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const drafts = (Array.isArray(data.bots) ? data.bots : []).map(normalizeBot).filter(Boolean);
  const active = drafts.filter((bot) => bot.scored).sort((left, right) => {
    const delta = right.returnPct - left.returnPct;
    return delta === 0 ? left.name.localeCompare(right.name, 'zh-Hant') : delta;
  });
  const inactive = drafts.filter((bot) => !bot.scored).sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'));
  const bots = [...active, ...inactive].map((bot, index) => ({ ...bot, rank: index + 1 }));
  const teams = groupNames(data, bots).map((name) => {
    const members = bots.filter((bot) => bot.group === name);
    const scored = members.filter((bot) => bot.scored);
    const total = scored.reduce((sum, bot) => sum + bot.returnPct, 0);
    return {
      name,
      tone: teamTone(name),
      averageReturnPct: scored.length ? total / scored.length : null,
      totalReturnPct: scored.length ? total : null,
      scoredCount: scored.length,
      bots: members,
    };
  });
  const updatedAt = text(data.updated_at);
  return {
    sample: data.sample === true,
    tradingMode: tradingMode(data.env),
    updatedAt,
    updatedAtLabel: formatUpdatedAt(updatedAt),
    bots,
    teams,
  };
}
