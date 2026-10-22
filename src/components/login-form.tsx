'use client';

import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        window.location.assign('/');
        return;
      }
      if (response.status === 429) {
        setError('嘗試次數過多，請稍後再試');
      } else if (response.status === 503) {
        setError('伺服器尚未完成登入設定');
      } else {
        setError('密碼不正確');
      }
      setPending(false);
    } catch {
      setError('暫時無法登入');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="password">密碼</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoCapitalize="off"
        spellCheck={false}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={pending}>
        {pending ? '登入中' : '進入排行榜'}
      </button>
    </form>
  );
}
