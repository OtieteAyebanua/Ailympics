import { useState, useEffect } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '../../lib/matchRoom';
import { getSessionWallet } from '../../lib/auth';

const medals = ['🥇', '🥈', '🥉'];
const fmt = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWallet = getSessionWallet();

  useEffect(() => {
    fetchLeaderboard().then(e => { setEntries(e); setLoading(false); });
  }, []);

  return (
    <div>
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
            <b className="mono">{entries.length} managers</b>
            <span>have played this season</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
          Loading standings…
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M6 9a6 6 0 0012 0V3H6z" />
              <path d="M4 5H2v2a4 4 0 004 4M20 5h2v2a4 4 0 01-4 4M9 21h6M12 17v4" />
            </svg>
          </div>
          <h3>No matches played yet</h3>
          <p>Play your first match to appear on the leaderboard.</p>
        </div>
      ) : (
        <div className="board">
          <div className="lr head">
            <div>Rank</div>
            <div>Manager</div>
            <div>W / L / D</div>
            <div className="col-streak">GD</div>
            <div className="winnings" style={{ textAlign: 'right' }}>GF : GA</div>
          </div>
          {entries.map((e, i) => {
            const isMe = e.wallet === currentWallet;
            return (
              <div key={e.wallet} className={`lr${i < 3 ? ` top${i + 1}` : ''}${isMe ? ' self' : ''}`}
                style={isMe ? { outline: '1px solid var(--accent)', outlineOffset: -1 } : undefined}
              >
                <div className="rank">{medals[i] ?? `#${i + 1}`}</div>
                <div className="mgr">
                  <div className="av" style={isMe ? { background: 'var(--accent)', color: '#000' } : undefined}>
                    {e.wallet.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="mn">
                    <b>{isMe ? 'You' : fmt(e.wallet)}</b>
                    <span>{e.played} match{e.played !== 1 ? 'es' : ''}</span>
                  </div>
                </div>
                <div className="wl">
                  <span className="w">{e.wins}W</span> · {e.losses}L · {e.draws}D
                </div>
                <div className="col-streak" style={{
                  color: e.gd > 0 ? 'var(--accent)' : e.gd < 0 ? '#ff4d4d' : 'var(--muted)',
                  fontWeight: 700,
                }}>
                  {e.gd > 0 ? '+' : ''}{e.gd}
                </div>
                <div className="winnings" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {e.gf} : {e.ga}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
