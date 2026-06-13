import { useState, useRef } from 'react';

interface StrategyProps {
  showToast: (msg: string) => void;
}

type ChipData = { role: string; x: number; y: number };

const formations: Record<string, ChipData[]> = {
  '442': [
    { role: 'GK', x: 50, y: 90 }, { role: 'DEF', x: 18, y: 72 }, { role: 'DEF', x: 39, y: 75 },
    { role: 'DEF', x: 61, y: 75 }, { role: 'DEF', x: 82, y: 72 }, { role: 'MID', x: 18, y: 48 },
    { role: 'MID', x: 39, y: 50 }, { role: 'MID', x: 61, y: 50 }, { role: 'MID', x: 82, y: 48 },
    { role: 'FWD', x: 38, y: 24 }, { role: 'FWD', x: 62, y: 24 },
  ],
  '433': [
    { role: 'GK', x: 50, y: 90 }, { role: 'DEF', x: 16, y: 72 }, { role: 'DEF', x: 38, y: 75 },
    { role: 'DEF', x: 62, y: 75 }, { role: 'DEF', x: 84, y: 72 }, { role: 'MID', x: 30, y: 52 },
    { role: 'MID', x: 50, y: 56 }, { role: 'MID', x: 70, y: 52 }, { role: 'FWD', x: 24, y: 26 },
    { role: 'FWD', x: 50, y: 20 }, { role: 'FWD', x: 76, y: 26 },
  ],
  '352': [
    { role: 'GK', x: 50, y: 90 }, { role: 'DEF', x: 30, y: 74 }, { role: 'DEF', x: 50, y: 77 },
    { role: 'DEF', x: 70, y: 74 }, { role: 'MID', x: 16, y: 52 }, { role: 'MID', x: 35, y: 54 },
    { role: 'MID', x: 50, y: 48 }, { role: 'MID', x: 65, y: 54 }, { role: 'MID', x: 84, y: 52 },
    { role: 'FWD', x: 40, y: 24 }, { role: 'FWD', x: 60, y: 24 },
  ],
};

const labels: Record<string, string> = { '442': '4-4-2', '433': '4-3-3', '352': '3-5-2' };

export default function Strategy({ showToast }: StrategyProps) {
  const [formation, setFormation] = useState('442');
  const [chips, setChips] = useState<ChipData[]>(formations['442']);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const applyFormation = (key: string) => {
    setChips([...formations[key]]);
    setFormation(key);
  };

  const onPointerDown = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
  };

  const onPointerMove = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIdx !== idx) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    const r = pitch.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100));
    setChips(prev => prev.map((c, i) => (i === idx ? { ...c, x, y } : c)));
  };

  const onPointerUp = (idx: number) => {
    if (draggingIdx === idx) setDraggingIdx(null);
  };

  return (
    <div>
      <div className="strat-shell">
        <div className="strat-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Formation
            </span>
            <div className="formation-pills" style={{ display: 'flex', gap: 6 }}>
              {Object.keys(formations).map(f => (
                <button
                  key={f}
                  className={`${formation === f ? 'active' : ''}`}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 999,
                    color: formation === f ? 'var(--ink)' : 'var(--muted)',
                    background: formation === f ? 'var(--accent)' : 'none',
                    border: formation === f ? 'none' : '1px solid var(--line)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onClick={() => { applyFormation(f); showToast(`Switched to ${labels[f]}`); }}
                >
                  {labels[f]}
                </button>
              ))}
            </div>
          </div>

          <button
            className="reset"
            style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit' }}
            onClick={() => { applyFormation(formation); showToast('Formation reset'); }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12a9 9 0 109-9 9 9 0 00-6.3 2.6L3 8" /><path d="M3 3v5h5" />
            </svg>
            Reset
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            className="pitch"
            ref={pitchRef}
            style={{ aspectRatio: '5/4' }}
          >
            <div className="lines" />
            <div className="center-line" />
            <div className="center-circle" />
            <div className="center-dot" />
            <div className="box top" /><div className="box bot" />
            <div className="box-sm top" /><div className="box-sm bot" />

            {chips.map((chip, idx) => (
              <div
                key={idx}
                className={`chip${chip.role === 'GK' ? ' gk' : ''}${draggingIdx === idx ? ' dragging' : ''}`}
                style={{ left: `${chip.x}%`, top: `${chip.y}%` }}
                onPointerDown={e => onPointerDown(idx, e)}
                onPointerMove={e => onPointerMove(idx, e)}
                onPointerUp={() => onPointerUp(idx)}
                onPointerCancel={() => onPointerUp(idx)}
              >
                <span className="num">{idx + 1}</span>
                <span className="nm">{chip.role}</span>
              </div>
            ))}
          </div>
          <div className="hint">Drag players to reposition</div>
        </div>
      </div>
    </div>
  );
}
