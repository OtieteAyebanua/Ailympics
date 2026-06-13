import { type TabId } from '../components/Sidebar';
import { type SquadState } from '../../hooks/useSquad';
import { gameHistory } from '../data';

interface OverviewProps {
  squad:       SquadState;
  onTabChange: (tab: TabId) => void;
  connected:   boolean;
}

export default function Overview({ squad, onTabChange, connected }: OverviewProps) {
  const { players, count, limit, trainingPoints } = squad;

  const portfolioValue = players
    .filter(p => p.is_nft)
    .reduce((acc, p) => acc + p.price_eth, 0)
    .toFixed(2);

  const wins  = gameHistory.filter(g => g.result === 'W').length;
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
            <div className="sc-sub">{gameHistory.length} games played</div>
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
            Live Matches
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
    </div>
  );
}
