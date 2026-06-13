import Reveal from './Reveal';
import RetroPitchStrategy from '../../../dashboard/components/RetroPitchStrategy';

interface StrategyProps {
  showToast: (msg: string) => void;
}

export default function Strategy({ showToast }: StrategyProps) {
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

          <Reveal className="board-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RetroPitchStrategy />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
