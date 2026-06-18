import SportTabs from '../components/SportTabs';

export default function Leaderboard() {
  return (
    <div>
      <SportTabs />
      <div className="lb-header">
        <div>
          <div className="tab-title" style={{ marginBottom: 4 }}>Season 1 standings</div>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Live rankings based on completed matches.
          </p>
        </div>
        <div className="lb-prize">
          <div className="lp-icon">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9a6 6 0 0012 0V3H6z" />
              <path d="M4 5H2v2a4 4 0 004 4M20 5h2v2a4 4 0 01-4 4M9 21h6M12 17v4" />
            </svg>
          </div>
          <div>
            <b className="mono">0 managers</b>
            <span>have played this season</span>
          </div>
        </div>
      </div>

      <div className="empty-state">
        <div className="empty-icon">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M6 9a6 6 0 0012 0V3H6z" />
            <path d="M4 5H2v2a4 4 0 004 4M20 5h2v2a4 4 0 01-4 4M9 21h6M12 17v4" />
          </svg>
        </div>
        <h3>Standings coming soon</h3>
        <p>Rankings will return once the new agenticfoot match engine is live.</p>
      </div>
    </div>
  );
}
