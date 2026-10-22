import { NextResponse } from 'next/server';
import { bearerToken, ingestConfigError, tokensMatch } from '@/lib/auth';
import { ingestStorePath, validateIngestBody, writeIngestSnapshot } from '@/lib/ingest';
import { clearLeaderboardCache } from '@/lib/leaderboard';
import { toLeaderboardView } from '@/lib/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const problem = ingestConfigError();
  if (problem === 'disabled') {
    return NextResponse.json({ error: 'ingest_disabled' }, { status: 503 });
  }
  if (problem === 'weak') {
    return NextResponse.json({ error: 'weak_token' }, { status: 503 });
  }

  const provided =
    bearerToken(request.headers.get('authorization')) ?? request.headers.get('x-ingest-token')?.trim() ?? '';
  if (!tokensMatch(provided, process.env.INGEST_TOKEN?.trim() ?? '')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type');
  if (contentType && !contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'unsupported_media' }, { status: 415 });
  }

  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 1_000_000) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const validated = validateIngestBody(raw);
  if (!validated.ok) {
    return NextResponse.json({ error: 'invalid_body', message: validated.message }, { status: 400 });
  }

  try {
    await writeIngestSnapshot(validated.data, ingestStorePath(process.env));
    clearLeaderboardCache();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = message === '不能覆寫範例資料' || message === '不能寫入環境檔' ? message : '無法儲存排行榜資料';
    console.error('ingest write failed', message);
    return NextResponse.json({ error: 'store_failed', message: safe }, { status: 500 });
  }

  const view = toLeaderboardView(validated.data, {
    example: false,
    source: 'ingest',
    loadedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, bots: view.bots.length });
}
