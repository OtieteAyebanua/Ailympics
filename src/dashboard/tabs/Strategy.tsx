import { useState, useRef } from 'react';
import RetroPitchStrategy, { type RetroPitchStrategyHandle } from '../components/RetroPitchStrategy';
import { DEFAULT_HOME_433, type PlayerPos } from '../components/RetroPitch';

interface StrategyProps {
  showToast: (msg: string) => void;
}

const F442: PlayerPos[] = [
  { id: 1,  x: 50, y: 6,  num: 1  },
  { id: 2,  x: 20, y: 18, num: 2  }, { id: 3,  x: 38, y: 16, num: 5  },
  { id: 4,  x: 62, y: 16, num: 4  }, { id: 5,  x: 80, y: 18, num: 3  },
  { id: 6,  x: 18, y: 30, num: 8  }, { id: 7,  x: 38, y: 32, num: 6  },
  { id: 8,  x: 62, y: 32, num: 10 }, { id: 9,  x: 82, y: 30, num: 7  },
  { id: 10, x: 36, y: 43, num: 9  }, { id: 11, x: 64, y: 43, num: 11 },
];

const F352: PlayerPos[] = [
  { id: 1,  x: 50, y: 6,  num: 1  },
  { id: 2,  x: 30, y: 17, num: 5  }, { id: 3,  x: 50, y: 15, num: 4  }, { id: 4,  x: 70, y: 17, num: 6  },
  { id: 5,  x: 14, y: 30, num: 2  }, { id: 6,  x: 34, y: 32, num: 8  },
  { id: 7,  x: 50, y: 29, num: 10 },
  { id: 8,  x: 66, y: 32, num: 3  }, { id: 9,  x: 86, y: 30, num: 7  },
  { id: 10, x: 36, y: 43, num: 9  }, { id: 11, x: 64, y: 43, num: 11 },
];

const FORMATIONS: Record<string, { label: string; players: PlayerPos[] }> = {
  '433': { label: '4-3-3', players: DEFAULT_HOME_433 },
  '442': { label: '4-4-2', players: F442 },
  '352': { label: '3-5-2', players: F352 },
};

export default function Strategy({ showToast }: StrategyProps) {
  const [formation, setFormation] = useState<keyof typeof FORMATIONS>('433');
  const pitchRef = useRef<RetroPitchStrategyHandle>(null);

  const handleFormationChange = (key: string) => {
    setFormation(key);
    showToast(`Switched to ${FORMATIONS[key].label}`);
  };

  const handleReset = () => {
    pitchRef.current?.reset();
    showToast('Formation reset');
  };

  const handleSave = () => {
    showToast('Tactics saved');
  };

  return (
    <div>
      <div className="tab-toolbar" style={{ marginBottom: 16 }}>
        <div className="filter-pills">
          {Object.entries(FORMATIONS).map(([key, { label }]) => (
            <button
              key={key}
              className={`filter-pill${formation === key ? ' active' : ''}`}
              onClick={() => handleFormationChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="q-btn primary" onClick={handleSave}>
            Save tactics
          </button>
          <button className="q-btn" onClick={handleReset}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 12a9 9 0 109-9 9 9 0 00-6.3 2.6L3 8" /><path d="M3 3v5h5" />
            </svg>
            Reset
          </button>
        </div>
      </div>

      <RetroPitchStrategy
        key={formation}
        ref={pitchRef}
        initialFormation={FORMATIONS[formation].players}
      />
    </div>
  );
}
