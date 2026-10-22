'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatReturn, returnTone } from '@/lib/format';
import { isLeaderboardResult, type BotView, type LeaderboardResult, type LeaderboardView, type OrderView, type PositionView } from '@/lib/types';

type BoardProps = {
  initial: LeaderboardResult;
  pollMs: number;
};

export function Board({ initial, pollMs }: BoardProps) {
  const [result, setResult] = useState(initial);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (!response.ok) throw new Error('refresh failed');
      const payload: unknown = await response.json();
      if (!isLeaderboardResult(payload)) throw new Error('bad payload');
      setResult(payload);
      setSyncError(null);
    } catch {
      setSyncError('重新整理失敗');
    } finally {
      inflight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pollMs, refresh]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  return (
    <div className="page">
      <a className="skip" href="#overall-heading">
        跳至總排行
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="mark" aria-hidden="true">
              CT
            </span>
            <div>
              <p className="eyebrow">交易機器人競賽</p>
              <h1>CryptoTracker</h1>
            </div>
          </div>
          <div className="actions">
            {result.ok ? <Badges view={result.view} /> : null}
            {result.ok ? (
              <p className="updated">
                最後更新{' '}
                <time dateTime={result.view.updatedAt}>{result.view.updatedAtLabel}</time>
                <span className="tz"> 台北時間</span>
              </p>
            ) : null}
            <button className="ghost" type="button" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? '更新中' : '重新整理'}
            </button>
            <button className="ghost" type="button" onClick={() => void logout()}>
              登出
            </button>
          </div>
        </div>
      </header>
      <main className="wrap">
        {syncError ? (
          <p className="banner warn" role="status">
            {syncError}
          </p>
        ) : null}
        {result.ok ? <Content view={result.view} /> : (
          <p className="banner warn" role="alert">
            {result.message}
          </p>
        )}
      </main>
    </div>
  );
}

function Badges({ view }: { view: LeaderboardView }) {
  return (
    <div className="badges">
      {view.example ? <span className="badge example">範例資料</span> : null}
      {view.tradingMode === 'demo' ? <span className="badge demo">模擬盤</span> : null}
      {view.tradingMode === 'live' ? <span className="badge live">實盤</span> : null}
      {view.stale ? <span className="badge stale">更新延遲</span> : null}
    </div>
  );
}

function Content({ view }: { view: LeaderboardView }) {
  return (
    <>
      {view.notice ? <p className="banner">{view.notice}</p> : null}
      <section className="panel" aria-labelledby="overall-heading">
        <div className="section-head">
          <h2 id="overall-heading">總排行</h2>
          <p>依損益比排序</p>
        </div>
        {view.bots.length === 0 ? (
          <p className="empty">目前沒有競賽資料。</p>
        ) : (
          <ol className="ranks">
            {view.bots.map((bot) => (
              <li key={bot.name}>
                <BotCard bot={bot} />
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="panel" aria-labelledby="teams-heading">
        <div className="section-head">
          <h2 id="teams-heading">分組戰況</h2>
          <p>合計與平均只計入狀態正常且有損益比的選手。</p>
        </div>
        <div className="team-grid">
          {view.teams.map((team) => (
            <article key={team.group} className="team-card" data-tone={team.tone}>
              <header className="team-head">
                <h3>{team.group}</h3>
                <p className="count">計入 {team.scoredCount} 位</p>
              </header>
              <div className="stats">
                <div className="stat">
                  <p className="label">平均損益比</p>
                  <strong className={returnTone(team.averageReturnPct)}>{formatReturn(team.averageReturnPct)}</strong>
                </div>
                <div className="stat">
                  <p className="label">合計損益比</p>
                  <strong className={returnTone(team.totalReturnPct)}>{formatReturn(team.totalReturnPct)}</strong>
                </div>
              </div>
              {team.bots.length === 0 ? (
                <p className="empty">這一組目前沒有選手。</p>
              ) : (
                <div className="team-bots">
                  {team.bots.map((bot) => (
                    <BotCard key={bot.name} bot={bot} compact />
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      <p className="footer-note">唯讀競賽排行榜</p>
    </>
  );
}

function BotCard({ bot, compact = false }: { bot: BotView; compact?: boolean }) {
  const Heading = compact ? 'h4' : 'h3';
  return (
    <article className={compact ? 'bot-card compact' : 'bot-card'} data-team={bot.group} data-place={bot.rank} data-scored={bot.scored ? 'yes' : 'no'}>
      <div className="place" aria-hidden="true">
        {String(bot.rank).padStart(2, '0')}
      </div>
      <div className="identity">
        <p className="sr-only">第 {bot.rank} 名</p>
        <Heading>{bot.name}</Heading>
        <div className="meta-row">
          <span className="team-pill" data-team={bot.group}>
            {bot.group}
          </span>
          <StatusChip status={bot.status} />
        </div>
      </div>
      <div className={`score ${returnTone(bot.returnPct)}`}>
        <p className="label">損益比</p>
        <strong>{formatReturn(bot.returnPct)}</strong>
      </div>
      <div className="instruments">
        <p className="label">交易標的</p>
        {bot.instruments.length === 0 ? (
          <p className="empty">尚無交易標的</p>
        ) : (
          <ul className="chips">
            {bot.instruments.map((instrument) => (
              <li key={instrument}>{instrument}</li>
            ))}
          </ul>
        )}
      </div>
      <Book bot={bot} />
    </article>
  );
}

function StatusChip({ status }: { status: BotView['status'] }) {
  if (status === 'ok') return null;
  return (
    <span className="chip status" data-status={status}>
      {status}
    </span>
  );
}

function Book({ bot }: { bot: BotView }) {
  const opens = bot.orders.filter((order) => order.kind === 'open');
  const algos = bot.orders.filter((order) => order.kind === 'algo');
  const empty = bot.positions.length === 0 && opens.length === 0 && algos.length === 0;
  return (
    <div className="book">
      <p className="label">持單</p>
      {empty ? (
        <p className="empty">目前沒有持單</p>
      ) : (
        <div className="book-groups">
          {bot.positions.length > 0 ? (
            <div>
              <p className="sublabel">持倉</p>
              <ul>
                {bot.positions.map((position, index) => (
                  <li key={`${position.instrument}-${index}`}>
                    <PositionLine position={position} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {opens.length > 0 ? (
            <div>
              <p className="sublabel">委託</p>
              <ul>
                {opens.map((order, index) => (
                  <li key={`${order.instrument}-open-${index}`}>
                    <OrderLine order={order} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {algos.length > 0 ? (
            <div>
              <p className="sublabel">策略單</p>
              <ul>
                {algos.map((order, index) => (
                  <li key={`${order.instrument}-algo-${index}`}>
                    <OrderLine order={order} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PositionLine({ position }: { position: PositionView }) {
  return (
    <>
      <span>{position.instrument}</span>
      {position.side ? <span>{position.side}</span> : null}
      {position.size ? <span>數量 {position.size}</span> : null}
      {position.entryPrice ? <span>均價 {position.entryPrice}</span> : null}
    </>
  );
}

function OrderLine({ order }: { order: OrderView }) {
  const showType = order.orderType !== '委託' && order.orderType !== '策略單';
  return (
    <>
      <span>{order.instrument}</span>
      {order.side ? <span>{order.side}</span> : null}
      {showType ? <span>{order.orderType}</span> : null}
      {order.price ? <span>價格 {order.price}</span> : null}
      {order.size ? <span>數量 {order.size}</span> : null}
      {order.stopLoss ? <span>停損 {order.stopLoss}</span> : null}
      {order.takeProfit ? <span>停利 {order.takeProfit}</span> : null}
    </>
  );
}
