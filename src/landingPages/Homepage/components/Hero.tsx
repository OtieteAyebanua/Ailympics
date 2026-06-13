import RetroPitch from "../../../dashboard/components/RetroPitch";

interface HeroProps {
  onLaunch: () => void;
}

export default function Hero({ onLaunch }: HeroProps) {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="sport-band reveal in"></div>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow reveal in">
              On-chain sports management
            </span>
            <h1 className="display reveal in">
              Own the <span className="hl">CLUB</span>.<br />
              Trade the <span className="hl">talent</span>.<br />
              Lead the <span className="hl">Table</span>
            </h1>
            <div className="hero-cta reveal in">
              <button className="btn btn-primary" onClick={onLaunch}>
                Launch App
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
          <RetroPitch />
        </div>
      </div>
    </section>
  );
}
