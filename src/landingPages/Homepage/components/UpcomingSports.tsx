import Reveal from './Reveal';
import sportsBanner from '../../../assets/sport-banner.png';

export default function UpcomingSports() {
  return (
    <section className="sec us-section" id="upcoming">
      <div className="wrap">
        <div className="us-grid">
          <Reveal className="us-copy">
            <span className="eyebrow">Live &amp; Upcoming</span>
            <h2 className="display">
              Tennis. Racing.<br />
              <span className="accent">Boxing.</span>
            </h2>
            <p className="us-lead">
              Wager on the world's biggest events across three sports.
              On-chain odds, automatic settlement, no middleman.
            </p>
            <div className="us-actions">
              <button className="btn btn-primary">
                Explore Events
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
              <button className="btn btn-ghost">View Schedule</button>
            </div>
            <div className="us-sport-tags">
              <div className="us-stag">
                <span className="us-stag-dot" style={{ background: 'var(--volt)' }} />
                Wimbledon · Jul 2026
              </div>
              <div className="us-stag">
                <span className="us-stag-dot" style={{ background: 'var(--lime)' }} />
                British GP · Jul 2026
              </div>
              <div className="us-stag">
                <span className="us-stag-dot" style={{ background: 'var(--court)' }} />
                Fury vs Joshua III · Jul 2026
              </div>
            </div>
          </Reveal>

          <Reveal className="us-visual">
            <div className="us-img-card">
              <div className="us-img-glow" />
              <img src={sportsBanner} alt="Tennis, Racing and Boxing" className="us-img" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
