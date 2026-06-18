import { useState } from 'react';
import { type DbPlayer } from '../../models/models';
import { type SquadState } from '../../hooks/useSquad';
import { useApp } from '../../context/AppContext';
import { getPlayerStats } from '../../lib/playerUtils';
import { buyPlayer, verifyPurchase, nftConfigured, formatCusd } from '../../lib/nft';
import SportTabs from '../components/SportTabs';

interface MarketplaceProps {
  squad:      SquadState;
  needWallet: () => boolean;
  showToast:  (msg: string) => void;
}

type Tab = 'clone' | 'nft';

export default function Marketplace({ squad, needWallet, showToast }: MarketplaceProps) {
  const [tab,            setTab]            = useState<Tab>('clone');
  const [cloning,        setCloning]        = useState<number | null>(null);
  const [buying,         setBuying]         = useState<number | null>(null);
  const [forSaleOnly,    setForSaleOnly]    = useState(false);

  const { cloneables, nfts, catalogLoading: loadingCatalog, listings, refreshListings } = useApp();

  const { players, count, limit, clone } = squad;
  const ownedIds = new Set(players.map(p => p.id));

  const listingOf = (p: DbPlayer) => (p.token_id ? listings.get(p.token_id) : undefined);

  const handleBuy = async (p: DbPlayer) => {
    if (!needWallet()) return;
    if (!nftConfigured())  { showToast('NFT marketplace is not live yet'); return; }
    if (!p.token_id)       { showToast(`${p.name} hasn't been minted yet`); return; }

    setBuying(p.id);
    try {
      const { txHash } = await buyPlayer(BigInt(p.token_id));
      const err = await verifyPurchase(txHash);
      if (err) showToast(`Purchased — but syncing your squad failed: ${err}`);
      else     showToast(`${p.name} is now in your squad!`);
      await Promise.all([squad.refresh(), refreshListings()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Purchase failed';
      if (!/reject|denied|cancel/i.test(msg)) showToast(msg);
    } finally {
      setBuying(null);
    }
  };

  const handleClone = async (player: DbPlayer) => {
    if (!needWallet()) return;
    if (count >= limit) { showToast(`Squad full — release a player first (${count}/${limit})`); return; }

    setCloning(player.id);
    const err = await clone(player.id);
    setCloning(null);

    if (err) showToast(err);
    else     showToast(`${player.name} added to your squad`);
  };

  const nftList = forSaleOnly ? nfts.filter(p => listingOf(p)?.active) : nfts;
  const visible = tab === 'clone' ? cloneables : nftList;

  return (
    <div>
      <SportTabs />
      <div className="tab-toolbar">
        <div className="filter-pills">
          <button className={`filter-pill${tab === 'clone' ? ' active' : ''}`} onClick={() => setTab('clone')}>
            Free Clone
          </button>
          <button className={`filter-pill${tab === 'nft' ? ' active' : ''}`} onClick={() => setTab('nft')}>
            NFT Players
          </button>
          {tab === 'nft' && (
            <button
              className={`filter-pill${forSaleOnly ? ' active' : ''}`}
              style={{ marginLeft: 8 }}
              onClick={() => setForSaleOnly(v => !v)}
            >
              For sale only
            </button>
          )}
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
            const listing = tab === 'nft' ? listingOf(p) : undefined;
            const forSale = !!listing?.active;
            const nftPrice = listing?.active ? formatCusd(listing.price) : String(p.price_eth);

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
                        <>
                          <b><span className="tk">Ξ</span>{nftPrice}</b>
                          <span style={{ fontSize: 10, color: forSale ? 'var(--accent)' : 'var(--faint)' }}>
                            {forSale ? 'For sale' : 'Not listed'}
                          </span>
                        </>
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
                        disabled={owned || !forSale || buying === p.id}
                        onClick={() => handleBuy(p)}
                      >
                        {buying === p.id ? '…' : owned ? 'Owned' : forSale ? 'Buy' : 'Not listed'}
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
