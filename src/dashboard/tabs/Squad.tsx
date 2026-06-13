import { useState } from 'react';
import { type TabId } from '../components/Sidebar';
import { type SquadState } from '../../hooks/useSquad';
import { getEffectiveStats } from '../../lib/playerUtils';

interface SquadProps {
  squad:       SquadState;
  onTabChange: (tab: TabId) => void;
  showToast:   (msg: string) => void;
}

export default function Squad({ squad, onTabChange, showToast }: SquadProps) {
  const { players, release } = squad;
  const [releasing, setReleasing] = useState<string | null>(null);

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
      <div className="tab-toolbar">
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {players.length} player{players.length !== 1 ? 's' : ''}
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

            return (
              <div key={p.ownership.id} className="pcard">
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
                          <span>NFT</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {p.is_trainable ? 'Trainable' : '—'}
                        </span>
                      )}
                    </div>
                    {!p.is_nft && (
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
    </div>
  );
}
