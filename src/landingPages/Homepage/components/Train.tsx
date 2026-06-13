import { useEffect, useRef, useState } from 'react';
import Reveal from './Reveal';

interface TrainProps {
  needWallet: () => boolean;
  showToast: (msg: string) => void;
}

interface Attr {
  label: string;
  val: number;
}

const initialAttrs: Attr[] = [
  { label: 'Pace',      val: 88 },
  { label: 'Finishing', val: 84 },
  { label: 'Dribbling', val: 79 },
  { label: 'Stamina',   val: 75 },
];

export default function Train({ needWallet, showToast }: TrainProps) {
  const [attrs, setAttrs] = useState<Attr[]>(initialAttrs);
  const [ovr, setOvr] = useState(82);
  const [training, setTraining] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);
  const attrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = attrRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setBarsVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const runTraining = () => {
    if (!needWallet()) return;
    setTraining(true);
    setTimeout(() => {
      let bumped = false;
      setAttrs(prev =>
        prev.map(a => {
          if (a.val < 99 && Math.random() > 0.35) {
            bumped = true;
            return { ...a, val: Math.min(99, a.val + 1 + Math.floor(Math.random() * 2)) };
          }
          return a;
        })
      );
      if (bumped) setOvr(o => Math.min(99, o + 1));
      setTraining(false);
      showToast(bumped ? 'Session complete — attributes up!' : 'Session complete — no gains this time');
    }, 1100);
  };

  return (
    <section className="sec train" id="train">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="eyebrow">Training ground</span>
          <h2 className="display">Turn prospects into <span className="accent">legends</span></h2>
          <p>Every session sharpens your players. Watch attributes climb in real time — then take them to market.</p>
        </Reveal>

        <div className="train-grid">
          <Reveal className="train-card">
            <div className="tc-top">
              <div className="av">M9</div>
              <div>
                <h4>M. Okafor</h4>
                <span>Striker · Football</span>
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
          </Reveal>

          <Reveal className="strat-copy">
            <span className="eyebrow">How it works</span>
            <h2
              className="display"
              style={{ fontSize: 'clamp(28px,3.4vw,42px)', marginTop: 14 }}
            >
              Stake sessions,<br />
              <span style={{ color: 'var(--accent)' }}>bank the gains</span>
            </h2>
            <ul>
              <li>
                <span className="n">↑</span>
                <div>
                  <h4>Targeted drills</h4>
                  <p>Choose which attributes to develop. Strikers sharpen finishing; servers boost their ace rate.</p>
                </div>
              </li>
              <li>
                <span className="n">⚡</span>
                <div>
                  <h4>Real-time growth</h4>
                  <p>Attributes and overall rating update on-chain the moment a session completes.</p>
                </div>
              </li>
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
