import { useState, useEffect } from 'react';
import { type TabId } from '../components/Sidebar';
import { type OwnedPlayer } from '../../models/models';
import { type SquadState } from '../../hooks/useSquad';
import { getEffectiveStats } from '../../lib/playerUtils';
import { getSessionWallet } from '../../lib/auth';
import { listPlayer, unlistPlayer, nftConfigured } from '../../lib/nft';
import { useApp } from '../../context/AppContext';
import SportTabs from '../components/SportTabs';

// ── Sell (list on marketplace) modal ────────────────────────────────────────

function SellModal({
  player, busy, onConfirm, onClose,
}: {
  player:    OwnedPlayer;
  busy:      boolean;
  onConfirm: (priceCusd: string) => void;
  onClose:   () => void;
}) {
  const [price, setPrice] = useState(String(player.price_eth || ''));
  const valid = Number(price) > 0;

  return (
    <div className="cs-overlay" onClick={busy ? undefined : onClose}>
      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        {!busy && <button className="cs-close" onClick={onClose}>✕</button>}
        <div className="cs-title">Sell {player.name}</div>
        <p className="cs-text">
          List this player on the marketplace in cUSD. When another manager buys it,
          the sale price (minus the platform fee) is sent straight to your wallet.
        </p>
        <input
          type="number"
          min={0}
          step="0.1"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="Price in cUSD"
          disabled={busy}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'var(--bg-1)', border: '1px solid var(--line)',
            color: 'var(--fg)', fontSize: 15, fontFamily: 'inherit', textAlign: 'center',
          }}
        />
        <button
          className="q-btn primary"
          disabled={!valid || busy}
          onClick={() => onConfirm(price)}
          style={{ opacity: !valid || busy ? 0.5 : 1 }}
        >
          {busy ? 'Listing…' : `List for ${valid ? `${price} cUSD` : 'sale'}`}
        </button>
      </div>
    </div>
  );
}

const LINEUP_KEY = () => `ailympics_starting5_${getSessionWallet() ?? 'guest'}`;

export function getStoredLineup(): number[] {
  try { return JSON.parse(localStorage.getItem(LINEUP_KEY()) ?? '[]'); }
  catch { return []; }
}

interface SquadProps {
  squad:       SquadState;
  onTabChange: (tab: TabId) => void;
  showToast:   (msg: string) => void;
}

export default function Squad({ squad, onTabChange, showToast }: SquadProps) {
  const { players, release } = squad;
  const { listings, refreshListings } = useApp();
  const [releasing, setReleasing] = useState<string | null>(null);
  const [sellTarget, setSellTarget] = useState<OwnedPlayer | null>(null);
  const [listing, setListing] = useState(false);
  const [unlistingId, setUnlistingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(getStoredLineup()));

  // Re-sync when wallet changes
  useEffect(() => {
    setSelected(new Set(getStoredLineup()));
  }, []);

  const toggleSelect = (playerId: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        if (next.size >= 5) {
          showToast('Starting lineup is full — remove a player first');
          return prev;
        }
        next.add(playerId);
      }
      localStorage.setItem(LINEUP_KEY(), JSON.stringify([...next]));
      return next;
    });
  };

  const openSell = (player: OwnedPlayer) => {
    if (!nftConfigured())  { showToast('NFT marketplace is not live yet'); return; }
    if (!player.token_id)  { showToast('This player has not been minted on-chain yet'); return; }
    setSellTarget(player);
  };

  const handleSell = async (priceCusd: string) => {
    if (!sellTarget?.token_id) return;
    setListing(true);
    try {
      await listPlayer(BigInt(sellTarget.token_id), priceCusd);
      showToast(`${sellTarget.name} listed for ${priceCusd} cUSD`);
      setSellTarget(null);
      await refreshListings();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Listing failed';
      if (!/reject|denied|cancel/i.test(msg)) showToast(msg);
    } finally {
      setListing(false);
    }
  };

  const handleUnlist = async (player: OwnedPlayer) => {
    if (!player.token_id) return;
    setUnlistingId(player.ownership.id);
    try {
      await unlistPlayer(BigInt(player.token_id));
      showToast(`${player.name} removed from sale`);
      await refreshListings();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unlisting failed';
      if (!/reject|denied|cancel/i.test(msg)) showToast(msg);
    } finally {
      setUnlistingId(null);
    }
  };

  const handleRelease = async (userPlayerId: string, name: string) => {
    setReleasing(userPlayerId);
    const err = await release(userPlayerId);
    setReleasing(null);
    if (err) {
      showToast(err);
    } else {
      showToast(`${name} released from squad`);
    }
  };

  return (
    <div>
      <SportTabs />
      <div className="tab-toolbar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {players.length} player{players.length !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 11, color: selected.size === 5 ? 'var(--accent)' : 'var(--faint)' }}>
            Starting lineup: {selected.size}/5
          </div>
        </div>
        <button className="q-btn primary" onClick={() => onTabChange('marketplace')}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Sign Player
        </button>
      </div>

      {players.length === 0 ? (
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
          {players.map(p => {
            const stats = getEffectiveStats(p);
            const isReleasing = releasing === p.ownership.id;
            const isSelected = selected.has(p.id);
            const listed = p.token_id ? listings.get(p.token_id)?.active : false;
            const isUnlisting = unlistingId === p.ownership.id;

            return (
              <div
                key={p.ownership.id}
                className="pcard"
                style={{ outline: isSelected ? '2px solid var(--accent)' : undefined, position: 'relative' }}
              >
                {/* Starting lineup toggle */}
                <button
                  onClick={() => toggleSelect(p.id)}
                  title={isSelected ? 'Remove from starting lineup' : 'Add to starting lineup'}
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 5,
                    width: 24, height: 24, borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`,
                    background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.4)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, transition: 'all 0.15s',
                  }}
                >
                  {isSelected && (
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={3}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                <div className="ph">
                  <span className={`rare${p.is_icon ? ' icon' : ''}`}>{p.rarity}</span>
                  <span className="ovr">{p.base_ovr}</span>
                  <span className="ph-label">player render</span>
                </div>
                <div className="body">
                  <div className="nm">{p.name}</div>
                  <div className="pos">{p.position}</div>
                  <div className="stats-row">
                    {stats.slice(0, 3).map(s => (
                      <div key={s.label} className="s">
                        <b>{s.val}</b>
                        <span>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="foot">
                    <div className="price">
                      {p.is_nft ? (
                        <>
                          <b><span className="tk">Ξ</span>{p.price_eth}</b>
                          <span>{listed ? 'Listed' : 'NFT'}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {p.is_trainable ? 'Trainable' : '—'}
                        </span>
                      )}
                    </div>
                    {p.is_nft ? (
                      listed ? (
                        <button
                          className="buy owned"
                          disabled={isUnlisting}
                          onClick={() => handleUnlist(p)}
                        >
                          {isUnlisting ? '…' : 'Unlist'}
                        </button>
                      ) : (
                        <button
                          className="buy"
                          onClick={() => openSell(p)}
                        >
                          Sell
                        </button>
                      )
                    ) : (
                      <button
                        className="buy owned"
                        disabled={isReleasing}
                        onClick={() => handleRelease(p.ownership.id, p.name)}
                      >
                        {isReleasing ? '…' : 'Release'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sellTarget && (
        <SellModal
          player={sellTarget}
          busy={listing}
          onConfirm={handleSell}
          onClose={() => setSellTarget(null)}
        />
      )}
    </div>
  );
}
