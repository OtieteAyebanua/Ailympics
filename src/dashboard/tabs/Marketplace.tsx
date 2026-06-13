import { useState, useEffect } from 'react';
import { type DbPlayer } from '../../models/models';
import { type SquadState } from '../../hooks/useSquad';
import { getCloneablePlayers, getNFTPlayers } from '../../lib/marketplace';
import { getPlayerStats } from '../../lib/playerUtils';

interface MarketplaceProps {
  squad:      SquadState;
  needWallet: () => boolean;
  showToast:  (msg: string) => void;
}

type Tab = 'clone' | 'nft';

export default function Marketplace({ squad, needWallet, showToast }: MarketplaceProps) {
  const [tab,            setTab]            = useState<Tab>('clone');
  const [cloneables,     setCloneables]     = useState<DbPlayer[]>([]);
  const [nfts,           setNfts]           = useState<DbPlayer[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [cloning,        setCloning]        = useState<number | null>(null);

  const { players, count, limit, clone } = squad;
  const ownedIds = new Set(players.map(p => p.id));

  useEffect(() => {
    setLoadingCatalog(true);
    Promise.all([getCloneablePlayers(), getNFTPlayers()])
      .then(([c, n]) => { setCloneables(c); setNfts(n); })
      .catch(err => showToast(err.message))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const handleClone = async (player: DbPlayer) => {
    if (!needWallet()) return;
    if (count >= limit) { showToast(`Squad full — release a player first (${count}/${limit})`); return; }

    setCloning(player.id);
    const err = await clone(player.id);
    setCloning(null);

    if (err) showToast(err);
    else     showToast(`${player.name} added to your squad`);
  };

  const visible = tab === 'clone' ? cloneables : nfts;

  return (
    <div>
      <div className="tab-toolbar">
        <div className="filter-pills">
          <button className={`filter-pill${tab === 'clone' ? ' active' : ''}`} onClick={() => setTab('clone')}>
            Free Clone
          </button>
          <button className={`filter-pill${tab === 'nft' ? ' active' : ''}`} onClick={() => setTab('nft')}>
            NFT Players
          </button>
        </div>
        <span style={{ fontSize: 13, color: 'var(--faint)', marginLeft: 'auto' }}>
          {count} / {limit} squad slots
        </span>
      </div>

      {loadingCatalog ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 14 }}>
          Loading players…
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 14 }}>
          No players available yet.
        </div>
      ) : (
        <div className="cards">
          {visible.map(p => {
            const stats   = getPlayerStats(p).slice(0, 3);
            const owned   = ownedIds.has(p.id);
            const isCloning = cloning === p.id;

            return (
              <div key={p.id} className="pcard">
                <div className="ph">
                  <span className={`rare${p.is_icon ? ' icon' : ''}`}>{p.rarity}</span>
                  <span className="ovr">{p.base_ovr}</span>
                  <span className="ph-label">player render</span>
                </div>
                <div className="body">
                  <div className="nm">{p.name}</div>
                  <div className="pos">{p.position} · {p.sport}</div>
                  <div className="stats-row">
                    {stats.map(s => (
                      <div key={s.label} className="s">
                        <b>{s.val}</b>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="foot">
                    <div className="price">
                      {tab === 'nft' ? (
                        <b><span className="tk">Ξ</span>{p.price_eth}</b>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Free</span>
                      )}
                    </div>
                    {tab === 'clone' && (
                      <button
                        className={`buy${owned ? ' owned' : ''}`}
                        disabled={owned || isCloning || count >= limit}
                        onClick={() => handleClone(p)}
                      >
                        {isCloning ? '…' : owned ? 'In Squad' : 'Clone'}
                      </button>
                    )}
                    {tab === 'nft' && (
                      <button
                        className={`buy${owned ? ' owned' : ''}`}
                        disabled={owned}
                        onClick={() => {
                          if (!needWallet()) return;
                          showToast('On-chain purchase coming soon');
                        }}
                      >
                        {owned ? 'Owned' : 'Buy'}
                      </button>
                    )}
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
