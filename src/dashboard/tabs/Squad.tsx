import { useState } from 'react';
import { type Player } from '../data';
import { type TabId } from '../components/Sidebar';

interface SquadProps {
  ownedPlayers: Player[];
  onSell: (id: number) => void;
  onTabChange: (tab: TabId) => void;
  showToast: (msg: string) => void;
}

export default function Squad({ ownedPlayers, onSell, onTabChange, showToast }: SquadProps) {
  const [discounts, setDiscounts] = useState<Record<number, number>>({});

  const visible = ownedPlayers;

  const getDiscount = (id: number) => discounts[id] ?? 0;

  const setDiscount = (id: number, pct: number) =>
    setDiscounts(prev => ({ ...prev, [id]: pct }));

  const discountedPrice = (price: string, pct: number) => {
    const raw = parseFloat(price);
    return (raw * (1 - pct / 100)).toFixed(3);
  };

  const handleSell = (p: Player) => {
    const pct = getDiscount(p.id);
    onSell(p.id);
    const label = pct > 0
      ? `${p.name} listed at ${pct}% off`
      : `${p.name} listed for sale`;
    showToast(label);
  };

  return (
    <div>
      <div className="tab-toolbar">
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {ownedPlayers.length} player{ownedPlayers.length !== 1 ? 's' : ''}
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
          <h3>No players yet</h3>
          <p>Head to the marketplace to sign your first player and build your roster.</p>
          <button className="q-btn primary" onClick={() => onTabChange('marketplace')}>
            Browse Marketplace
          </button>
        </div>
      ) : (
        <div className="cards">
          {visible.map(p => {
            const pct = getDiscount(p.id);
            const hasDiscount = pct > 0;
            const finalPrice = hasDiscount ? discountedPrice(p.price, pct) : p.price;

            return (
              <div key={p.id} className="pcard">
                <div className="ph">
                  <span className={`rare${p.icon ? ' icon' : ''}`}>{p.rare}</span>
                  <span className="ovr">{p.ovr}</span>
                  {hasDiscount && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      background: '#ff4d4d', color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                    }}>
                      -{pct}%
                    </span>
                  )}
                  <span className="ph-label">player render</span>
                </div>
                <div className="body">
                  <div className="nm">{p.name}</div>
                  <div className="pos">{p.pos}</div>
                  <div className="stats-row">
                    {p.stats.map(s => (
                      <div key={s.label} className="s">
                        <b>{s.val}</b>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '8px 0 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, opacity: 0.7 }}>
                      <span>Discount</span>
                      <span style={{ fontWeight: 700, color: hasDiscount ? '#ff4d4d' : 'inherit' }}>
                        {pct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={5}
                      value={pct}
                      onChange={e => setDiscount(p.id, Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </div>

                  <div className="foot">
                    <div className="price">
                      {hasDiscount ? (
                        <>
                          <b style={{ color: '#ff4d4d' }}>
                            <span className="tk">Ξ</span>{finalPrice}
                          </b>
                          <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                            Ξ{p.price}
                          </span>
                        </>
                      ) : (
                        <>
                          <b><span className="tk">Ξ</span>{p.price}</b>
                          <span>{p.usd}</span>
                        </>
                      )}
                    </div>
                    <button className="buy owned" onClick={() => handleSell(p)}>
                      {hasDiscount ? `Sell −${pct}%` : 'Sell'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
