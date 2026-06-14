import { useState, useRef } from 'react';
import './retropitch.css';

export interface PlayerPos {
  id: number;
  x: number;
  y: number;
  num: number;
}

// 5v5: 1 GK + 4 outfield per team
export const DEFAULT_HOME_433: PlayerPos[] = [
  { id: 1, x: 50, y: 6,  num: 1 },   // GK
  { id: 2, x: 35, y: 20, num: 5 },   // CB
  { id: 3, x: 65, y: 20, num: 4 },   // CB
  { id: 4, x: 50, y: 33, num: 8 },   // CM
  { id: 5, x: 50, y: 46, num: 9 },   // ST
];

export const DEFAULT_AWAY_433: PlayerPos[] = [
  { id: 1, x: 50, y: 94, num: 1 },   // GK
  { id: 2, x: 35, y: 80, num: 5 },   // CB
  { id: 3, x: 65, y: 80, num: 4 },   // CB
  { id: 4, x: 50, y: 67, num: 8 },   // CM
  { id: 5, x: 50, y: 54, num: 9 },   // ST
];

interface PixelPlayerProps {
  player: PlayerPos;
  team: 'home' | 'away';
  delay?: number;
  ghost?: boolean;
}

export function PixelPlayer({ player, team, delay = 0, ghost = false }: PixelPlayerProps) {
  return (
    <div
      className={`rp-player rp-${team} rp-bob${ghost ? ' rp-ghost' : ''}`}
      style={{ left: `${player.x}%`, top: `${player.y}%`, animationDelay: `${delay}s` }}
    >
      <div className="rp-sprite">
        <div className="rp-px rp-torso" />
        <div className="rp-px rp-legs" />
        <div className="rp-px rp-head" />
        <div className="rp-px rp-hair" />
        <div className="rp-num">{player.num}</div>
      </div>
      <div className="rp-shadow" />
    </div>
  );
}

export function PitchMarkings() {
  return (
    <>
      <div className="rp-mark rp-halfway" />
      <div className="rp-mark rp-center" />
      <div className="rp-spot" />
      <div className="rp-mark rp-box-top" />
      <div className="rp-mark rp-box-bot" />
      <div className="rp-mark rp-sixbox-top" />
      <div className="rp-mark rp-sixbox-bot" />
      <div className="rp-goal-top" />
      <div className="rp-goal-bot" />
    </>
  );
}

interface RetroPitchProps {
  homePlayers?: PlayerPos[];
  awayPlayers?: PlayerPos[];
  ballPos?: { x: number; y: number };
  defaultWidth?: number;
}

export default function RetroPitch({
  homePlayers = DEFAULT_HOME_433,
  awayPlayers = DEFAULT_AWAY_433,
  ballPos = { x: 50, y: 49 },
  defaultWidth = 350,
}: RetroPitchProps) {
  const [pitchWidth, setPitchWidth] = useState(defaultWidth);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startW: pitchWidth };
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    setPitchWidth(Math.min(720, Math.max(200, dragRef.current.startW + delta)));
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div className="rp-root" style={{ width: pitchWidth }}>
      <div className="rp-pitch-wrap">
        <div className="rp-pitch">
          <PitchMarkings />

          {homePlayers.map((p, i) => (
            <PixelPlayer key={`h-${p.id}`} player={p} team="home" delay={i * 0.13} />
          ))}
          {awayPlayers.map((p, i) => (
            <PixelPlayer key={`a-${p.id}`} player={p} team="away" delay={i * 0.13} />
          ))}

          <div className="rp-ball" style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }} />

          <div className="rp-scan" />
          <div className="rp-vignette" />

          <div
            className="rp-resize-handle"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
          />
        </div>
      </div>
    </div>
  );
}
