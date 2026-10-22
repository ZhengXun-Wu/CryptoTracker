import { formatTaipei, isStale } from '@/lib/format';
import { TEAM_ORDER, UNGROUPED, teamSortKey, teamTone } from '@/lib/roster';
import type {
  BotStatus,
  BotView,
  DataSourceKind,
  LeaderboardView,
  OrderView,
  PositionView,
  TeamView,
} from '@/lib/types';

export type ViewMeta = {
  example: boolean;
  source: DataSourceKind;
  loadedAt: string;
  now?: number;
  notice?: string | null;
};

const CLOSED_ORDER_STATES = new Set(['filled', 'canceled', 'cancelled', 'mmp_canceled']);
const CLOSED_ALGO_STATES = new Set(['effective', 'canceled', 'cancelled', 'order_failed', 'failed']);

const ORDER_TYPES: Record<string, string> = {
  market: '市價',
  limit: '限價',
  post_only: '只掛單',
  fok: '全數成交',
  ioc: '立即成交',
  optimal_limit_ioc: '最優限價',
  conditional: '條件單',
  oco: '停損停利',
  move_order_stop: '移動停損',
  trigger: '觸發單',
  iceberg: '冰山',
  twap: '時間加權',
};

const INACTIVE_WEIGHT: Record<string, number> = {
  資料異常: 0,
  未入金: 1,
  未設定: 2,
  尚未接通: 2,
};

export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/,/g, '')
    .replace(/%|％/g, '')
    .replace(/＋/g, '+')
    .replace(/－/g, '-');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function firstText(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return null;
}

function safeLabel(value: string): string {
  return /^[\p{L}\p{N}\-_. ]{1,40}$/u.test(value) ? value : '';
}

function formatSize(value: unknown): string | null {
  const raw = text(value);
  const parsed = parseNumber(value);
  if (parsed == null) return raw;
  if (parsed === 0) return '0';
  return Math.abs(parsed)
    .toFixed(8)
    .replace(/\.?0+$/, '');
}

function formatPrice(value: unknown): string | null {
  const raw = text(value);
  if (!raw || raw === '-1') return null;
  return raw;
}

function parseTime(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const stamp = Date.parse(raw);
  if (Number.isNaN(stamp)) return null;
  return new Date(stamp).toISOString();
}

export function tradingModeOf(env: string | null): LeaderboardView['tradingMode'] {
  if (!env) return 'unknown';
  const value = env.trim().toLowerCase();
  if (['demo', 'simulated', 'paper', 'sim', 'test'].includes(value)) return 'demo';
  if (['live', 'prod', 'production', 'real'].includes(value)) return 'live';
  return 'unknown';
}

function normalizeStatus(value: unknown): BotStatus {
  if (value == null || value === '' || value === 'ok' || value === 'OK') return 'ok';
  if (value === '未入金' || value === '未設定' || value === '尚未接通') return value;
  return '資料異常';
}

function visibleReturn(status: BotStatus, value: number | null): number | null {
  if (status === '未入金' || status === '未設定' || status === '尚未接通') return null;
  return value;
}

function canScore(status: BotStatus, value: number | null): boolean {
  return status === 'ok' && value != null;
}

function positionSide(record: Record<string, unknown>): string {
  const raw = (firstText(record, ['posSide', 'side']) ?? '').toLowerCase();
  const size = parseNumber(record.pos ?? record.size ?? record.sz);
  if (raw === 'long' || raw === '多' || raw === 'buy' || raw === '買') return '多';
  if (raw === 'short' || raw === '空' || raw === 'sell' || raw === '賣') return '空';
  if (raw === 'net' || raw === '淨' || raw === '') {
    if (size != null && size > 0) return '多';
    if (size != null && size < 0) return '空';
    return '淨';
  }
  return safeLabel(firstText(record, ['posSide', 'side']) ?? '');
}

function orderSide(record: Record<string, unknown>): string {
  const raw = (firstText(record, ['side', 'posSide']) ?? '').toLowerCase();
  if (raw === 'buy' || raw === '買') return '買';
  if (raw === 'sell' || raw === '賣') return '賣';
  if (raw === 'long' || raw === '多') return '多';
  if (raw === 'short' || raw === '空') return '空';
  return safeLabel(firstText(record, ['side']) ?? '');
}

function orderType(record: Record<string, unknown>, fallback: string): string {
  const raw = firstText(record, ['ordType', 'ord_type', 'type']);
  if (!raw) return fallback;
  return ORDER_TYPES[raw.toLowerCase()] ?? (safeLabel(raw) || fallback);
}

function instrumentOf(record: Record<string, unknown>): string {
  return safeLabel(firstText(record, ['instId', 'inst_id', 'instrument', 'symbol']) ?? '');
}

function isClosed(record: Record<string, unknown>, closed: Set<string>): boolean {
  const state = (firstText(record, ['state', 'status']) ?? '').toLowerCase();
  return closed.has(state);
}

function normalizePosition(value: unknown): PositionView | null {
  const record = asRecord(value);
  if (!record || isClosed(record, CLOSED_ORDER_STATES)) return null;
  const instrument = instrumentOf(record);
  if (!instrument) return null;
  const size = formatSize(record.pos ?? record.size ?? record.sz);
  if (size === '0') return null;
  return {
    instrument,
    side: positionSide(record),
    size,
    entryPrice: formatPrice(record.avgPx ?? record.avg_px ?? record.entryPrice ?? record.entry),
  };
}

function normalizeOrder(value: unknown, kind: 'open' | 'algo'): OrderView | null {
  const record = asRecord(value);
  if (!record) return null;
  if (isClosed(record, kind === 'algo' ? CLOSED_ALGO_STATES : CLOSED_ORDER_STATES)) return null;
  const instrument = instrumentOf(record);
  if (!instrument) return null;
  const stopLoss = formatPrice(record.slTriggerPx ?? record.sl_trigger_px ?? record.stopLoss ?? record.sl);
  const takeProfit = formatPrice(record.tpTriggerPx ?? record.tp_trigger_px ?? record.takeProfit ?? record.tp);
  const size = formatSize(record.sz ?? record.size ?? record.qty);
  if (kind === 'open' && size === '0') return null;
  return {
    kind,
    instrument,
    side: orderSide(record),
    orderType: orderType(record, kind === 'algo' ? '策略單' : '委託'),
    price: formatPrice(record.px ?? record.price),
    size,
    stopLoss,
    takeProfit,
  };
}

function instrumentList(value: unknown): string[] {
  const found: string[] = [];
  for (const item of asArray(value)) {
    if (typeof item === 'string') {
      const label = safeLabel(item.trim());
      if (label) found.push(label);
      continue;
    }
    const record = asRecord(item);
    if (!record) continue;
    const label = instrumentOf(record);
    if (label) found.push(label);
  }
  return [...new Set(found)];
}

function instrumentsFromActivity(positions: PositionView[], orders: OrderView[]): string[] {
  const found: string[] = [];
  for (const position of positions) found.push(position.instrument);
  for (const order of orders) found.push(order.instrument);
  return [...new Set(found)];
}

type Draft = Omit<BotView, 'rank'>;

function normalizeBot(record: Record<string, unknown>, fallbackGroup: string | null): Draft | null {
  const name = text(record.bot) ?? text(record.name);
  if (!name || !safeLabel(name)) return null;
  const status = normalizeStatus(record.status);
  const parsedReturn = parseNumber(record.return_pct ?? record.returnPct);
  const returnPct = visibleReturn(status, parsedReturn);
  const positions = asArray(record.positions)
    .map(normalizePosition)
    .filter((item): item is PositionView => item != null);
  const orders = [
    ...asArray(record.open_orders ?? record.openOrders).map((item) => normalizeOrder(item, 'open')),
    ...asArray(record.algo_orders ?? record.algoOrders).map((item) => normalizeOrder(item, 'algo')),
  ].filter((item): item is OrderView => item != null);
  const declared = instrumentList(record.instruments);
  return {
    name,
    group: text(record.group) ?? fallbackGroup ?? UNGROUPED,
    status,
    returnPct,
    instruments: declared.length > 0 ? declared : instrumentsFromActivity(positions, orders),
    positions,
    orders,
    scored: canScore(status, returnPct),
  };
}

function remember(map: Map<string, Record<string, unknown>>, record: Record<string, unknown>, group: string | null) {
  const name = text(record.bot) ?? text(record.name);
  if (!name) return;
  const current = map.get(name);
  if (!current) {
    map.set(name, { ...record, bot: name, group: text(record.group) ?? group ?? UNGROUPED });
    return;
  }
  if ((current.return_pct == null && current.returnPct == null) && (record.return_pct != null || record.returnPct != null)) {
    current.return_pct = record.return_pct ?? record.returnPct;
  }
  if (!text(current.group) && (text(record.group) || group)) {
    current.group = text(record.group) ?? group;
  }
}

function collectBots(root: Record<string, unknown>): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  const groups = root.groups;
  if (Array.isArray(groups)) {
    for (const item of groups) {
      const record = asRecord(item);
      if (!record) continue;
      const groupName = text(record.group) ?? text(record.name) ?? UNGROUPED;
      const bots = asArray(record.bots);
      if (bots.length === 0 && (text(record.bot) || record.return_pct != null)) {
        remember(map, record, groupName);
        continue;
      }
      for (const bot of bots) {
        const botRecord = asRecord(bot);
        if (botRecord) remember(map, botRecord, groupName);
      }
    }
  } else {
    const groupRecord = asRecord(groups);
    if (groupRecord) {
      for (const [groupName, groupValue] of Object.entries(groupRecord)) {
        const nested = asRecord(groupValue);
        const bots = nested ? asArray(nested.bots) : asArray(groupValue);
        for (const bot of bots) {
          const botRecord = asRecord(bot);
          if (botRecord) remember(map, botRecord, groupName);
        }
      }
    }
  }
  for (const item of asArray(root.ranking)) {
    const record = asRecord(item);
    if (record) remember(map, record, text(record.group));
  }
  for (const item of asArray(root.bots)) {
    const record = asRecord(item);
    if (record) remember(map, record, text(record.group));
  }
  return [...map.values()];
}

function sortDrafts(bots: Draft[]): Draft[] {
  const active = bots.filter((bot) => bot.scored);
  const inactive = bots.filter((bot) => !bot.scored);
  const byReturn = (left: Draft, right: Draft) => {
    const delta = (right.returnPct ?? 0) - (left.returnPct ?? 0);
    if (delta !== 0) return delta;
    return left.name.localeCompare(right.name, 'zh-Hant');
  };
  active.sort(byReturn);
  inactive.sort((left, right) => {
    const weight = (INACTIVE_WEIGHT[left.status] ?? 9) - (INACTIVE_WEIGHT[right.status] ?? 9);
    if (weight !== 0) return weight;
    return left.name.localeCompare(right.name, 'zh-Hant');
  });
  return [...active, ...inactive];
}

function buildTeams(bots: BotView[]): TeamView[] {
  const names = new Set<string>(TEAM_ORDER);
  for (const bot of bots) names.add(bot.group);
  return [...names]
    .sort((left, right) => teamSortKey(left).localeCompare(teamSortKey(right)))
    .map((group) => {
      const members = bots.filter((bot) => bot.group === group);
      const scored = members.filter((bot) => bot.scored && bot.returnPct != null);
      const total = scored.reduce((sum, bot) => sum + (bot.returnPct ?? 0), 0);
      return {
        group,
        tone: teamTone(group),
        averageReturnPct: scored.length > 0 ? total / scored.length : null,
        totalReturnPct: scored.length > 0 ? total : null,
        scoredCount: scored.length,
        bots: members,
      };
    });
}

export function toLeaderboardView(raw: unknown, meta: ViewMeta): LeaderboardView {
  const root = asRecord(raw) ?? {};
  const rawBots = collectBots(root);
  const drafts = rawBots
    .map((record) => normalizeBot(record, text(record.group)))
    .filter((bot): bot is Draft => bot != null);
  const bots = sortDrafts(drafts).map((bot, index) => ({ ...bot, rank: index + 1 }));
  const envFromBot = rawBots.map((bot) => text(bot.env)).find((value): value is string => Boolean(value)) ?? null;
  const env = text(root.env) ?? envFromBot;
  const generatedAt = parseTime(root.generated_at ?? root.generatedAt);
  const now = meta.now ?? Date.parse(meta.loadedAt);
  const updatedAt = generatedAt ?? meta.loadedAt;
  const example = meta.example;
  const notice =
    meta.notice ??
    (example ? '畫面目前使用內建範例資料，用來示範排行榜。' : null);
  return {
    example,
    env,
    tradingMode: tradingModeOf(env),
    source: meta.source,
    notice,
    stale: isStale(generatedAt, Number.isNaN(now) ? Date.now() : now, example),
    updatedAt,
    updatedAtLabel: formatTaipei(updatedAt),
    bots,
    teams: buildTeams(bots),
  };
}
