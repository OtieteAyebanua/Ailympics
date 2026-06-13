import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function Homepage() {
  const navigate = useNavigate();
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

  const [pendingNavigate, setPendingNavigate] = useState(false);

  // Auto-navigate once wallet connects if user clicked Launch App while disconnected
  useEffect(() => {
    if (pendingNavigate && connected) {
      setPendingNavigate(false);
      navigate('/app');
    }
  }, [pendingNavigate, connected, navigate]);

  const handleLaunch = useCallback(() => {
    if (!connected) {
      showToast('Connect your wallet to enter the app');
      setPendingNavigate(true);
      toggleConnect();
      return;
    }
    navigate('/app');
  }, [connected, navigate, showToast, toggleConnect]);

  return (
    <>
      <Nav connected={connected} walletAddr={walletAddr} onConnect={toggleConnect} onLaunch={handleLaunch} />
      <main>
        <Hero onLaunch={handleLaunch} />
        <Features />
        <Strategy />
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
