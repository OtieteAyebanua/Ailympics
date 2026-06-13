import { useState, useEffect } from 'react';

interface NavProps {
  connected: boolean;
  walletAddr: string;
  onConnect: () => void;
}

export default function Nav({ connected, walletAddr, onConnect }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const menuStyle = menuOpen
    ? {
        display: 'flex' as const,
        position: 'absolute' as const,
        top: '72px',
        left: 0,
        right: 0,
        flexDirection: 'column' as const,
        background: 'var(--bg-2)',
        padding: '18px 28px',
        borderBottom: '1px solid var(--line)',
        gap: '16px',
      }
    : undefined;

  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
      <div className="wrap nav-inner">
        <a href="#" className="logo">
          <span className="mark">A</span>
          <b>AILYMPICS</b>
        </a>

        <div className="nav-cta">
          <button className="btn btn-ghost btn-sm">Launch App</button>
          <button
            className={`btn btn-primary btn-sm wallet-btn${connected ? ' connected' : ''}`}
            onClick={onConnect}
          >
            {connected ? (
              <><span className="dot" />{walletAddr}</>
            ) : (
              'Connect Wallet'
            )}
          </button>
          <button className="burger" onClick={() => setMenuOpen(o => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
