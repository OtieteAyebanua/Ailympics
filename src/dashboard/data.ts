export interface Player {
  id: number;
  name: string;
  pos: string;
  sport: 'football' | 'tennis';
  ovr: number;
  rare: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Icon';
  price: string;
  usd: string;
  stats: { label: string; val: number }[];
  icon: boolean;
}

export const players: Player[] = [
  { id: 1, name: 'M. Okafor',   pos: 'ST',      sport: 'football', ovr: 88, rare: 'Legendary', price: '4.2', usd: '$11,340', icon: false, stats: [{ label: 'PAC', val: 91 }, { label: 'SHO', val: 88 }, { label: 'PAS', val: 74 }] },
  { id: 2, name: 'L. Sørensen', pos: 'CM',      sport: 'football', ovr: 84, rare: 'Epic',      price: '2.1', usd: '$5,670',  icon: false, stats: [{ label: 'PAC', val: 79 }, { label: 'SHO', val: 72 }, { label: 'PAS', val: 90 }] },
  { id: 3, name: 'A. Volkova',  pos: 'Singles', sport: 'tennis',   ovr: 90, rare: 'Icon',      price: '6.8', usd: '$18,360', icon: true,  stats: [{ label: 'ACE', val: 88 }, { label: 'RET', val: 93 }, { label: 'SRV', val: 85 }] },
  { id: 4, name: 'D. Mensah',   pos: 'CB',      sport: 'football', ovr: 82, rare: 'Rare',      price: '1.4', usd: '$3,780',  icon: false, stats: [{ label: 'PAC', val: 75 }, { label: 'SHO', val: 48 }, { label: 'PAS', val: 78 }] },
  { id: 5, name: 'R. Petrov',   pos: 'GK',      sport: 'football', ovr: 85, rare: 'Epic',      price: '3.0', usd: '$8,100',  icon: false, stats: [{ label: 'REF', val: 89 }, { label: 'POS', val: 86 }, { label: 'KIC', val: 72 }] },
  { id: 6, name: 'Y. Nakamura', pos: 'Singles', sport: 'tennis',   ovr: 86, rare: 'Rare',      price: '2.5', usd: '$6,750',  icon: false, stats: [{ label: 'ACE', val: 82 }, { label: 'RET', val: 88 }, { label: 'SRV', val: 80 }] },
  { id: 7, name: 'T. Osei',     pos: 'LW',      sport: 'football', ovr: 87, rare: 'Epic',      price: '3.5', usd: '$9,450',  icon: false, stats: [{ label: 'PAC', val: 94 }, { label: 'SHO', val: 82 }, { label: 'DRI', val: 90 }] },
  { id: 8, name: 'C. Ferreira', pos: 'CAM',     sport: 'football', ovr: 83, rare: 'Rare',      price: '1.8', usd: '$4,860',  icon: false, stats: [{ label: 'PAC', val: 78 }, { label: 'SHO', val: 80 }, { label: 'PAS', val: 88 }] },
];

export interface Manager {
  name: string;
  addr: string;
  wins: number;
  losses: number;
  streak: string;
  winnings: string;
}

export const managers: Manager[] = [
  { name: 'CryptoGaffer', addr: '0x8a…f2', wins: 142, losses: 31, streak: 'W7', winnings: '186' },
  { name: 'BaselineBoss',  addr: '0x4c…9d', wins: 128, losses: 40, streak: 'W3', winnings: '142' },
  { name: 'TikiTakaDAO',   addr: '0x2f…11', wins: 119, losses: 44, streak: 'L1', winnings: '121' },
  { name: 'AceVentura',    addr: '0x9b…a7', wins: 104, losses: 52, streak: 'W2', winnings: '98'  },
  { name: 'GegenPress',    addr: '0x33…4e', wins: 97,  losses: 55, streak: 'W1', winnings: '87'  },
  { name: 'NetGains_eth',  addr: '0x71…c0', wins: 91,  losses: 60, streak: 'L2', winnings: '74'  },
];

export interface MatchData {
  id: number;
  league: string;
  live: boolean;
  home: string;
  homeFull: string;
  away: string;
  awayFull: string;
  odds: (number | null)[];
}

export const matches: MatchData[] = [
  { id: 1, league: 'Ailympics Premier · Football', live: true,  home: 'NOVA', homeFull: 'Nova FC',     away: 'TITAN', awayFull: 'Titan United', odds: [2.1, 3.4, 2.8] },
  { id: 2, league: 'Grand Slam Series · Tennis',   live: true,  home: 'VLK',  homeFull: 'A. Volkova',  away: 'RMS',   awayFull: 'J. Ramos',     odds: [1.6, null, 2.3] },
  { id: 3, league: 'Division 2 · Football',        live: false, home: 'STR',  homeFull: 'Storm City',  away: 'IRON',  awayFull: 'Ironside',     odds: [2.4, 3.1, 2.5] },
];
