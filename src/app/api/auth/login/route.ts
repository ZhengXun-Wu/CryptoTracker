import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  authConfigError,
  clientAddress,
  createRateLimiter,
  passwordsMatch,
  sessionCookieOptions,
  signSession,
} from '@/lib/auth';

const loginLimiter = createRateLimiter(8, 10 * 60 * 1000);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (authConfigError()) {
    return NextResponse.json({ error: 'unconfigured' }, { status: 503 });
  }

  let password = '';
  try {
    const bodyText = await request.text();
    if (bodyText.length <= 4000) {
      const body = JSON.parse(bodyText) as { password?: unknown };
      if (typeof body.password === 'string' && body.password.length <= 200) password = body.password;
    }
  } catch {
    password = '';
  }

  if (!passwordsMatch(password, process.env.SITE_PASSWORD ?? '')) {
    if (!loginLimiter.allow(clientAddress(request))) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: signSession({ secret: process.env.SESSION_SECRET ?? '' }),
    ...sessionCookieOptions(),
  });
  return response;
}
