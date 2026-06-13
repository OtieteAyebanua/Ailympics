import Reveal from './Reveal';

export default function Features() {
  return (
    <section className="sec" id="features">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="eyebrow">The platform</span>
          <h2 className="display">
            Everything a manager needs, <span className="accent">on-chain</span>
          </h2>
          <p>Ailympics turns sports management into a fully ownable economy. Every player, tactic, and bet is yours to control.</p>
        </Reveal>

        <div className="pillars">
          <Reveal className="pillar">
            <div className="ico">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 9l9-6 9 6v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <h3>Buy &amp; sell players</h3>
            <p>Trade footballers as tokenized assets on an open marketplace. Prices move with form and demand.</p>
            <span className="tag">Marketplace</span>
          </Reveal>

          <Reveal className="pillar">
            <div className="ico">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                <circle cx={12} cy={12} r={5} />
              </svg>
            </div>
            <h3>Train your roster</h3>
            <p>Spend training sessions to level up pace, finishing, serve, and stamina. Stronger players, higher resale value.</p>
            <span className="tag">Progression</span>
          </Reveal>

          <Reveal className="pillar">
            <div className="ico">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={3} y={3} width={18} height={18} rx={2} />
                <circle cx={9} cy={9} r={1.6} />
                <circle cx={15} cy={15} r={1.6} />
                <path d="M9 9l6 6" />
              </svg>
            </div>
            <h3>Drag-and-drop tactics</h3>
            <p>Set formations and strategies on a live canvas for each game type. Save tactics per opponent and competition.</p>
            <span className="tag">Strategy board</span>
          </Reveal>

          <Reveal className="pillar wide">
            <div className="ico">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.9 7.2 16.4l.9-5.3L4.3 7.4l5.3-.8z" />
              </svg>
            </div>
            <h3>Crypto wagers on every match</h3>
            <p>Stake on your own games or anyone else's. Transparent on-chain odds, instant settlement, no middleman taking a cut.</p>
            <span className="tag">Peer-to-peer betting</span>
          </Reveal>

          <Reveal className="pillar">
            <div className="ico">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 20v-6M10 20V8M16 20v-9M22 20V4" />
              </svg>
            </div>
            <h3>Compete for prizes</h3>
            <p>Climb a per-sport leaderboard. Top managers each season split a pooled prize paid out automatically.</p>
            <span className="tag">Leaderboard</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
