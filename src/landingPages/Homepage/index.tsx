import { useState, useCallback, useRef } from 'react';
import './style.css';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Features from './components/Features';
import Strategy from './components/Strategy';
import Marketplace from './components/Marketplace';
import Train from './components/Train';
import Leaderboard from './components/Leaderboard';
import CTASection from './components/CTASection';
import Footer from './components/Footer';
import Toast from './components/Toast';
import { useWallet } from '../../hooks/useWallet';

interface HomepageProps {
  onNavigate?: () => void;
}

export default function Homepage({ onNavigate }: HomepageProps) {
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }, []);

  const { connected, walletAddr, toggleConnect, needWallet } = useWallet(showToast);

  const handleLaunch = useCallback(() => {
    if (onNavigate) {
      onNavigate();
    } else {
      showToast('App launching soon — join the waitlist!');
    }
  }, [onNavigate, showToast]);

  return (
    <>
      <Nav connected={connected} walletAddr={walletAddr} onConnect={toggleConnect} onLaunch={handleLaunch} />
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
