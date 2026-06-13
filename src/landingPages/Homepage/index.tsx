import { useState, useCallback, useRef } from 'react';
import './style.css';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Features from './components/Features';
import Strategy from './components/Strategy';
import Marketplace from './components/Marketplace';
import Train from './components/Train';
import Wagers from './components/Wagers';
import Leaderboard from './components/Leaderboard';
import CTASection from './components/CTASection';
import Footer from './components/Footer';
import Toast from './components/Toast';

function genAddr(): string {
  const h = '0123456789abcdef';
  let a = '0x';
  for (let i = 0; i < 4; i++) a += h[Math.floor(Math.random() * 16)];
  return a + '…' + h[Math.floor(Math.random() * 16)] + h[Math.floor(Math.random() * 16)] + 'f2';
}

interface HomepageProps {
  onNavigate?: () => void;
}

export default function Homepage({ onNavigate }: HomepageProps) {
  const [connected, setConnected] = useState(false);
  const [walletAddr, setWalletAddr] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }, []);

  const handleConnect = useCallback(() => {
    if (!connected) {
      setWalletAddr(genAddr());
      setConnected(true);
      showToast('Wallet connected');
    } else {
      setConnected(false);
      setWalletAddr('');
      showToast('Wallet disconnected');
    }
  }, [connected, showToast]);

  const needWallet = useCallback((): boolean => {
    if (!connected) {
      showToast('Connect a wallet first');
      return false;
    }
    return true;
  }, [connected, showToast]);

  const handleLaunch = useCallback(() => {
    if (onNavigate) {
      onNavigate();
    } else {
      showToast('App launching soon — join the waitlist!');
    }
  }, [onNavigate, showToast]);

  return (
    <>
      <Nav connected={connected} walletAddr={walletAddr} onConnect={handleConnect} />
      <main>
        <Hero onLaunch={handleLaunch} />
        <Features />
        <Strategy showToast={showToast} />
        <Marketplace needWallet={needWallet} showToast={showToast} />
        <Train needWallet={needWallet} showToast={showToast} />
        <Leaderboard />
        <CTASection onLaunch={handleLaunch} />
      </main>
      <Footer />
      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}
