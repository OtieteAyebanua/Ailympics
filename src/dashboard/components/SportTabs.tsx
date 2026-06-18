import { useState } from 'react';

/**
 * Sport selector shown at the top of the data tabs (Squad, Marketplace,
 * Training, Wagers, Leaderboard). Football is the only live sport for now —
 * the others open a "coming soon" popup and don't change the active sport.
 */

interface Sport {
  id:    string;
  label: string;
  icon:  string;
  live:  boolean;
}

const SPORTS: Sport[] = [
  { id: 'football', label: 'Football',  icon: '⚽', live: true  },
  { id: 'f1',       label: 'Formula 1', icon: '🏎️', live: false },
  { id: 'boxing',   label: 'Boxing',    icon: '🥊', live: false },
  { id: 'tennis',   label: 'Tennis',    icon: '🎾', live: false },
];

export default function SportTabs() {
  const [comingSoon, setComingSoon] = useState<Sport | null>(null);

  return (
    <>
      <div className="sport-tabs">
        {SPORTS.map(sport => (
          <button
            key={sport.id}
            className={`sport-pill${sport.live ? ' active' : ''}${sport.live ? '' : ' locked'}`}
            onClick={() => { if (!sport.live) setComingSoon(sport); }}
            title={sport.live ? sport.label : `${sport.label} — coming soon`}
          >
            <span className="sport-pill-icon">{sport.icon}</span>
            {sport.label}
            {!sport.live && (
              <svg className="sport-pill-lock" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <rect x={3} y={11} width={18} height={11} rx={2} />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {comingSoon && (
        <div className="cs-overlay" onClick={() => setComingSoon(null)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <button className="cs-close" onClick={() => setComingSoon(null)}>✕</button>
            <div className="cs-icon">{comingSoon.icon}</div>
            <div className="cs-title">{comingSoon.label} is coming soon</div>
            <p className="cs-text">
              We're building out {comingSoon.label} on AIlympics. For now, Football is
              the only live sport — jump in and build your squad while you wait.
            </p>
            <button className="q-btn primary" onClick={() => setComingSoon(null)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
