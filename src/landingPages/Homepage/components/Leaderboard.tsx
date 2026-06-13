import Reveal from './Reveal';

interface Manager {
  n: string;
  h: string;
  w: number;
  l: number;
  streak: string;
  win: string;
}

const managers: Manager[] = [
  { n: 'CryptoGaffer', h: '0x8a…f2', w: 142, l: 31,  streak: 'W7', win: '186' },
  { n: 'BaselineBoss',  h: '0x4c…9d', w: 128, l: 40,  streak: 'W3', win: '142' },
  { n: 'TikiTakaDAO',   h: '0x2f…11', w: 119, l: 44,  streak: 'L1', win: '121' },
  { n: 'AceVentura',    h: '0x9b…a7', w: 104, l: 52,  streak: 'W2', win: '98'  },
  { n: 'GegenPress',    h: '0x33…4e', w: 97,  l: 55,  streak: 'W1', win: '87'  },
  { n: 'NetGains_eth',  h: '0x71…c0', w: 91,  l: 60,  streak: 'L2', win: '74'  },
];

const medals = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  return (
    <section className="sec train" id="leaderboard">
      <div className="wrap">
        <div className="lead-head reveal in">
          <div className="sec-head">
            <span className="eyebrow">Leaderboard</span>
            <h2 className="display">Climb. Win. <span className="accent">Cash out.</span></h2>
            <p>Season standings update every match. The top managers split the prize pool when the season closes.</p>
          </div>
          <div className="prize">
            <div className="pi">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 9a6 6 0 0012 0V3H6zM4 5H2v2a4 4 0 004 4M20 5h2v2a4 4 0 01-4 4M9 21h6M12 17v4" />
              </svg>
            </div>
            <div>
              <b className="mono">Ξ 820</b>
              <span>Season prize pool</span>
            </div>
          </div>
        </div>

        <Reveal className="board">
          <div className="lr head">
            <div>Rank</div>
            <div>Manager</div>
            <div>W / L</div>
            <div className="col-streak">Streak</div>
            <div className="winnings" style={{ textAlign: 'right' }}>Winnings</div>
          </div>
          {managers.map((m, i) => (
            <div key={m.n} className={`lr${i < 3 ? ` top${i + 1}` : ''}`}>
              <div className="rank">{medals[i] ?? `#${i + 1}`}</div>
              <div className="mgr">
                <div className="av">{m.n.slice(0, 2).toUpperCase()}</div>
                <div className="mn">
                  <b>{m.n}</b>
                  <span>{m.h}</span>
                </div>
              </div>
              <div className="wl"><span className="w">{m.w}W</span> · {m.l}L</div>
              <div className="streak col-streak">{m.streak}</div>
              <div className="winnings"><span className="tk">Ξ</span>{m.win}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
