export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="about">
            <a href="#" className="logo">
              <span className="mark">A</span>
              <b>AILYMPICS</b>
            </a>
            <p>The on-chain sports management arena. Own teams, trade talent, set tactics, and wager across football and tennis.</p>
          </div>

          <div>
            <h5>Platform</h5>
            <a href="#market">Marketplace</a>
            <a href="#train">Training</a>
            <a href="#strategy">Strategy</a>
            <a href="#wagers">Wagers</a>
          </div>

          <div>
            <h5>Compete</h5>
            <a href="#leaderboard">Leaderboard</a>
            <a href="#">Tournaments</a>
            <a href="#">Prize pool</a>
            <a href="#">Seasons</a>
          </div>

          <div>
            <h5>Resources</h5>
            <a href="#">Docs</a>
            <a href="#">Whitepaper</a>
            <a href="#">Smart contracts</a>
            <a href="#">FAQ</a>
          </div>
        </div>

        <div className="foot-bottom">
          <span>© 2026 Ailympics. All rights reserved. Crypto wagering involves risk.</span>
          <div className="soc">
            <a href="#" aria-label="X">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h3l-7 8 8 12h-6l-5-7-5 7H3l8-10L3 2h6l4 6z" />
              </svg>
            </a>
            <a href="#" aria-label="Discord">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 5a16 16 0 00-4-1l-.2.4A12 12 0 0118 6a13 13 0 00-12 0 12 12 0 003.2-1.6L9 4a16 16 0 00-4 1C3 8 2 11 2.3 15a16 16 0 005 2l.6-1a9 9 0 01-2-1l.5-.3a11 11 0 009.2 0l.5.3a9 9 0 01-2 1l.6 1a16 16 0 005-2c.4-5-.8-8-2.3-10zM9 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
              </svg>
            </a>
            <a href="#" aria-label="Telegram">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 3L2 11l5 2 2 6 3-4 5 4z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
