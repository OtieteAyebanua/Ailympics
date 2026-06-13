import { managers } from '../data';

const medals = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  return (
    <div>
      <div className="lb-header">
        <div>
          <div className="tab-title" style={{ marginBottom: 4 }}>Season 1 standings</div>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Updated every match. Top 3 managers split the prize pool when the season closes.
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
            <b className="mono">Ξ 820</b>
            <span>Season prize pool</span>
          </div>
        </div>
      </div>

      <div className="board">
        <div className="lr head">
          <div>Rank</div>
          <div>Manager</div>
          <div>W / L</div>
          <div className="col-streak">Streak</div>
          <div className="winnings" style={{ textAlign: 'right' }}>Winnings</div>
        </div>
        {managers.map((m, i) => (
          <div key={m.name} className={`lr${i < 3 ? ` top${i + 1}` : ''}`}>
            <div className="rank">{medals[i] ?? `#${i + 1}`}</div>
            <div className="mgr">
              <div className="av">{m.name.slice(0, 2).toUpperCase()}</div>
              <div className="mn">
                <b>{m.name}</b>
                <span>{m.addr}</span>
              </div>
            </div>
            <div className="wl"><span className="w">{m.wins}W</span> · {m.losses}L</div>
            <div className="streak col-streak">{m.streak}</div>
            <div className="winnings"><span className="tk">Ξ</span>{m.winnings}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
