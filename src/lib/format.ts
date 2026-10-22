const STALE_AFTER_MS = 5 * 60 * 1000;

export function formatReturn(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function returnTone(value: number | null): 'up' | 'down' | 'flat' | 'none' {
  if (value == null || !Number.isFinite(value)) return 'none';
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

export function formatTaipei(iso: string | null): string {
  if (!iso) return '—';
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

export function isStale(generatedAt: string | null, now: number, example: boolean): boolean {
  if (example || !generatedAt) return false;
  const stamp = Date.parse(generatedAt);
  if (Number.isNaN(stamp)) return false;
  return now - stamp > STALE_AFTER_MS;
}

export const STALE_MS = STALE_AFTER_MS;
