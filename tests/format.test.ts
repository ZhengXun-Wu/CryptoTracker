import { describe, expect, it } from 'vitest';
import { formatReturn, formatTaipei, isStale, returnTone } from '../src/lib/format';
import { parseNumber } from '../src/lib/normalize';
import { pollIntervalMs } from '../src/lib/leaderboard';

describe('numbers and labels', () => {
  it('parses gateway numbers that arrive as strings', () => {
    expect(parseNumber('18.64')).toBe(18.64);
    expect(parseNumber('-1.40')).toBe(-1.4);
    expect(parseNumber('1,234.50')).toBe(1234.5);
    expect(parseNumber('+2.50%')).toBe(2.5);
    expect(parseNumber('＋3％')).toBe(3);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber('不是數字')).toBeNull();
  });

  it('formats return percentages', () => {
    expect(formatReturn(18.64)).toBe('+18.64%');
    expect(formatReturn(-1.4)).toBe('-1.40%');
    expect(formatReturn(0)).toBe('0.00%');
    expect(formatReturn(null)).toBe('—');
    expect(returnTone(1)).toBe('up');
    expect(returnTone(-1)).toBe('down');
    expect(returnTone(0)).toBe('flat');
    expect(returnTone(null)).toBe('none');
  });

  it('formats timestamps in Taipei time', () => {
    const label = formatTaipei('2026-10-22T06:40:00Z');
    expect(label).toContain('2026');
    expect(label).toContain('14');
    expect(label).toContain('40');
    expect(formatTaipei(null)).toBe('—');
  });

  it('marks old live snapshots stale and leaves example data alone', () => {
    const now = Date.parse('2026-10-22T08:00:00Z');
    expect(isStale('2026-10-22T06:40:00Z', now, false)).toBe(true);
    expect(isStale('2026-10-22T06:40:00Z', now, true)).toBe(false);
    expect(isStale(null, now, false)).toBe(false);
  });

  it('clamps the poll interval', () => {
    expect(pollIntervalMs({})).toBe(15000);
    expect(pollIntervalMs({ POLL_MS: '1000' })).toBe(5000);
    expect(pollIntervalMs({ POLL_MS: '9999999' })).toBe(300000);
    expect(pollIntervalMs({ POLL_MS: 'nope' })).toBe(15000);
  });
});
