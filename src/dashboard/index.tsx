import { useState, useCallback, useRef } from 'react';
import '../landingPages/Homepage/style.css';
import './dashboard.css';
import Sidebar, { type TabId } from './components/Sidebar';
import Toast from '../landingPages/Homepage/components/Toast';
import Overview from './tabs/Overview';
import Squad from './tabs/Squad';
import Marketplace from './tabs/Marketplace';
import Strategy from './tabs/Strategy';
import Training from './tabs/Training';
import Wagers from './tabs/Wagers';
import Leaderboard from './tabs/Leaderboard';
import { type Player } from './data';

const TAB_TITLES: Record<TabId, string> = {
  overview:     'Overview',
  squad:        'My Squad',
  marketplace:  'Marketplace',
  strategy:     'Strategy Board',
  training:     'Training Ground',
  wagers:       'Wagers',
  leaderboard:  'Leaderboard',
};

function genAddr() {
  const h = '0123456789abcdef';
  let a = '0x';
  for (let i = 0; i < 4; i++) a += h[Math.floor(Math.random() * 16)];
  return a + '…' + h[Math.floor(Math.random() * 16)] + h[Math.floor(Math.random() * 16)] + 'f2';
}

interface DashboardProps {
  onBack?: () => void;
}

export default function Dashboard({ onBack }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [connected, setConnected] = useState(false);
  const [walletAddr, setWalletAddr] = useState('');
  const [ownedPlayers, setOwnedPlayers] = useState<Player[]>([]);
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
    if (!connected) { showToast('Connect a wallet first'); return false; }
    return true;
  }, [connected, showToast]);

  const ownedIds = new Set(ownedPlayers.map(p => p.id));

  const handleBuy = useCallback((player: Player) => {
    setOwnedPlayers(prev => prev.some(p => p.id === player.id) ? prev : [...prev, player]);
  }, []);

  const handleSell = useCallback((id: number) => {
    setOwnedPlayers(prev => prev.filter(p => p.id !== id));
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview ownedPlayers={ownedPlayers} onTabChange={setActiveTab} connected={connected} />;
      case 'squad':
        return <Squad ownedPlayers={ownedPlayers} onSell={handleSell} onTabChange={setActiveTab} showToast={showToast} />;
      case 'marketplace':
        return <Marketplace ownedIds={ownedIds} onBuy={handleBuy} onSell={handleSell} needWallet={needWallet} showToast={showToast} />;
      case 'strategy':
        return <Strategy showToast={showToast} />;
      case 'training':
        return <Training ownedPlayers={ownedPlayers} needWallet={needWallet} showToast={showToast} />;
      case 'wagers':
        return <Wagers needWallet={needWallet} showToast={showToast} />;
      case 'leaderboard':
        return <Leaderboard />;
    }
  };

  return (
    <div className="dash-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connected={connected}
        walletAddr={walletAddr}
        onConnect={handleConnect}
      />

      <div className="dash-content">
        <header className="dash-header">
          <h1>{TAB_TITLES[activeTab]}</h1>
          <div className="dash-header-actions">
            {onBack && (
              <button
                className="q-btn"
                onClick={onBack}
                style={{ fontSize: 12 }}
              >
                ← Back to site
              </button>
            )}
          </div>
        </header>

        <main className="dash-body">
          {renderTab()}
        </main>
      </div>

      <Toast message={toastMsg} visible={toastVisible} />
    </div>
  );
}
