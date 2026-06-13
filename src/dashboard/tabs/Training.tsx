import { useEffect, useRef, useState } from 'react';
import { type Player } from '../data';

interface TrainingProps {
  ownedPlayers: Player[];
  needWallet: () => boolean;
  showToast: (msg: string) => void;
  trainingPoints: number;
  onSpendPoints: (pts: number) => void;
}

interface Attr { label: string; val: number }

const STEP = 5;

type Alloc = Record<string, number>;

function attrsForPlayer(p: Player): Attr[] {
  if (p.pos === 'GK') {
    return [
      { label: 'Reflexes',     val: p.stats.find(s => s.label === 'REF')?.val ?? 75 },
      { label: 'Positioning',  val: p.stats.find(s => s.label === 'POS')?.val ?? 75 },
      { label: 'Kicking',      val: p.stats.find(s => s.label === 'KIC')?.val ?? 65 },
      { label: 'Handling',     val: 73 },
      { label: 'Distribution', val: 68 },
    ];
  }
  return [
    { label: 'Pace',      val: p.stats.find(s => s.label === 'PAC')?.val ?? 75 },
    { label: 'Finishing', val: p.stats.find(s => s.label === 'SHO')?.val ?? 70 },
    { label: 'Dribbling', val: p.stats.find(s => s.label === 'DRI')?.val ?? 72 },
    { label: 'Stamina',   val: 75 },
    { label: 'Passing',   val: p.stats.find(s => s.label === 'PAS')?.val ?? 70 },
  ];
}

function outcomeFor(pts: number): { chance: number; maxBoost: number } {
  if (pts >= 40) return { chance: 0.85, maxBoost: 4 };
  if (pts >= 20) return { chance: 0.70, maxBoost: 3 };
  if (pts >= 10) return { chance: 0.50, maxBoost: 2 };
  return { chance: 0.30, maxBoost: 1 };
}

// ── Training modal ────────────────────────────────────────────────────────────

interface ModalProps {
  playerName: string;
  attrs: Attr[];
  availablePoints: number;
  onStart: (alloc: Alloc) => void;
  onClose: () => void;
}

function TrainingModal({ playerName, attrs, availablePoints, onStart, onClose }: ModalProps) {
  const [alloc, setAlloc] = useState<Alloc>(
    Object.fromEntries(attrs.map(a => [a.label, 0]))
  );

  const totalUsed = Object.values(alloc).reduce((s, v) => s + v, 0);
  const remaining = availablePoints - totalUsed;
  const cost = (0.2 + totalUsed * 0.003).toFixed(3);

  const adjust = (skill: string, delta: number) => {
    setAlloc(prev => {
      const cur = prev[skill] ?? 0;
      const next = Math.max(0, Math.min(cur + delta, cur + (delta > 0 ? remaining : Infinity)));
      return { ...prev, [skill]: next };
    });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--line)',
          borderRadius: 16, padding: '28px',
          display: 'flex', flexDirection: 'column', gap: 20,
          maxWidth: 460, width: '92vw',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)' }}>Training — {playerName}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Allocate points to specific skills. More points = higher chance of improvement.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>
            ✕
          </button>
        </div>

        {/* points meter */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Shared training points</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: totalUsed > 0 ? 'var(--accent)' : 'var(--faint)' }}>
              {totalUsed} spent · {remaining} remaining
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${availablePoints > 0 ? (totalUsed / availablePoints) * 100 : 0}%`,
              background: remaining === 0 ? '#ff4d4d' : 'var(--accent)',
              borderRadius: 4, transition: 'width 0.15s',
            }} />
          </div>
        </div>

        {/* skill rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attrs.map(a => {
            const pts = alloc[a.label] ?? 0;
            const { chance, maxBoost } = pts > 0 ? outcomeFor(pts) : { chance: 0, maxBoost: 0 };
            return (
              <div
                key={a.label}
                style={{
                  background: 'var(--bg-1)',
                  border: `1px solid ${pts > 0 ? 'color-mix(in oklab, var(--accent) 40%, var(--line))' : 'var(--line)'}`,
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Current: {a.val}
                    {pts > 0 && (
                      <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
                        {Math.round(chance * 100)}% chance · +1–{maxBoost}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => adjust(a.label, -STEP)}
                    disabled={pts === 0}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'var(--bg-2)', border: '1px solid var(--line)',
                      color: pts === 0 ? 'var(--faint)' : 'var(--fg)',
                      cursor: pts === 0 ? 'not-allowed' : 'pointer',
                      fontSize: 16, lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >−</button>
                  <span style={{ width: 44, textAlign: 'center', fontSize: 13, fontWeight: 700, color: pts > 0 ? 'var(--accent)' : 'var(--faint)' }}>
                    {pts} pts
                  </span>
                  <button
                    onClick={() => adjust(a.label, +STEP)}
                    disabled={remaining < STEP}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'var(--bg-2)', border: '1px solid var(--line)',
                      color: remaining < STEP ? 'var(--faint)' : 'var(--fg)',
                      cursor: remaining < STEP ? 'not-allowed' : 'pointer',
                      fontSize: 16, lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Cost: <span style={{ color: 'var(--fg)', fontWeight: 700 }}>−{cost} Ξ</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="q-btn" onClick={onClose}>Cancel</button>
            <button
              className="q-btn primary"
              disabled={totalUsed === 0}
              onClick={() => onStart(alloc)}
              style={{ opacity: totalUsed === 0 ? 0.45 : 1 }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Start Training
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Player training card ──────────────────────────────────────────────────────

interface CardProps {
  player: Player;
  attrs: Attr[];
  ovr: number;
  isTraining: boolean;
  pointsEmpty: boolean;
  onTrain: () => void;
}

function PlayerTrainCard({ player, attrs, ovr, isTraining, pointsEmpty, onTrain }: CardProps) {
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const [barsVisible, setBarsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setBarsVisible(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const rarityColor: Record<string, string> = {
    Icon: '#ffd700', Legendary: '#c084fc', Epic: '#60a5fa', Rare: '#34d399', Common: 'var(--muted)',
  };

  return (
    <div
      ref={ref}
      style={{
        background: 'var(--bg-1)', border: '1px solid var(--line)',
        borderRadius: 14, padding: '18px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="av" style={{ flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {player.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {player.pos}
            <span style={{ color: rarityColor[player.rare], fontSize: 10 }}>● {player.rare}</span>
          </div>
        </div>
        <div className="lvl" style={{ flexShrink: 0 }}>
          <b>{ovr}</b>
          <span>OVR</span>
        </div>
      </div>

      {/* attr bars */}
      <div className="attr" style={{ gap: 7 }}>
        {attrs.map(a => (
          <div key={a.label} className="row">
            <div className="lab" style={{ fontSize: 11 }}>{a.label}</div>
            <div className="bar">
              <i style={{ width: barsVisible ? `${a.val}%` : '0%' }} />
            </div>
            <div className="val mono" style={{ fontSize: 11 }}>{a.val}</div>
          </div>
        ))}
      </div>

      {/* train button */}
      <button
        className="train-btn"
        disabled={isTraining || pointsEmpty}
        onClick={onTrain}
        style={{ marginTop: 0, fontSize: 12, padding: '10px 0' }}
      >
        {isTraining ? 'Training…' : pointsEmpty ? 'No points left' : 'Train'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type StatsMap = Record<number, { attrs: Attr[]; ovr: number }>;

export default function Training({ ownedPlayers, needWallet, showToast, trainingPoints, onSpendPoints }: TrainingProps) {
  const roster = ownedPlayers.filter(p => p.sport === 'football');

  const [statsMap, setStatsMap] = useState<StatsMap>({});
  const [trainingId, setTrainingId] = useState<number | null>(null);
  const [modalPlayer, setModalPlayer] = useState<Player | null>(null);

  // Initialize statsMap for newly added players
  useEffect(() => {
    setStatsMap(prev => {
      const next = { ...prev };
      for (const p of roster) {
        if (!next[p.id]) {
          next[p.id] = { attrs: attrsForPlayer(p), ovr: p.ovr };
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedPlayers]);

  const handleTrainClick = (player: Player) => {
    if (!needWallet()) return;
    if (trainingPoints < STEP) { showToast('No training points remaining'); return; }
    setModalPlayer(player);
  };

  const runTraining = (alloc: Alloc) => {
    if (!modalPlayer) return;
    const id = modalPlayer.id;
    const spent = Object.values(alloc).reduce((s, v) => s + v, 0);
    onSpendPoints(spent);
    setModalPlayer(null);
    setTrainingId(id);

    setTimeout(() => {
      let bumped = false;
      setStatsMap(prev => {
        const entry = prev[id];
        if (!entry) return prev;
        const newAttrs = entry.attrs.map(a => {
          const pts = alloc[a.label] ?? 0;
          if (pts === 0 || a.val >= 99) return a;
          const { chance, maxBoost } = outcomeFor(pts);
          if (Math.random() < chance) {
            bumped = true;
            return { ...a, val: Math.min(99, a.val + 1 + Math.floor(Math.random() * maxBoost)) };
          }
          return a;
        });
        const newOvr = bumped ? Math.min(99, entry.ovr + 1) : entry.ovr;
        return { ...prev, [id]: { attrs: newAttrs, ovr: newOvr } };
      });
      setTrainingId(null);
      showToast(bumped ? `${modalPlayer.name} improved!` : 'Session complete — no gains this time');
    }, 1200);
  };

  const pointsEmpty = trainingPoints < STEP;

  return (
    <div>
      {/* shared points banner */}
      <div className="tab-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Shared training points</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: pointsEmpty ? '#ff7a7a' : 'var(--accent)' }}>
            {trainingPoints} pts
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (trainingPoints / 500) * 100)}%`,
            background: pointsEmpty ? '#ff4d4d' : 'var(--accent)',
            borderRadius: 4, transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="tab-section" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 14 }}>
          No players in your squad yet — sign some from the Marketplace.
        </div>
      ) : (
        <div className="tab-section">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {roster.map(player => {
              const entry = statsMap[player.id];
              if (!entry) return null;
              return (
                <PlayerTrainCard
                  key={player.id}
                  player={player}
                  attrs={entry.attrs}
                  ovr={entry.ovr}
                  isTraining={trainingId === player.id}
                  pointsEmpty={pointsEmpty}
                  onTrain={() => handleTrainClick(player)}
                />
              );
            })}
          </div>
        </div>
      )}

      {modalPlayer && statsMap[modalPlayer.id] && (
        <TrainingModal
          playerName={modalPlayer.name}
          attrs={statsMap[modalPlayer.id].attrs}
          availablePoints={trainingPoints}
          onStart={runTraining}
          onClose={() => setModalPlayer(null)}
        />
      )}
    </div>
  );
}
