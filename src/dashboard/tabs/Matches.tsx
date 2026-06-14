import { useState, useEffect } from 'react';
import MatchViewer from '../components/MatchViewer';
import { listMyMatches, type DbSimMatch } from '../../lib/matchRoom';
import { getSessionWallet } from '../../lib/auth';

function resultOf(m: DbSimMatch, myWallet: string | null) {
  const isHome = m.home_wallet === myWallet;
  const my  = isHome ? m.home_score : m.away_score;
  const opp = isHome ? m.away_score : m.home_score;
  if (my > opp)  return 'W';
  if (my < opp)  return 'L';
  return 'D';
}

function oppLabel(m: DbSimMatch, myWallet: string | null) {
  const opp = m.home_wallet === myWallet ? m.away_wallet : m.home_wallet;
  if (!opp) return 'AI';
  return `${opp.slice(0, 6)}…${opp.slice(-4)}`;
}

function MatchRow({
  match, myWallet, onReplay, active,
}: {
  match: DbSimMatch; myWallet: string | null;
  onReplay: () => void; active: boolean;
}) {
  const result = resultOf(match, myWallet);
  const resultColor = result === 'W' ? 'var(--accent)' : result === 'L' ? '#ff4d4d' : 'var(--muted)';
  const date = new Date(match.finished_at ?? match.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div style={{
      background: active ? 'rgba(var(--accent-rgb, 0,255,128), 0.05)' : 'var(--bg-1)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
      borderRadius: 10,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      {/* Result badge */}
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: `${resultColor}22`,
        border: `1px solid ${resultColor}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: resultColor,
      }}>
        {result}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 2 }}>
          vs {oppLabel(match, myWallet)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{date}</div>
      </div>

      {/* Score */}
      <div style={{
        fontSize: 20, fontWeight: 800, color: 'var(--fg)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: 2, flexShrink: 0,
      }}>
        {match.home_score} – {match.away_score}
      </div>

      {/* Replay */}
      <button
        className={`q-btn${active ? ' primary' : ''}`}
        style={{ fontSize: 11, flexShrink: 0 }}
        onClick={onReplay}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polygon points="5,3 19,12 5,21" />
        </svg>
        {active ? 'Watching' : 'Replay'}
      </button>
    </div>
  );
}

export default function Matches() {
  const wallet = getSessionWallet();
  const [matches, setMatches] = useState<DbSimMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayId, setReplayId] = useState<string | undefined>();

  useEffect(() => {
    listMyMatches(50).then(m => { setMatches(m); setLoading(false); });
  }, []);

  // After a new simulation finishes, refresh the history list
  const handleSimFinished = () => {
    listMyMatches(50).then(setMatches);
  };

  const isReplay = !!replayId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Viewer ── */}
      <div className="tab-section">
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {isReplay ? 'Replay' : 'Simulation'}
          </div>
          {isReplay && (
            <button
              className="q-btn"
              style={{ fontSize: 11 }}
              onClick={() => setReplayId(undefined)}
            >
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              New match
            </button>
          )}
        </div>
        <MatchViewer
          key={replayId ?? 'new'}
          matchId={replayId}
          height="480px"
          onFinished={handleSimFinished}
        />
      </div>

      {/* ── Match history ── */}
      <div className="tab-section">
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--muted)',
          letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
        }}>
          Match History
        </div>

        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>
            Loading…
          </div>
        ) : matches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx={12} cy={12} r={10} />
                <path d="M12 8v4l3 3" />
              </svg>
            </div>
            <h3>No matches yet</h3>
            <p>Run a simulation above to play your first match.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matches.map(m => (
              <MatchRow
                key={m.id}
                match={m}
                myWallet={wallet}
                active={replayId === m.id}
                onReplay={() => {
                  setReplayId(m.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
