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
import Matches from './tabs/Matches';
import { matches } from './data';
import { useWallet } from '../hooks/useWallet';
import { AppProvider, useApp } from '../context/AppContext';

const TAB_TITLES: Record<TabId, string> = {
  overview:    'Overview',
  squad:       'My Squad',
  marketplace: 'Marketplace',
  strategy:    'Strategy Board',
  training:    'Training Ground',
  wagers:      'Wagers',
  leaderboard: 'Leaderboard',
  matches:     'Live Matches',
};

export default function Dashboard() {
  const [toastMsg, setToastMsg]   = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }, []);

  const wallet = useWallet(showToast);

  return (
    <AppProvider showToast={showToast}>
      <DashboardInner wallet={wallet} showToast={showToast} />
      <Toast message={toastMsg} visible={toastVisible} />
    </AppProvider>
  );
}

function DashboardInner({
  wallet,
  showToast,
}: {
  wallet: ReturnType<typeof useWallet>;
  showToast: (msg: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { connected, walletAddr, onCelo, networkName, toggleConnect, needWallet } = wallet;

  const { squad } = useApp();

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Overview
            squad={squad}
            onTabChange={setActiveTab}
            connected={connected}
          />
        );
      case 'squad':
        return (
          <Squad
            squad={squad}
            onTabChange={setActiveTab}
            showToast={showToast}
          />
        );
      case 'marketplace':
        return (
          <Marketplace
            squad={squad}
            needWallet={needWallet}
            showToast={showToast}
          />
        );
      case 'strategy':
        return <Strategy showToast={showToast} />;
      case 'training':
        return (
          <Training
            squad={squad}
            needWallet={needWallet}
            showToast={showToast}
          />
        );
      case 'wagers':
        return <Wagers needWallet={needWallet} showToast={showToast} />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'matches':
        return <Matches />;
    }
  };

  return (
    <div className="dash-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        connected={connected}
        walletAddr={walletAddr}
        onConnect={toggleConnect}
        liveCount={matches.filter(m => m.live).length}
      />

      <div className="dash-content">
        <header className="dash-header">
          <h1>{TAB_TITLES[activeTab]}</h1>
          <div className="dash-header-actions">
            {connected && !onCelo && (
              <span style={{ fontSize: 12, color: '#ff7a7a', fontWeight: 600 }}>
                ⚠ Switch to Celo ({networkName})
              </span>
            )}
          </div>
        </header>

        <main className="dash-body">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
