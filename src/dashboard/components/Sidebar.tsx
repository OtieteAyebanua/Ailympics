export type TabId = 'overview' | 'squad' | 'marketplace' | 'strategy' | 'training' | 'wagers' | 'leaderboard';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group?: string;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    label: 'Overview',
    group: 'Main',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x={3} y={3} width={7} height={7} rx={1} /><rect x={14} y={3} width={7} height={7} rx={1} />
        <rect x={3} y={14} width={7} height={7} rx={1} /><rect x={14} y={14} width={7} height={7} rx={1} />
      </svg>
    ),
  },
  {
    id: 'squad',
    label: 'My Squad',
    group: 'Manage',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx={9} cy={7} r={4} />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1={3} y1={6} x2={21} y2={6} />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
  {
    id: 'strategy',
    label: 'Strategy',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
        <circle cx={12} cy={12} r={3} />
      </svg>
    ),
  },
  {
    id: 'training',
    label: 'Training',
    group: 'Progress',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    id: 'wagers',
    label: 'Wagers',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x={2} y={2} width={20} height={20} rx={4} />
        <circle cx={8} cy={8} r={1.5} fill="currentColor" />
        <circle cx={16} cy={8} r={1.5} fill="currentColor" />
        <circle cx={8} cy={16} r={1.5} fill="currentColor" />
        <circle cx={16} cy={16} r={1.5} fill="currentColor" />
        <circle cx={12} cy={12} r={1.5} fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'leaderboard',
    label: 'Leaderboard',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M6 9a6 6 0 0012 0V3H6z" />
        <path d="M4 5H2v2a4 4 0 004 4M20 5h2v2a4 4 0 01-4 4M9 21h6M12 17v4" />
      </svg>
    ),
  },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  connected: boolean;
  walletAddr: string;
  onConnect: () => void;
}

export default function Sidebar({ activeTab, onTabChange, connected, walletAddr, onConnect }: SidebarProps) {
  let lastGroup: string | undefined;

  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <span className="mark">A</span>
        <b>AILYMPICS</b>
      </div>

      <nav className="sb-nav">
        {tabs.map(tab => {
          const showGroup = tab.group && tab.group !== lastGroup;
          if (tab.group) lastGroup = tab.group;

          return (
            <div key={tab.id}>
              {showGroup && <div className="sb-section-label">{tab.group}</div>}
              <button
                className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="sb-footer">
        {connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <div className="wallet-chip" style={{ cursor: 'default' }}>
              <span className="wc-dot" />
              <div className="wc-info">
                <span className="wc-label">Connected · Celo</span>
                <span className="wc-addr">{walletAddr}</span>
              </div>
            </div>
            <button
              className="q-btn"
              onClick={onConnect}
              style={{ width: '100%', justifyContent: 'center', fontSize: 12, opacity: 0.8 }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button className="wallet-chip" onClick={onConnect}>
            <span className="wc-dot off" />
            <div className="wc-info">
              <span className="wc-label">Wallet</span>
              <span className="wc-addr">Connect wallet</span>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}
