import { useState, useRef } from 'react';
import Reveal from './Reveal';

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

const formationLabels: Record<string, string> = { '442': '4-4-2', '433': '4-3-3', '352': '3-5-2' };

export default function Strategy({ showToast }: StrategyProps) {
  const [formation, setFormation] = useState('442');
  const [chips, setChips] = useState<ChipData[]>(formations['442']);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(true);
  const pitchRef = useRef<HTMLDivElement>(null);

  const applyFormation = (key: string) => {
    setChips([...formations[key]]);
    setFormation(key);
  };

  const handlePointerDown = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
    setShowHint(false);
  };

  const handlePointerMove = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIdx !== idx) return;
    const pitch = pitchRef.current;
    if (!pitch) return;
    const r = pitch.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100));
    setChips(prev => prev.map((c, i) => (i === idx ? { ...c, x, y } : c)));
  };

  const handlePointerUp = (idx: number) => {
    if (draggingIdx === idx) setDraggingIdx(null);
  };

  return (
    <section className="sec strategy" id="strategy">
      <div className="wrap">
        <div className="strat-grid">
          <Reveal className="strat-copy">
            <span className="eyebrow">Strategy canvas</span>
            <h2
              className="display"
              style={{ fontSize: 'clamp(30px,3.6vw,46px)', marginTop: 14 }}
            >
              Drag. Drop.<br />
              <span style={{ color: 'var(--accent)' }}>Dominate.</span>
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 16, marginTop: 16 }}>
              Move players anywhere on the pitch to build your tactical setup. Try it right now — this board is live.
            </p>
            <ul>
              <li>
                <span className="n">1</span>
                <div>
                  <h4>Position every player</h4>
                  <p>Drag chips into your ideal shape — high press, low block, or wing overload.</p>
                </div>
              </li>
              <li>
                <span className="n">2</span>
                <div>
                  <h4>Switch formations instantly</h4>
                  <p>Pick a preset or fine-tune by hand. Each sport gets its own tactical canvas.</p>
                </div>
              </li>
              <li>
                <span className="n">3</span>
                <div>
                  <h4>Save tactics per opponent</h4>
                  <p>Store strategies for specific rivals and competitions, then deploy them on match day.</p>
                </div>
              </li>
            </ul>
          </Reveal>

          <Reveal className="board-shell">
            <div className="board-top">
              <div className="formation-pills">
                {Object.keys(formations).map(f => (
                  <button
                    key={f}
                    className={formation === f ? 'active' : ''}
                    onClick={() => {
                      applyFormation(f);
                      showToast('Switched to ' + formationLabels[f]);
                    }}
                  >
                    {formationLabels[f]}
                  </button>
                ))}
              </div>
              <button
                className="reset"
                onClick={() => {
                  applyFormation(formation);
                  setShowHint(true);
                  showToast('Formation reset');
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M3 12a9 9 0 109-9 9 9 0 00-6.3 2.6L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reset
              </button>
            </div>

            <div className="board-pitch">
              <div className="pitch" ref={pitchRef} style={{ aspectRatio: '4/5' }}>
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
                    onPointerDown={e => handlePointerDown(idx, e)}
                    onPointerMove={e => handlePointerMove(idx, e)}
                    onPointerUp={() => handlePointerUp(idx)}
                    onPointerCancel={() => handlePointerUp(idx)}
                  >
                    <span className="num">{idx + 1}</span>
                    <span className="nm">{chip.role}</span>
                  </div>
                ))}
              </div>
              {showHint && <div className="hint">Drag a player to move them</div>}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
