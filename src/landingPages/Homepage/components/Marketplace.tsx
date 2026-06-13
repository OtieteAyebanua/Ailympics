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
  { n: 'A. Volkova',  pos: 'Singles · Tennis',    ovr: 90, rare: 'Icon',      price: '6.8', usd: '$18,360', stat1: 88, stat2: 93, stat3: 85, icon: true  },
  { n: 'D. Mensah',   pos: 'CB · Football',       ovr: 82, rare: 'Rare',      price: '1.4', usd: '$3,780',  stat1: 75, stat2: 48, stat3: 78, icon: false },
];

function statLabels(pos: string): [string, string, string] {
  return pos.includes('Tennis') ? ['ACE', 'RET', 'SRV'] : ['PAC', 'SHO', 'PAS'];
}

function PlayerCard({ player }: { player: Player; needWallet: () => boolean; showToast: (msg: string) => void }) {
  const [owned, setOwned] = useState(false);
  const labels = statLabels(player.pos);

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
