export type AppEnv = Record<string, string | undefined>;

export type TradingMode = 'demo' | 'live' | 'unknown';

export type BotStatus = 'ok' | '未入金' | '未設定' | '資料異常' | '尚未接通';

export type DataSourceKind = 'file' | 'url' | 'ingest' | 'example' | 'okx';

export type PositionView = {
  instrument: string;
  side: string;
  size: string | null;
  entryPrice: string | null;
};

export type OrderView = {
  kind: 'open' | 'algo';
  instrument: string;
  side: string;
  orderType: string;
  price: string | null;
  size: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
};

export type BotView = {
  rank: number;
  name: string;
  group: string;
  status: BotStatus;
  returnPct: number | null;
  instruments: string[];
  positions: PositionView[];
  orders: OrderView[];
  scored: boolean;
};

export type TeamTone = 'steady' | 'attack' | 'other';

export type TeamView = {
  group: string;
  tone: TeamTone;
  averageReturnPct: number | null;
  totalReturnPct: number | null;
  scoredCount: number;
  bots: BotView[];
};

export type LeaderboardView = {
  example: boolean;
  env: string | null;
  tradingMode: TradingMode;
  source: DataSourceKind;
  notice: string | null;
  stale: boolean;
  updatedAt: string;
  updatedAtLabel: string;
  bots: BotView[];
  teams: TeamView[];
};

export type LeaderboardResult =
  | { ok: true; view: LeaderboardView }
  | { ok: false; message: string; source: DataSourceKind | 'unconfigured' };

export function isLeaderboardResult(value: unknown): value is LeaderboardResult {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as { ok?: unknown }).ok === 'boolean';
}
