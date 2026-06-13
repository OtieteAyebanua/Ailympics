import { useState } from 'react';
import { type Player } from '../data';
import { type TabId } from '../components/Sidebar';

interface SquadProps {
  ownedPlayers: Player[];
  onSell: (id: number) => void;
  onTabChange: (tab: TabId) => void;
  showToast: (msg: string) => void;
}

type Filter = 'all' | 'football' | 'tennis';

export default function Squad({ ownedPlayers, onSell, onTabChange, showToast }: SquadProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const visible = filter === 'all'
    ? ownedPlayers
    : ownedPlayers.filter(p => p.sport === filter);

  const handleSell = (p: Player) => {
    onSell(p.id);
    showToast(`${p.name} listed for sale`);
  };

  return (
    <div>
      <div className="tab-toolbar">
        <div className="filter-pills">
          {(['all', 'football', 'tennis'] as Filter[]).map(f => (
            <button
              key={f}
              className={`filter-pill${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <> · {ownedPlayers.filter(p => p.sport === f).length}</>
              )}
            </button>
          ))}
        </div>
        <button className="q-btn primary" onClick={() => onTabChange('marketplace')}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Sign Player
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx={9} cy={7} r={4} />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <h3>{filter === 'all' ? 'No players yet' : `No ${filter} players`}</h3>
          <p>
            {filter === 'all'
              ? 'Head to the marketplace to sign your first player and build your roster.'
              : `You haven\'t signed any ${filter} players. Browse the marketplace to find some.`}
          </p>
          <button className="q-btn primary" onClick={() => onTabChange('marketplace')}>
            Browse Marketplace
          </button>
        </div>
      ) : (
        <div className="cards">
          {visible.map(p => (
            <div key={p.id} className="pcard">
              <div className="ph">
                <span className={`rare${p.icon ? ' icon' : ''}`}>{p.rare}</span>
                <span className="ovr">{p.ovr}</span>
                <span className="ph-label">player render</span>
              </div>
              <div className="body">
                <div className="nm">{p.name}</div>
                <div className="pos">{p.pos} · {p.sport}</div>
                <div className="stats-row">
                  {p.stats.map(s => (
                    <div key={s.label} className="s">
                      <b>{s.val}</b>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="foot">
                  <div className="price">
                    <b><span className="tk">Ξ</span>{p.price}</b>
                    <span>{p.usd}</span>
                  </div>
                  <button className="buy owned" onClick={() => handleSell(p)}>
                    Sell
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
