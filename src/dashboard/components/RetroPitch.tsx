import { useState, useRef } from 'react';
import './retropitch.css';

export interface PlayerPos {
  id: number;
  x: number;
  y: number;
  num: number;
}

export const DEFAULT_HOME_433: PlayerPos[] = [
  { id: 1,  x: 50, y: 6,  num: 1  },
  { id: 2,  x: 20, y: 18, num: 2  }, { id: 3,  x: 40, y: 16, num: 5  },
  { id: 4,  x: 60, y: 16, num: 4  }, { id: 5,  x: 80, y: 18, num: 3  },
  { id: 6,  x: 30, y: 30, num: 8  }, { id: 7,  x: 50, y: 32, num: 6  }, { id: 8,  x: 70, y: 30, num: 10 },
  { id: 9,  x: 25, y: 42, num: 11 }, { id: 10, x: 50, y: 44, num: 9  }, { id: 11, x: 75, y: 42, num: 7  },
];

export const DEFAULT_AWAY_433: PlayerPos[] = [
  { id: 1,  x: 50, y: 94, num: 1  },
  { id: 2,  x: 20, y: 82, num: 2  }, { id: 3,  x: 40, y: 84, num: 5  },
  { id: 4,  x: 60, y: 84, num: 4  }, { id: 5,  x: 80, y: 82, num: 3  },
  { id: 6,  x: 30, y: 70, num: 8  }, { id: 7,  x: 50, y: 68, num: 6  }, { id: 8,  x: 70, y: 70, num: 10 },
  { id: 9,  x: 25, y: 58, num: 11 }, { id: 10, x: 50, y: 56, num: 9  }, { id: 11, x: 75, y: 58, num: 7  },
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
