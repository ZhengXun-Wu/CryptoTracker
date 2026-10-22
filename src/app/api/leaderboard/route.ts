import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/leaderboard';
import { isAuthenticated } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await getLeaderboard());
  } catch (error) {
    console.error('leaderboard failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { ok: false, message: '排行榜暫時無法讀取', source: 'unconfigured' },
      { status: 500 },
    );
  }
}
