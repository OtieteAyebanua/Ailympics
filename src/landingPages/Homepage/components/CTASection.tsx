import Reveal from './Reveal';

interface CTASectionProps {
  onLaunch: () => void;
}

export default function CTASection({ onLaunch }: CTASectionProps) {
  return (
    <section className="cta">
      <div className="wrap">
        <Reveal className="cta-box">
          <div className="glow2" />
          <span className="eyebrow" style={{ justifyContent: 'center' }}>Season 1 is live</span>
          <h2 className="display" style={{ marginTop: 16 }}>
            Your dynasty<br />starts now
          </h2>
          <p>Connect a wallet, draft your first players, and play your way to the top of the table.</p>
          <div className="hero-cta">
            <button className="btn btn-primary" onClick={onLaunch}>
              Launch App
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
