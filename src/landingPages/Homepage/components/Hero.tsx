import { useState, useEffect, useRef } from 'react';
import Reveal from './Reveal';

interface HeroProps {
  onLaunch: () => void;
}
function CountUp({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState('0');
  const started = useRef(false);

  const fmt = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(Math.round(n));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const dur = 1400;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const ease = 1 - Math.pow(1 - p, 3);
          setDisplay(fmt(target * ease));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{display}</span>;
}


export default function Hero({ onLaunch }: HeroProps) {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="sport-band reveal in">
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow reveal in">On-chain sports management</span>
            <h1 className="display reveal in">
              Own the <span className="hl">CLUB</span>.<br />
              Trade the <span className="hl">talent</span>.<br />
              Lead the <span className="hl">Table</span>
            </h1>
            <div className="hero-cta reveal in">
              <button className="btn btn-primary" onClick={onLaunch}>
                Launch App
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            {/* <div className="hero-stats reveal in">
              <div className="st">
                <b className="mono"><CountUp target={48200} /></b>
                <span>Players traded</span>
              </div>
              <div className="st">
                <b className="mono">
                  <span className="u">Ξ</span>
                  <CountUp target={12400} />
                </b>
                <span>Total wagered</span>
              </div>
              <div className="st">
                <b className="mono"><CountUp target={9700} /></b>
                <span>Active managers</span>
              </div>
            </div> */}
          </div>

          <Reveal className="hero-visual">
            <div className="glow" />
            <div className="pitch-card">
              <div className="hud">
                <div className="live"><span className="dot" /> Live match</div>
                <div className="score">2 — 1</div>
                <div className="clock mono">67:40</div>
              </div>
                <div className="pitch">
                  <div className="lines" />
                  <div className="center-line" />
                  <div className="center-circle" />
                  <div className="center-dot" />
                  <div className="box top" /><div className="box bot" />
                  <div className="box-sm top" /><div className="box-sm bot" />
                </div>

            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
