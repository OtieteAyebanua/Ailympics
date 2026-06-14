import { useState, useRef, useEffect } from 'react';
import RetroPitchStrategy, { type RetroPitchStrategyHandle } from '../components/RetroPitchStrategy';
import { DEFAULT_HOME_433, type PlayerPos } from '../components/RetroPitch';
import {
  loadStrategy, saveStrategy,
  type Formation, type Mentality, type Pressing, type Tempo,
} from '../../lib/strategy';
import { pitchPctToWorld } from '../../lib/pitchUtils';
import { getSessionWallet } from '../../lib/auth';

interface StrategyProps {
  showToast: (msg: string) => void;
}

// ── 5v5 Formation presets (1 GK + 4 outfield) ────────────────────────────────

// Defensive: GK + 3CB + 1ST
const F442: PlayerPos[] = [
  { id: 1, x: 50, y: 6,  num: 1 },
  { id: 2, x: 25, y: 19, num: 5 }, { id: 3, x: 50, y: 17, num: 4 }, { id: 4, x: 75, y: 19, num: 3 },
  { id: 5, x: 50, y: 44, num: 9 },
];

// Diamond: GK + 1CB + 2CM + 1ST
const F352: PlayerPos[] = [
  { id: 1, x: 50, y: 6,  num: 1 },
  { id: 2, x: 50, y: 18, num: 5 },
  { id: 3, x: 25, y: 32, num: 8 }, { id: 4, x: 75, y: 32, num: 10 },
  { id: 5, x: 50, y: 46, num: 9 },
];

// Attacking: GK + 1CB + 1CM + 2ST
const F532: PlayerPos[] = [
  { id: 1, x: 50, y: 6,  num: 1 },
  { id: 2, x: 50, y: 18, num: 5 },
  { id: 3, x: 50, y: 31, num: 8 },
  { id: 4, x: 30, y: 44, num: 9 }, { id: 5, x: 70, y: 44, num: 11 },
];

// Direct: GK + 2CB + 2ST
const F4231: PlayerPos[] = [
  { id: 1, x: 50, y: 6,  num: 1 },
  { id: 2, x: 35, y: 19, num: 5 }, { id: 3, x: 65, y: 19, num: 4 },
  { id: 4, x: 35, y: 44, num: 9 }, { id: 5, x: 65, y: 44, num: 11 },
];

const FORMATIONS: Record<Formation, { label: string; players: PlayerPos[] }> = {
  '433':  { label: 'Balanced',   players: DEFAULT_HOME_433 },  // GK + 2CB + 1CM + 1ST
  '442':  { label: 'Defensive',  players: F442 },              // GK + 3CB + 1ST
  '352':  { label: 'Diamond',    players: F352 },              // GK + 1CB + 2CM + 1ST
  '532':  { label: 'Attacking',  players: F532 },              // GK + 1CB + 1CM + 2ST
  '4231': { label: 'Direct',     players: F4231 },             // GK + 2CB + 2ST
};

// ── Option config ──────────────────────────────────────────────────────────────

const MENTALITY_OPTIONS: { value: Mentality; label: string; desc: string }[] = [
  { value: 'defensive', label: 'Defensive',  desc: 'Sit deep, absorb pressure, hit on the counter' },
  { value: 'balanced',  label: 'Balanced',   desc: 'Solid shape with controlled attacking transitions' },
  { value: 'attacking', label: 'Attacking',  desc: 'Push high, commit players forward, high variance' },
];

const PRESSING_OPTIONS: { value: Pressing; label: string; desc: string }[] = [
  { value: 'low_block',      label: 'Low Block',      desc: 'Drop deep, stay compact, let them have the ball' },
  { value: 'mid_press',      label: 'Mid Press',      desc: 'Press from the middle third, balanced energy use' },
  { value: 'high_press',     label: 'High Press',     desc: 'Win the ball high up the pitch, drains stamina' },
  { value: 'gegenpressing',  label: 'Gegenpressing',  desc: 'Immediate press after losing ball — needs pace & stamina' },
];

const TEMPO_OPTIONS: { value: Tempo; label: string; desc: string }[] = [
  { value: 'slow',   label: 'Slow Build-up',    desc: 'Patient possession, exploit passing stats' },
  { value: 'normal', label: 'Normal',            desc: 'Balanced tempo, adapt to the situation' },
  { value: 'direct', label: 'Direct',            desc: 'Quick vertical passes, exploit finishing stats' },
  { value: 'fast',   label: 'Fast Transition',   desc: 'Rapid counter-attacks, exploit pace stats' },
];

// ── Selector component ─────────────────────────────────────────────────────────

function OptionSelector<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: T; label: string; desc: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="strat-selector">
      <div className="strat-selector-label">{label}</div>
      <div className="strat-selector-options">
        {options.map(opt => (
          <button
            key={opt.value}
            className={`strat-option${value === opt.value ? ' active' : ''}`}
            onClick={() => onChange(opt.value)}
            title={opt.desc}
          >
            {opt.label}
            {value === opt.value && (
              <span className="strat-option-desc">{opt.desc}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Strategy({ showToast }: StrategyProps) {
  const [formation, setFormation] = useState<Formation>('433');
  const [mentality, setMentality] = useState<Mentality>('balanced');
  const [pressing,  setPressing]  = useState<Pressing>('mid_press');
  const [tempo,     setTempo]     = useState<Tempo>('normal');
  const [saving,    setSaving]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [savedAt,   setSavedAt]   = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const pitchRef = useRef<RetroPitchStrategyHandle>(null);

  // Load saved strategy on mount
  const [savedPositions, setSavedPositions] = useState<PlayerPos[]>([]);

  useEffect(() => {
    const wallet = getSessionWallet();
    console.log('[Strategy] loading for wallet:', wallet);

    loadStrategy().then(saved => {
      if (saved) {
        setFormation(saved.formation);
        setMentality(saved.mentality);
        setPressing(saved.pressing);
        setTempo(saved.tempo);
        setSavedPositions(saved.playerPositions.map(({ world: _w, ...p }) => p));
        setSavedAt(saved.updatedAt ?? null);
        console.log('[Strategy] loaded from DB:', {
          formation: saved.formation,
          mentality: saved.mentality,
          pressing: saved.pressing,
          tempo: saved.tempo,
          positions: saved.playerPositions.length,
          updatedAt: saved.updatedAt,
        });
      } else {
        console.log('[Strategy] no saved strategy found — using defaults');
      }
    }).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      console.error('[Strategy] load error:', msg);
    }).finally(() => setLoading(false));
  }, []);

  const handleFormationChange = (key: Formation) => {
    setFormation(key);
    setSavedPositions([]);
    pitchRef.current?.reset();
  };

  const handleSave = async () => {
    setSaving(true);
    const raw = pitchRef.current?.getPlayers() ?? [];
    const playerPositions = raw.map(p => ({ ...p, world: pitchPctToWorld(p.x, p.y) }));
    const err = await saveStrategy({ formation, mentality, pressing, tempo, playerPositions });
    setSaving(false);
    if (err) {
      showToast(`Save failed: ${err}`);
      console.error('[Strategy] save failed:', err);
    } else {
      const now = new Date().toISOString();
      setSavedAt(now);
      setSavedPositions(raw);
      showToast('Strategy saved — applies to all upcoming matches');
      console.log('[Strategy] saved:', { formation, mentality, pressing, tempo, positions: raw.length });
    }
  };

  const handleReset = () => {
    pitchRef.current?.reset();
    showToast('Formation reset to default');
  };

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (loading) {
    return (
      <div className="tab-section" style={{ color: 'var(--muted)', fontSize: 14, padding: '48px 0', textAlign: 'center' }}>
        Loading strategy…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Tactical options ── */}
      <div className="tab-section strat-options-grid">
        <OptionSelector
          label="Mentality"
          options={MENTALITY_OPTIONS}
          value={mentality}
          onChange={setMentality}
        />
        <OptionSelector
          label="Pressing"
          options={PRESSING_OPTIONS}
          value={pressing}
          onChange={setPressing}
        />
        <OptionSelector
          label="Tempo"
          options={TEMPO_OPTIONS}
          value={tempo}
          onChange={setTempo}
        />
      </div>

      {/* ── Formation board ── */}
      <div className="tab-section">
        <div className="tab-toolbar" style={{ marginBottom: 16 }}>
          <div className="filter-pills">
            {(Object.keys(FORMATIONS) as Formation[]).map(key => (
              <button
                key={key}
                className={`filter-pill${formation === key ? ' active' : ''}`}
                onClick={() => handleFormationChange(key)}
              >
                {FORMATIONS[key].label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="q-btn primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Strategy'}
            </button>
            <button className="q-btn" onClick={handleReset}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 12a9 9 0 109-9 9 9 0 00-6.3 2.6L3 8" /><path d="M3 3v5h5" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Drag players to customise positions within the formation.</span>
          {loadError ? (
            <span style={{ color: '#ff4d4d', fontWeight: 600 }}>⚠ Load error: {loadError}</span>
          ) : savedAt ? (
            <span style={{ color: 'var(--accent)' }}>✓ Saved {relativeTime(savedAt)}</span>
          ) : (
            <span style={{ color: 'var(--faint)' }}>Not yet saved</span>
          )}
        </div>

        <RetroPitchStrategy
          key={formation}
          ref={pitchRef}
          initialFormation={savedPositions.length > 0 ? savedPositions : FORMATIONS[formation].players}
        />
      </div>

    </div>
  );
}
