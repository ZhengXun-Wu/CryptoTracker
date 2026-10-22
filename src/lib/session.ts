import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export async function isAuthenticated(): Promise<boolean> {
  const secret = process.env.SESSION_SECRET ?? '';
  if (!secret) return false;
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, { secret });
}
