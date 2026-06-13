import { useEffect, useRef, useState } from 'react';
import { players, type Player } from '../data';

interface TrainingProps {
  ownedPlayers: Player[];
  needWallet: () => boolean;
  showToast: (msg: string) => void;
}

interface Attr { label: string; val: number }

const defaultAttrs: Attr[] = [
  { label: 'Pace', val: 88 },
  { label: 'Finishing', val: 84 },
  { label: 'Dribbling', val: 79 },
  { label: 'Stamina', val: 75 },
];

export default function Training({ ownedPlayers, needWallet, showToast }: TrainingProps) {
  const trainingRoster = ownedPlayers.filter(p => p.sport === 'football');
  const subject: Player | undefined = trainingRoster[0] ?? players[0];

  const [attrs, setAttrs] = useState<Attr[]>(defaultAttrs);
  const [ovr, setOvr] = useState(subject?.ovr ?? 82);
  const [training, setTraining] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const attrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = attrRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setBarsVisible(true); },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const runTraining = () => {
    if (!needWallet()) return;
    setTraining(true);
    setTimeout(() => {
      let bumped = false;
      setAttrs(prev => prev.map(a => {
        if (a.val < 99 && Math.random() > 0.35) {
          bumped = true;
          return { ...a, val: Math.min(99, a.val + 1 + Math.floor(Math.random() * 2)) };
        }
        return a;
      }));
      if (bumped) setOvr(o => Math.min(99, o + 1));
      setTraining(false);
      showToast(bumped ? 'Session complete — attributes up!' : 'Session complete — no gains this time');
    }, 1100);
  };

  return (
    <div className="train-layout">
      <div className="train-card">
        <div className="tc-top">
          <div className="av">{subject ? subject.name.split(' ')[1]?.slice(0, 2).toUpperCase() ?? 'M9' : 'M9'}</div>
          <div>
            <h4>{subject?.name ?? 'M. Okafor'}</h4>
            <span>{subject?.pos ?? 'Striker'} · {subject?.sport ?? 'Football'}</span>
          </div>
          <div className="lvl">
            <b>{ovr}</b>
            <span>OVR</span>
          </div>
        </div>

        <div className="attr" ref={attrRef}>
          {attrs.map(a => (
            <div key={a.label} className="row">
              <div className="lab">{a.label}</div>
              <div className="bar">
                <i style={{ width: barsVisible ? `${a.val}%` : '0%' }} />
              </div>
              <div className="val mono">{a.val}</div>
            </div>
          ))}
        </div>

        <button className="train-btn" disabled={training} onClick={runTraining}>
          {training ? 'Training in progress…' : 'Run training session (−0.4 Ξ)'}
        </button>
      </div>

      <div className="train-info">
        <h3>Develop your players</h3>
        <p>Each session costs Ξ 0.4 and randomly boosts one or more attributes. Trained players have a higher resale value on the marketplace.</p>
        <ul className="train-steps">
          <li className="train-step">
            <span className="step-num">↑</span>
            <div>
              <h4>Targeted drills</h4>
              <p>Strikers sharpen finishing; defenders build tackling. Attributes grow based on position role.</p>
            </div>
          </li>
          <li className="train-step">
            <span className="step-num">⚡</span>
            <div>
              <h4>On-chain instantly</h4>
              <p>Attribute gains are committed to the contract the moment a session confirms.</p>
            </div>
          </li>
          <li className="train-step">
            <span className="step-num">💰</span>
            <div>
              <h4>Flip for profit</h4>
              <p>A maxed-out player commands a premium. Develop, then sell into demand.</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
