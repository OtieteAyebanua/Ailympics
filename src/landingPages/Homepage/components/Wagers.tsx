import { useState } from 'react';
import Reveal from './Reveal';

interface WagersProps {
  needWallet: () => boolean;
  showToast: (msg: string) => void;
}

interface Match {
  league: string;
  live: boolean;
  home: string;
  homeFull: string;
  away: string;
  awayFull: string;
  odds: (number | null)[];
}

interface Pick {
  matchLabel: string;
  label: string;
  odd: number;
}

const matchData: Match[] = [
  {
    league: 'Ailympics Premier · Football',
    live: true,
    home: 'NOVA', homeFull: 'Nova FC',
    away: 'TITAN', awayFull: 'Titan United',
    odds: [2.1, 3.4, 2.8],
  },
  {
    league: 'Grand Slam Series · Tennis',
    live: true,
    home: 'VLK', homeFull: 'A. Volkova',
    away: 'RMS', awayFull: 'J. Ramos',
    odds: [1.6, null, 2.3],
  },
  {
    league: 'Division 2 · Football',
    live: false,
    home: 'STR', homeFull: 'Storm City',
    away: 'IRON', awayFull: 'Ironside',
    odds: [2.4, 3.1, 2.5],
  },
];

function oddDefs(odds: (number | null)[]): { label: string; odd: number }[] {
  if (odds[1] === null) {
    return [
      { label: 'Home win', odd: odds[0]! },
      { label: 'Away win', odd: odds[2]! },
    ];
  }
  return [
    { label: 'Home', odd: odds[0]! },
    { label: 'Draw', odd: odds[1]! },
    { label: 'Away', odd: odds[2]! },
  ];
}

export default function Wagers({ needWallet, showToast }: WagersProps) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [selected, setSelected] = useState<{ matchIdx: number; label: string } | null>(null);
  const [stake, setStake] = useState(1.0);

  const payout = pick ? stake * pick.odd : 0;

  const selectOdd = (matchIdx: number, label: string, odd: number) => {
    const m = matchData[matchIdx];
    setPick({ matchLabel: `${m.homeFull} vs ${m.awayFull}`, label, odd });
    setSelected({ matchIdx, label });
  };

  const placeBet = () => {
    if (!pick || !needWallet()) return;
    showToast(`Bet placed: Ξ${stake.toFixed(1)} on ${pick.label}`);
    setPick(null);
    setSelected(null);
  };

  return (
    <section className="sec" id="wagers">
      <div className="wrap">
        <Reveal className="sec-head">
          <span className="eyebrow">Wagers</span>
          <h2 className="display">Put your crypto <span className="accent">on the line</span></h2>
          <p>Back your reads on live matches across the network. Pick an outcome, set your stake, and place a fully on-chain bet.</p>
        </Reveal>

        <div className="wager-grid">
          <div className="matches">
            {matchData.map((m, mi) => {
              const isSel = selected?.matchIdx === mi;
              return (
                <div key={mi} className={`match${isSel ? ' sel' : ''}`}>
                  <div className="mtop">
                    <div className="league">{m.league}</div>
                    {m.live
                      ? <div className="live-pill"><span className="dot" /> LIVE</div>
                      : <div className="league" style={{ color: 'var(--faint)' }}>Starts 19:30</div>
                    }
                  </div>
                  <div className="teams">
                    <div className="team">
                      <div className="badge">{m.home}</div>
                      <div className="tn">{m.homeFull}</div>
                    </div>
                    <div className="vs">VS</div>
                    <div className="team away">
                      <div className="badge">{m.away}</div>
                      <div className="tn">{m.awayFull}</div>
                    </div>
                  </div>
                  <div className="odds">
                    {oddDefs(m.odds).map(({ label, odd }) => {
                      const isOn = isSel && selected?.label === label;
                      return (
                        <button
                          key={label}
                          className={`odd${isOn ? ' on' : ''}`}
                          onClick={() => selectOdd(mi, label, odd)}
                        >
                          <small>{label}</small>
                          <b>{odd.toFixed(2)}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <Reveal className="slip">
            <h4>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 4h16v4H4zM4 12h16v8H4z" />
              </svg>
              Bet slip
            </h4>

            {pick ? (
              <div className="sel-line">
                <div className="pick">
                  <b>{pick.label}</b>
                  <span className="o">{pick.odd.toFixed(2)}</span>
                </div>
                <div className="mt">{pick.matchLabel}</div>
              </div>
            ) : (
              <div className="sel-line empty">Tap an outcome to add it to your slip</div>
            )}

            <div className="amt-label">
              Stake <b className="mono">Ξ {stake.toFixed(1)}</b>
            </div>
            <input
              type="range"
              min={0.1}
              max={10}
              step={0.1}
              value={stake}
              onChange={e => setStake(+e.target.value)}
            />

            <div className="payout">
              <span>Potential payout</span>
              <b className="mono">Ξ {payout.toFixed(2)}</b>
            </div>

            <button className="place" disabled={!pick} onClick={placeBet}>
              {pick ? 'Place bet' : 'Select an outcome'}
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
