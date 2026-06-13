import { useState } from 'react';
import { players, type Player } from '../data';

interface MarketplaceProps {
  ownedIds: Set<number>;
  onBuy: (player: Player) => void;
  onSell: (id: number) => void;
  needWallet: () => boolean;
  showToast: (msg: string) => void;
}

type SportFilter = 'all' | 'football';

export default function Marketplace({ ownedIds, onBuy, onSell, needWallet, showToast }: MarketplaceProps) {
  const [sport, setSport] = useState<SportFilter>('all');

  const visible = sport === 'all' ? players : players.filter(p => p.sport === sport);

  const handleAction = (p: Player) => {
    if (ownedIds.has(p.id)) {
      onSell(p.id);
      showToast(`${p.name} listed for sale`);
    } else {
      if (!needWallet()) return;
      onBuy(p);
      showToast(`Signed ${p.name} for Ξ${p.price}`);
    }
  };

  return (
    <div>
      <div className="tab-toolbar">
        <div className="mkt-search">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
          </svg>
          Search players…
        </div>
        <div className="filter-pills">
          {(['all', 'football'] as SportFilter[]).map(f => (
            <button
              key={f}
              className={`filter-pill${sport === f ? ' active' : ''}`}
              onClick={() => setSport(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: 'var(--faint)', marginLeft: 'auto' }}>
          {visible.length} players
        </span>
      </div>

      <div className="cards">
        {visible.map(p => {
          const owned = ownedIds.has(p.id);
          return (
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
                  <button className={`buy${owned ? ' owned' : ''}`} onClick={() => handleAction(p)}>
                    {owned ? 'Sell' : 'Buy'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
