import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import './retropitch.css';
import {
  PixelPlayer,
  PitchMarkings,
  DEFAULT_HOME_433,
  DEFAULT_AWAY_433,
  type PlayerPos,
} from './RetroPitch';

export interface RetroPitchStrategyHandle {
  reset: () => void;
  getPlayers: () => PlayerPos[];
}

interface RetroPitchStrategyProps {
  initialFormation?: PlayerPos[];
  defaultWidth?: number;
}

const RetroPitchStrategy = forwardRef<RetroPitchStrategyHandle, RetroPitchStrategyProps>(
  ({ initialFormation = DEFAULT_HOME_433, defaultWidth = 350 }, ref) => {
    const [players, setPlayers] = useState<PlayerPos[]>(initialFormation);
    const [draggingId, setDraggingId] = useState<number | null>(null);
    const [pitchWidth, setPitchWidth] = useState(defaultWidth);
    const pitchRef = useRef<HTMLDivElement>(null);
    const resizeDragRef = useRef<{ startX: number; startW: number } | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => setPlayers(initialFormation),
      getPlayers: () => players,
    }), [initialFormation, players]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: number) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingId(id);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: number) => {
      if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
      const pitch = pitchRef.current;
      if (!pitch) return;
      const rect = pitch.getBoundingClientRect();
      const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(95, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
      setPlayers(prev => prev.map(p => (p.id === id ? { ...p, x, y } : p)));
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setDraggingId(null);
    }, []);

    const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeDragRef.current = { startX: e.clientX, startW: pitchWidth };
    };

    const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeDragRef.current) return;
      const delta = e.clientX - resizeDragRef.current.startX;
      setPitchWidth(Math.min(720, Math.max(200, resizeDragRef.current.startW + delta)));
    };

    const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      resizeDragRef.current = null;
    };

    return (
      <div className="rp-root" style={{ width: pitchWidth }}>
        <div className="rp-pitch-wrap">
          <div className="rp-pitch" ref={pitchRef}>
            <PitchMarkings />

            {DEFAULT_AWAY_433.map((p, i) => (
              <PixelPlayer key={`a-${p.id}`} player={p} team="away" delay={i * 0.13} ghost />
            ))}

            {players.map((p, i) => {
              const isDragging = draggingId === p.id;
              return (
                <div
                  key={`h-${p.id}`}
                  className={`rp-player rp-home rp-draggable${isDragging ? ' rp-dragging' : ' rp-bob'}`}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    animationDelay: `${i * 0.13}s`,
                    zIndex: isDragging ? 20 : 10,
                  }}
                  onPointerDown={e => handlePointerDown(e, p.id)}
                  onPointerMove={e => handlePointerMove(e, p.id)}
                  onPointerUp={handlePointerUp}
                >
                  <div className="rp-sprite">
                    <div className="rp-px rp-torso" />
                    <div className="rp-px rp-legs" />
                    <div className="rp-px rp-head" />
                    <div className="rp-px rp-hair" />
                    <div className="rp-num">{p.num}</div>
                  </div>
                  <div className="rp-shadow" />
                </div>
              );
            })}

            <div className="rp-ball" style={{ left: '50%', top: '49%' }} />

            <div className="rp-scan" />
            <div className="rp-vignette" />

            <div
              className="rp-resize-handle"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
            />
          </div>
        </div>
      </div>
    );
  }
);

RetroPitchStrategy.displayName = 'RetroPitchStrategy';
export default RetroPitchStrategy;
