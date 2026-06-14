import { useState, useEffect } from 'react';
import { type TabId } from '../components/Sidebar';
import { type SquadState } from '../../hooks/useSquad';
import { listMyMatches, type DbSimMatch } from '../../lib/matchRoom';
import { getSessionWallet } from '../../lib/auth';

interface OverviewProps {
  squad:       SquadState;
  onTabChange: (tab: TabId) => void;
  connected:   boolean;
}

function resultOf(m: DbSimMatch, wallet: string | null) {
  const isHome = m.home_wallet === wallet;
  const my  = isHome ? m.home_score : m.away_score;
  const opp = isHome ? m.away_score : m.home_score;
  if (my > opp) return 'W';
  if (my < opp) return 'L';
  return 'D';
}

function oppLabel(m: DbSimMatch, wallet: string | null) {
  const opp = m.home_wallet === wallet ? m.away_wallet : m.home_wallet;
  if (!opp) return 'AI';
  return `${opp.slice(0, 6)}…${opp.slice(-4)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Overview({ squad, onTabChange, connected }: OverviewProps) {
  const { players, count, limit, trainingPoints } = squad;
  const wallet = getSessionWallet();

  const [matches,  setMatches]  = useState<DbSimMatch[]>([]);
  const [loadingM, setLoadingM] = useState(true);

  useEffect(() => {
    listMyMatches(20).then(m => { setMatches(m); setLoadingM(false); });
  }, []);

  const portfolioValue = players
    .filter(p => p.is_nft)
    .reduce((acc, p) => acc + p.price_eth, 0)
    .toFixed(2);

  const finished = matches.filter(m => m.status === 'finished');
  const wins   = finished.filter(m => resultOf(m, wallet) === 'W').length;
  const losses = finished.filter(m => resultOf(m, wallet) === 'L').length;
  const draws  = finished.filter(m => resultOf(m, wallet) === 'D').length;

  return (
    <div>
      <div className="tab-section">
        <div className="tab-title">Season 1 — Overview</div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="sc-label">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx={12} cy={12} r={9} /><path d="M12 6v6l4 2" />
              </svg>
              Portfolio Value
            </div>
            <div className="sc-value">
              <span className="sc-unit">Ξ </span>
              {players.length > 0 ? portfolioValue : '0.00'}
            </div>
            <div className="sc-sub">{players.filter(p => p.is_nft).length} NFT player{players.filter(p => p.is_nft).length !== 1 ? 's' : ''} owned</div>
          </div>

          <div className="stat-card">
            <div className="sc-label">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx={9} cy={7} r={4} />
              </svg>
              Squad Size
            </div>
            <div className="sc-value">
              {count}<span className="sc-unit" style={{ fontSize: 14 }}> / {limit}</span>
            </div>
            <div className="sc-sub">
              {players.filter(p => p.sport === 'football').length} football players
            </div>
          </div>

          <div className="stat-card">
            <div className="sc-label">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Training Points
            </div>
            <div className="sc-value">{trainingPoints}</div>
            <div className="sc-sub">Available to spend</div>
          </div>

          <div className="stat-card">
            <div className="sc-label">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 9a6 6 0 0012 0V3H6z" /><path d="M9 21h6M12 17v4" />
              </svg>
              Season Record
            </div>
            <div className="sc-value">
              {wins}<span className="sc-unit" style={{ fontSize: 14 }}>W</span>
              {' '}{losses}<span className="sc-unit" style={{ fontSize: 14, color: '#ff7a7a' }}>L</span>
              {' '}{draws}<span className="sc-unit" style={{ fontSize: 14, color: 'var(--faint)' }}>D</span>
            </div>
            <div className="sc-sub">{finished.length} match{finished.length !== 1 ? 'es' : ''} played</div>
          </div>
        </div>
      </div>

      <div className="tab-section">
        <div className="tab-title">Quick Actions</div>
        <div className="quick-actions">
          <button className="q-btn primary" onClick={() => onTabChange('marketplace')}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1={3} y1={6} x2={21} y2={6} />
            </svg>
            Sign Players
          </button>
          <button className="q-btn" onClick={() => onTabChange('strategy')}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
            </svg>
            Set Tactics
          </button>
          <button className="q-btn" onClick={() => onTabChange('training')}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Train Squad
          </button>
          <button className="q-btn" onClick={() => onTabChange('matches')}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} /><polygon points="10,8 16,12 10,16" />
            </svg>
            Play Match
          </button>
        </div>
      </div>

      {!connected && (
        <div className="tab-section">
          <div style={{ background: 'color-mix(in oklab, var(--accent) 10%, transparent)', border: '1px solid color-mix(in oklab, var(--accent) 30%, transparent)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} /><path d="M12 8v4M12 16h.01" />
            </svg>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>
              Connect your wallet to buy players, play matches, and track your season.
            </span>
          </div>
        </div>
      )}

      <div className="tab-section">
        <div className="tab-title">Match History</div>

        {loadingM ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: '16px 0' }}>Loading…</div>
        ) : finished.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: '16px 0' }}>
            No matches yet — head to{' '}
            <button
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}
              onClick={() => onTabChange('matches')}
            >
              Matches
            </button>
            {' '}to play your first.
          </div>
        ) : (
          <div className="activity-feed">
            {finished.slice(0, 8).map(m => {
              const result = resultOf(m, wallet);
              return (
                <div key={m.id} className="activity-row">
                  <div className={`gh-badge gh-badge--${result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw'}`}>
                    {result}
                  </div>
                  <div className="act-text">
                    <b>vs {oppLabel(m, wallet)}</b>
                    <span>AIlympics 5v5</span>
                  </div>
                  <div className="gh-score">{m.home_score} – {m.away_score}</div>
                  <div className="gh-date">{fmtDate(m.finished_at ?? m.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
