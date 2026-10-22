import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppEnv } from '@/lib/types';

export const EXAMPLE_RELATIVE = 'data/example-leaderboard.json';

export function ingestStorePath(env: AppEnv): string {
  return env.INGEST_STORE_PATH?.trim() || 'data/live-leaderboard.json';
}

export function assertSafeStorePath(storePath: string, cwd: string): string {
  const trimmed = storePath.trim();
  if (!trimmed) throw new Error('缺少儲存路徑');
  const absolute = path.resolve(cwd, trimmed);
  const example = path.resolve(cwd, EXAMPLE_RELATIVE);
  if (absolute === example) throw new Error('不能覆寫範例資料');
  const base = path.basename(absolute);
  if (base === '.env' || base.startsWith('.env.')) throw new Error('不能寫入環境檔');
  return absolute;
}

export function validateIngestBody(
  value: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: '內容必須是 JSON 物件' };
  }
  const data = value as Record<string, unknown>;
  if (!('ranking' in data) && !('groups' in data) && !('bots' in data)) {
    return { ok: false, message: '缺少 ranking、groups 或 bots' };
  }
  return { ok: true, data };
}

export async function writeIngestSnapshot(data: unknown, storePath: string, cwd = process.cwd()): Promise<string> {
  const absolute = assertSafeStorePath(storePath, cwd);
  await mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, absolute);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return absolute;
}
