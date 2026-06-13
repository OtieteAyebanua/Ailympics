import { useState } from 'react';
import { matches, type MatchData } from '../data';
import RetroPitch from '../components/RetroPitch';
import { type TabId } from '../components/Sidebar';

type Filter = 'all' | 'live' | 'upcoming';

interface MatchesProps {
  onTabChange: (tab: TabId) => void;
  showToast: (msg: string) => void;
}

function ScoreDisplay({ match }: { match: MatchData }) {
  if (!match.score) return null;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 80, textAlign: 'right' }}>{match.homeFull}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {match.score.home}
          </span>
          <span style={{ fontSize: 22, color: 'var(--faint)', lineHeight: 1 }}>–</span>
          <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {match.score.away}
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 80, textAlign: 'left' }}>{match.awayFull}</span>
      </div>
      {match.minute !== undefined && (
        <div style={{ fontSize: 11, color: '#ff4d4d', fontWeight: 700, marginTop: 4 }}>
          {match.minute}'
        </div>
      )}
    </div>
  );
}

function MatchModal({ match, onTabChange, onClose }: { match: MatchData; onTabChange: (tab: TabId) => void; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(5px)',
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
          maxWidth: 460,
          width: '92vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{match.league}</div>
            {!match.score && (
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
                {match.homeFull}
                <span style={{ color: 'var(--faint)', fontWeight: 400, margin: '0 8px' }}>vs</span>
                {match.awayFull}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {match.live ? (
              <span style={{ fontSize: 10, background: '#ff4d4d', color: '#fff', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                LIVE
              </span>
            ) : match.kickoff ? (
              <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--bg-1)', border: '1px solid var(--line)', padding: '3px 8px', borderRadius: 4 }}>
                {match.kickoff}
              </span>
            ) : null}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* live score */}
        {match.score && <ScoreDisplay match={match} />}

        <RetroPitch defaultWidth={340} />

        <button
          className="q-btn primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 0' }}
          onClick={() => { onClose(); onTabChange('wagers'); }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x={2} y={2} width={20} height={20} rx={4} />
            <circle cx={8} cy={8} r={1.5} fill="currentColor" /><circle cx={16} cy={8} r={1.5} fill="currentColor" />
            <circle cx={8} cy={16} r={1.5} fill="currentColor" /><circle cx={16} cy={16} r={1.5} fill="currentColor" />
            <circle cx={12} cy={12} r={1.5} fill="currentColor" />
          </svg>
          Wager on this match
        </button>
      </div>
    </div>
  );
}

function MatchCard({ match, onWatch, onWager }: { match: MatchData; onWatch: () => void; onWager: () => void }) {
  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* pitch preview — non-interactive crop */}
      <div
        style={{
          height: 190,
          overflow: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: '#1a2a1a',
        }}
      >
        <RetroPitch defaultWidth={300} />
      </div>

      {/* card body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* league + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{match.league}</span>
          {match.live ? (
            <span style={{ fontSize: 10, background: '#ff4d4d22', color: '#ff4d4d', border: '1px solid #ff4d4d55', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
              ● LIVE {match.minute !== undefined ? `${match.minute}'` : ''}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--faint)', background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 4 }}>
              {match.kickoff ?? 'Upcoming'}
            </span>
          )}
        </div>

        {/* score or team names */}
        {match.score ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', flex: 1 }}>{match.homeFull}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>
              {match.score.home} – {match.score.away}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', flex: 1, textAlign: 'right' }}>{match.awayFull}</span>
          </div>
        ) : (
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>
            {match.homeFull}
            <span style={{ color: 'var(--faint)', fontWeight: 400, margin: '0 6px' }}>vs</span>
            {match.awayFull}
          </div>
        )}

        {/* buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="q-btn"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
            onClick={onWatch}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Watch
          </button>
          <button
            className="q-btn primary"
            style={{ flex: 2, justifyContent: 'center', fontSize: 12 }}
            onClick={onWager}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x={2} y={2} width={20} height={20} rx={4} />
              <circle cx={8} cy={8} r={1.5} fill="currentColor" /><circle cx={16} cy={8} r={1.5} fill="currentColor" />
              <circle cx={8} cy={16} r={1.5} fill="currentColor" />
            </svg>
            Wager on this
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Matches({ onTabChange, showToast }: MatchesProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [watchMatch, setWatchMatch] = useState<MatchData | null>(null);

  const filtered = matches.filter(m => {
    if (filter === 'live') return m.live;
    if (filter === 'upcoming') return !m.live;
    return true;
  });

  const liveCount = matches.filter(m => m.live).length;

  const handleWager = () => {
    onTabChange('wagers');
    showToast('Select a match to wager on');
  };

  return (
    <div>
      <div className="tab-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {(['all', 'live', 'upcoming'] as Filter[]).map(f => (
            <button
              key={f}
              className={`filter-pill${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              {f === 'live' && liveCount > 0 && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4d4d', display: 'inline-block' }} />
              )}
              {f === 'all' ? 'All' : f === 'live' ? `Live (${liveCount})` : 'Upcoming'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 14 }}>
            No {filter === 'live' ? 'live' : 'upcoming'} matches right now
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                onWatch={() => setWatchMatch(match)}
                onWager={handleWager}
              />
            ))}
          </div>
        )}
      </div>

      {watchMatch && (
        <MatchModal
          match={watchMatch}
          onTabChange={onTabChange}
          onClose={() => setWatchMatch(null)}
        />
      )}
    </div>
  );
}
