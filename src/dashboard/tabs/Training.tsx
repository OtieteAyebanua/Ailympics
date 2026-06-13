import { useEffect, useRef, useState } from 'react';
import { type OwnedPlayer, type StatLabel } from '../../models/models';
import { type SquadState } from '../../hooks/useSquad';
import { runTrainingSession, type TrainingResult } from '../../lib/training';
import { getEffectiveStats } from '../../lib/playerUtils';

interface TrainingProps {
  squad:      SquadState;
  needWallet: () => boolean;
  showToast:  (msg: string) => void;
}

const STEP = 5;
type Alloc = Partial<Record<StatLabel, number>>;

// ── Training modal ────────────────────────────────────────────────────────────

interface ModalProps {
  player:          OwnedPlayer;
  availablePoints: number;
  onStart:         (alloc: Alloc) => void;
  onClose:         () => void;
}

function TrainingModal({ player, availablePoints, onStart, onClose }: ModalProps) {
  const stats = getEffectiveStats(player);

  const statLabelMap: Record<string, StatLabel> = {
    PAC: 'pace', SHO: 'finishing', DRI: 'dribbling',
    STA: 'stamina', PAS: 'passing', DEF: 'defending', PHY: 'physicality',
    REF: 'reflexes', POS: 'positioning', KIC: 'kicking',
    HAN: 'handling', DIS: 'distribution',
  };

  const [alloc, setAlloc] = useState<Alloc>(
    Object.fromEntries(stats.map(s => [statLabelMap[s.label], 0])) as Alloc,
  );

  const totalUsed = Object.values(alloc).reduce((s, v) => s + (v ?? 0), 0);
  const remaining = availablePoints - totalUsed;
  const cost      = (0.2 + totalUsed * 0.003).toFixed(3);

  const adjust = (key: StatLabel, delta: number) => {
    setAlloc(prev => {
      const cur  = prev[key] ?? 0;
      const next = Math.max(0, cur + delta);
      if (delta > 0 && remaining < STEP) return prev;
      return { ...prev, [key]: next };
    });
  };

  function chanceLabel(pts: number): string {
    if (pts >= 40) return '85% · +1–4';
    if (pts >= 20) return '70% · +1–3';
    if (pts >= 10) return '50% · +1–2';
    return '30% · +1';
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 460, width: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Training — {player.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Allocate points to specific skills. More points = higher chance of improvement.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Training points</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: totalUsed > 0 ? 'var(--accent)' : 'var(--faint)' }}>
              {totalUsed} spent · {remaining} remaining
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${availablePoints > 0 ? (totalUsed / availablePoints) * 100 : 0}%`, background: remaining === 0 ? '#ff4d4d' : 'var(--accent)', borderRadius: 4, transition: 'width 0.15s' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stats.map(s => {
            const key = statLabelMap[s.label] as StatLabel;
            const pts = alloc[key] ?? 0;
            return (
              <div key={s.label} style={{ background: 'var(--bg-1)', border: `1px solid ${pts > 0 ? 'color-mix(in oklab, var(--accent) 40%, var(--line))' : 'var(--line)'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Current: {s.val}
                    {pts > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{chanceLabel(pts)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => adjust(key, -STEP)} disabled={pts === 0} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', color: pts === 0 ? 'var(--faint)' : 'var(--fg)', cursor: pts === 0 ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ width: 44, textAlign: 'center', fontSize: 13, fontWeight: 700, color: pts > 0 ? 'var(--accent)' : 'var(--faint)' }}>{pts} pts</span>
                  <button onClick={() => adjust(key, +STEP)} disabled={remaining < STEP} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-2)', border: '1px solid var(--line)', color: remaining < STEP ? 'var(--faint)' : 'var(--fg)', cursor: remaining < STEP ? 'not-allowed' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Cost: <span style={{ color: 'var(--fg)', fontWeight: 700 }}>−{cost} Ξ</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="q-btn" onClick={onClose}>Cancel</button>
            <button className="q-btn primary" disabled={totalUsed === 0} onClick={() => onStart(alloc)} style={{ opacity: totalUsed === 0 ? 0.45 : 1 }}>
              Start Training
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────

function PlayerTrainCard({ player, isTraining, pointsEmpty, onTrain }: {
  player:      OwnedPlayer;
  isTraining:  boolean;
  pointsEmpty: boolean;
  onTrain:     () => void;
}) {
  const stats    = getEffectiveStats(player);
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
    <div ref={ref} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="av" style={{ flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {player.position}
            <span style={{ color: rarityColor[player.rarity], fontSize: 10 }}>● {player.rarity}</span>
          </div>
        </div>
        <div className="lvl" style={{ flexShrink: 0 }}>
          <b>{player.base_ovr}</b>
          <span>OVR</span>
        </div>
      </div>

      <div className="attr" style={{ gap: 7 }}>
        {stats.map(s => (
          <div key={s.label} className="row">
            <div className="lab" style={{ fontSize: 11 }}>{s.label}</div>
            <div className="bar"><i style={{ width: barsVisible ? `${s.val}%` : '0%' }} /></div>
            <div className="val mono" style={{ fontSize: 11 }}>{s.val}</div>
          </div>
        ))}
      </div>

      <button className="train-btn" disabled={isTraining || pointsEmpty} onClick={onTrain} style={{ marginTop: 0, fontSize: 12, padding: '10px 0' }}>
        {isTraining ? 'Training…' : pointsEmpty ? 'No points left' : 'Train'}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Training({ squad, needWallet, showToast }: TrainingProps) {
  const { players, trainingPoints, refreshPoints } = squad;
  const roster = players.filter(p => p.is_trainable);

  const [trainingId,   setTrainingId]   = useState<number | null>(null);
  const [modalPlayer,  setModalPlayer]  = useState<OwnedPlayer | null>(null);

  const pointsEmpty = trainingPoints < STEP;

  const handleTrainClick = (player: OwnedPlayer) => {
    if (!needWallet()) return;
    if (pointsEmpty) { showToast('No training points remaining'); return; }
    setModalPlayer(player);
  };

  const handleStart = async (alloc: Alloc) => {
    if (!modalPlayer) return;
    const player = modalPlayer;
    setModalPlayer(null);
    setTrainingId(player.id);

    try {
      const result: TrainingResult = await runTrainingSession(player.id, alloc);
      await refreshPoints();
      if (result.improved) {
        const gains = Object.entries(result.gains)
          .map(([stat, val]) => `${stat} +${val}`)
          .join(', ');
        showToast(`${player.name} improved! ${gains}`);
      } else {
        showToast('Session complete — no gains this time');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setTrainingId(null);
    }
  };

  return (
    <div>
      <div className="tab-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Training points</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: pointsEmpty ? '#ff7a7a' : 'var(--accent)' }}>
            {trainingPoints} pts
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (trainingPoints / 500) * 100)}%`, background: pointsEmpty ? '#ff4d4d' : 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="tab-section" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 14 }}>
          No trainable players yet — clone some Common players from the Marketplace.
        </div>
      ) : (
        <div className="tab-section">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {roster.map(player => (
              <PlayerTrainCard
                key={player.id}
                player={player}
                isTraining={trainingId === player.id}
                pointsEmpty={pointsEmpty}
                onTrain={() => handleTrainClick(player)}
              />
            ))}
          </div>
        </div>
      )}

      {modalPlayer && (
        <TrainingModal
          player={modalPlayer}
          availablePoints={trainingPoints}
          onStart={handleStart}
          onClose={() => setModalPlayer(null)}
        />
      )}
    </div>
  );
}
