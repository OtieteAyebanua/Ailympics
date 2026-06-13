import { type TabId } from '../components/Sidebar';
import { type Player } from '../data';

interface OverviewProps {
  ownedPlayers: Player[];
  onTabChange: (tab: TabId) => void;
  connected: boolean;
}

const recentActivity = [
  { icon: '🛒', label: 'Signed M. Okafor', sub: 'Striker · Football', amount: '−Ξ 4.2' },
  { icon: '🏆', label: 'Won vs Nova FC', sub: 'Ailympics Premier', amount: '+Ξ 2.8' },
  { icon: '⚡', label: 'Training session', sub: 'M. Okafor · Pace +1', amount: '−Ξ 0.4' },
  { icon: '🎲', label: 'Wager settled', sub: 'Home win · Nova FC', amount: '+Ξ 4.2' },
];

export default function Overview({ ownedPlayers, onTabChange, connected }: OverviewProps) {
  const portfolioValue = ownedPlayers
    .reduce((acc, p) => acc + parseFloat(p.price), 0)
    .toFixed(1);

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
              {ownedPlayers.filter(p => p.sport === 'football').length} football · {ownedPlayers.filter(p => p.sport === 'tennis').length} tennis
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
              Season Rank
            </div>
            <div className="sc-value">—</div>
            <div className="sc-sub">Play matches to rank</div>
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
        <div className="tab-title">Recent Activity</div>
        <div className="activity-feed">
          {recentActivity.map((a, i) => (
            <div key={i} className="activity-row">
              <div className="act-icon" style={{ fontSize: 15 }}>{a.icon}</div>
              <div className="act-text">
                <b>{a.label}</b>
                <span>{a.sub}</span>
              </div>
              <div className="act-amount">{a.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
