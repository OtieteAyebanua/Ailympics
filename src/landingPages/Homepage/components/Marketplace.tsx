import { useState } from 'react';
import Reveal from './Reveal';

interface MarketplaceProps {
  needWallet: () => boolean;
  showToast: (msg: string) => void;
}

interface Player {
  n: string;
  pos: string;
  ovr: number;
  rare: string;
  price: string;
  usd: string;
  stat1: number;
  stat2: number;
  stat3: number;
  icon: boolean;
}

const players: Player[] = [
  { n: 'M. Okafor',   pos: 'ST · Football',      ovr: 88, rare: 'Legendary', price: '4.2', usd: '$11,340', stat1: 91, stat2: 88, stat3: 74, icon: false },
  { n: 'L. Sørensen', pos: 'CM · Football',       ovr: 84, rare: 'Epic',      price: '2.1', usd: '$5,670',  stat1: 79, stat2: 72, stat3: 90, icon: false },
  { n: 'D. Mensah',   pos: 'CB · Football',       ovr: 82, rare: 'Rare',      price: '1.4', usd: '$3,780',  stat1: 75, stat2: 48, stat3: 78, icon: false },
  { n: 'T. Osei',     pos: 'LW · Football',       ovr: 87, rare: 'Epic',      price: '3.5', usd: '$9,450',  stat1: 94, stat2: 82, stat3: 90, icon: false },
];

function statLabels(): [string, string, string] {
  return ['PAC', 'SHO', 'PAS'];
}

function PlayerCard({ player }: { player: Player; needWallet: () => boolean; showToast: (msg: string) => void }) {
  const [owned, setOwned] = useState(false);
  const labels = statLabels();
  setOwned(false);

  return (
    <Reveal className="pcard">
      <div className="ph">
        <span className={`rare${player.icon ? ' icon' : ''}`}>{player.rare}</span>
        <span className="ovr">{player.ovr}</span>
        <span className="ph-label">player render</span>
      </div>
      <div className="body">
        <div className="nm">{player.n}</div>
        <div className="pos">{player.pos}</div>
        <div className="stats-row">
          <div className="s"><b>{player.stat1}</b><span>{labels[0]}</span></div>
          <div className="s"><b>{player.stat2}</b><span>{labels[1]}</span></div>
          <div className="s"><b>{player.stat3}</b><span>{labels[2]}</span></div>
        </div>
        <div className="foot">
          <div className="price">
            <b><span className="tk">Ξ</span>{player.price}</b>
            <span>{player.usd}</span>
          </div>
          <button className={`buy${owned ? ' owned' : ''}`} >
             Buy
          </button>
        </div>
      </div>
    </Reveal>
  );
}

export default function Marketplace({ needWallet, showToast }: MarketplaceProps) {
  return (
    <section className="sec" id="market">
      <div className="wrap">
        <div className="market-head reveal in">
          <div className="sec-head">
            <span className="eyebrow">Marketplace</span>
            <h2 className="display">Sign the <span className="accent">superstars</span></h2>
            <p>Browse a living market of tokenized athletes. Buy low, train them up, sell at a premium.</p>
          </div>

        </div>

        <div className="cards">
          {players.map((p, i) => (
            <PlayerCard key={i} player={p} needWallet={needWallet} showToast={showToast} />
          ))}
        </div>
      </div>
    </section>
  );
}
