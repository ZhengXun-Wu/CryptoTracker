import { redirect } from 'next/navigation';
import { Board } from '@/components/board';
import { getLeaderboard, pollIntervalMs } from '@/lib/leaderboard';
import { isAuthenticated } from '@/lib/session';
import type { LeaderboardResult } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HomePage() {
  if (!(await isAuthenticated())) redirect('/login');
  let result: LeaderboardResult;
  try {
    result = await getLeaderboard();
  } catch (error) {
    console.error('leaderboard failed', error instanceof Error ? error.message : 'unknown');
    result = { ok: false, message: '排行榜暫時無法讀取', source: 'unconfigured' };
  }
  return <Board initial={result} pollMs={pollIntervalMs()} />;
}
