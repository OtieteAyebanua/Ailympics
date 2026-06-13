import { useState } from 'react';
import { type TabId } from '../components/Sidebar';
import { type Player, gameHistory, matches, type MatchData } from '../data';
import RetroPitch from '../components/RetroPitch';

interface OverviewProps {
  ownedPlayers: Player[];
  onTabChange: (tab: TabId) => void;
  connected: boolean;
}

function MatchModal({ match, onClose }: { match: MatchData; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: 440,
          width: '90vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{match.league}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>
              {match.homeFull} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>vs</span> {match.awayFull}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {match.live && (
              <span style={{ fontSize: 10, background: '#ff4d4d', color: '#fff', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                LIVE
              </span>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ✕
            </button>
          </div>
        </div>

        <RetroPitch defaultWidth={320} />

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {match.odds.map((odd, i) => {
            const labels = ['Home', 'Draw', 'Away'];
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center', background: 'var(--bg-1)', borderRadius: 8, padding: '8px 4px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{labels[i]}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{odd ?? '—'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Overview({ ownedPlayers, onTabChange, connected }: OverviewProps) {
  const [activeMatch, setActiveMatch] = useState<MatchData | null>(null);

  const portfolioValue = ownedPlayers
    .reduce((acc, p) => acc + parseFloat(p.price), 0)
    .toFixed(1);

  const liveMatches = matches.filter(m => m.live);

  const wins   = gameHistory.filter(g => g.result === 'W').length;
  const losses = gameHistory.filter(g => g.result === 'L').length;
  const draws  = gameHistory.filter(g => g.result === 'D').length;

  return (
    <div>
      <div className="tab-section">
        <div className="tab-title">Season 1 — Week 4</div>
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
              {ownedPlayers.length > 0 ? portfolioValue : '0.0'}
            </div>
            <div className="sc-sub">{ownedPlayers.length} player{ownedPlayers.length !== 1 ? 's' : ''} owned</div>
          </div>

          <div className="stat-card">
            <div className="sc-label">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx={9} cy={7} r={4} />
              </svg>
              Squad Size
            </div>
            <div className="sc-value">{ownedPlayers.length}<span className="sc-unit" style={{ fontSize: 14 }}> / 25</span></div>
            <div className="sc-sub">
              {ownedPlayers.filter(p => p.sport === 'football').length} football players
            </div>
          </div>

          <div className="stat-card">
            <div className="sc-label">
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={2} y={2} width={20} height={20} rx={4} />
                <circle cx={8} cy={8} r={1.2} fill="currentColor" /><circle cx={16} cy={8} r={1.2} fill="currentColor" />
                <circle cx={8} cy={16} r={1.2} fill="currentColor" /><circle cx={16} cy={16} r={1.2} fill="currentColor" />
                <circle cx={12} cy={12} r={1.2} fill="currentColor" />
              </svg>
              Active Wagers
            </div>
            <div className="sc-value">0</div>
            <div className="sc-sub">Ξ 0.0 at stake</div>
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
            <div className="sc-sub">{gameHistory.length} games played</div>
          </div>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <div className="tab-section">
          <div className="tab-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Live Matches
            <span style={{ fontSize: 10, background: '#ff4d4d', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em' }}>
              {liveMatches.length} LIVE
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liveMatches.map(match => (
              <button
                key={match.id}
                onClick={() => setActiveMatch(match)}
                style={{
                  width: '100%',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--accent) 6%, var(--bg-1))';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-1)';
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{match.league}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                    {match.homeFull} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>vs</span> {match.awayFull}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, background: '#ff4d4d22', color: '#ff4d4d', border: '1px solid #ff4d4d55', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                    ● LIVE
                  </span>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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
          <button className="q-btn" onClick={() => onTabChange('wagers')}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x={2} y={2} width={20} height={20} rx={4} />
            </svg>
            Place Wager
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
              Connect your wallet to buy players, place wagers, and track your season.
            </span>
          </div>
        </div>
      )}

      <div className="tab-section">
        <div className="tab-title">Game History</div>
        <div className="activity-feed">
          {gameHistory.map(g => (
            <div key={g.id} className="activity-row">
              <div className={`gh-badge gh-badge--${g.result === 'W' ? 'win' : g.result === 'L' ? 'loss' : 'draw'}`}>
                {g.result}
              </div>
              <div className="act-text">
                <b>{g.opponent}</b>
                <span>{g.league}</span>
              </div>
              <div className="gh-score">{g.score}</div>
              <div className="gh-date">{g.date}</div>
              <div className={`act-amount ${g.earnings.startsWith('−') ? 'gh-neg' : ''}`}>
                {g.earnings}
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeMatch && (
        <MatchModal match={activeMatch} onClose={() => setActiveMatch(null)} />
      )}
    </div>
  );
}
