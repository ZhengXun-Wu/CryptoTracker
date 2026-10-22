import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { EXAMPLE_RELATIVE, ingestStorePath } from '@/lib/ingest';
import { toLeaderboardView, type ViewMeta } from '@/lib/normalize';
import type { AppEnv, DataSourceKind, LeaderboardResult } from '@/lib/types';

const MAX_BYTES = 1_000_000;

export type FileSourceOptions = {
  env: AppEnv;
  cwd?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
};

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function blockedPath(file: string): boolean {
  const base = path.basename(file);
  return base === '.env' || base.startsWith('.env.');
}

async function fileExists(file: string): Promise<boolean> {
  try {
    const info = await stat(file);
    return info.isFile();
  } catch {
    return false;
  }
}

function parsePayload(body: string, meta: ViewMeta): LeaderboardResult {
  if (body.length > MAX_BYTES) {
    return { ok: false, message: '排行榜資料過大', source: meta.source };
  }
  try {
    const raw = JSON.parse(stripBom(body)) as unknown;
    return { ok: true, view: toLeaderboardView(raw, meta) };
  } catch {
    return { ok: false, message: '排行榜資料不是有效的 JSON', source: meta.source };
  }
}

async function loadFile(file: string, source: DataSourceKind, meta: Omit<ViewMeta, 'source' | 'example'>): Promise<LeaderboardResult> {
  if (blockedPath(file)) {
    return { ok: false, message: '不能把環境檔當成排行榜', source: 'file' };
  }
  try {
    const body = await readFile(file, 'utf8');
    return parsePayload(body, {
      ...meta,
      source,
      example: source === 'example',
    });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    if (source === 'example' && missing) {
      return { ok: false, message: '找不到內建範例資料', source: 'example' };
    }
    if (missing) return { ok: false, message: '找不到排行榜檔案', source };
    return { ok: false, message: '無法讀取排行榜資料', source };
  }
}

async function loadUrl(url: string, fetchImpl: typeof fetch, meta: Omit<ViewMeta, 'source' | 'example'>): Promise<LeaderboardResult> {
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false, message: `排行榜網址回應 HTTP ${response.status}`, source: 'url' };
    }
    return parsePayload(await response.text(), { ...meta, source: 'url', example: false });
  } catch {
    return { ok: false, message: '無法從網址讀取排行榜', source: 'url' };
  }
}

export async function loadFileSource(options: FileSourceOptions): Promise<LeaderboardResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const examplePath = path.resolve(cwd, EXAMPLE_RELATIVE);
  const baseMeta = { loadedAt: now.toISOString(), now: now.getTime() };
  const configured = options.env.LEADERBOARD_SOURCE?.trim();

  if (configured) {
    if (isHttpUrl(configured)) {
      return loadUrl(configured, options.fetchImpl ?? fetch, baseMeta);
    }
    if (configured.includes('://')) {
      return { ok: false, message: '只接受 http 或 https 網址', source: 'url' };
    }
    const absolute = path.resolve(cwd, configured);
    const source: DataSourceKind = absolute === examplePath ? 'example' : 'file';
    return loadFile(absolute, source, baseMeta);
  }

  const storePath = path.resolve(cwd, ingestStorePath(options.env));
  if (storePath !== examplePath && (await fileExists(storePath))) {
    return loadFile(storePath, 'ingest', baseMeta);
  }

  return loadFile(examplePath, 'example', baseMeta);
}
