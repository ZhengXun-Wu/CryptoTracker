import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/login-form';
import { authConfigError } from '@/lib/auth';
import { isAuthenticated } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  const problem = authConfigError();
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">CryptoTracker</p>
        <h1>競賽排行榜</h1>
        <p className="lede">輸入密碼後可查看每位機器人的交易標的、損益比與持單。</p>
        {problem === 'missing' ? (
          <p className="banner warn" role="alert">
            請在環境變數設定 SITE_PASSWORD 與 SESSION_SECRET。
          </p>
        ) : null}
        {problem === 'weak' ? (
          <p className="banner warn" role="alert">
            正式環境請更換預設的 SITE_PASSWORD 與 SESSION_SECRET。
          </p>
        ) : null}
        {problem === null ? <LoginForm /> : null}
      </section>
    </main>
  );
}
