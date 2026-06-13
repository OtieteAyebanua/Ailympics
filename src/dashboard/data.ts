export interface Player {
  id: number;
  name: string;
  pos: string;
  sport: 'football';
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
  { id: 3, name: 'D. Mensah',   pos: 'CB',      sport: 'football', ovr: 82, rare: 'Rare',      price: '1.4', usd: '$3,780',  icon: false, stats: [{ label: 'PAC', val: 75 }, { label: 'SHO', val: 48 }, { label: 'PAS', val: 78 }] },
  { id: 4, name: 'R. Petrov',   pos: 'GK',      sport: 'football', ovr: 85, rare: 'Epic',      price: '3.0', usd: '$8,100',  icon: false, stats: [{ label: 'REF', val: 89 }, { label: 'POS', val: 86 }, { label: 'KIC', val: 72 }] },
  { id: 5, name: 'T. Osei',     pos: 'LW',      sport: 'football', ovr: 87, rare: 'Epic',      price: '3.5', usd: '$9,450',  icon: false, stats: [{ label: 'PAC', val: 94 }, { label: 'SHO', val: 82 }, { label: 'DRI', val: 90 }] },
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

export interface GameResult {
  id: number;
  opponent: string;
  league: string;
  result: 'W' | 'L' | 'D';
  score: string;
  earnings: string;
  date: string;
}

export const gameHistory: GameResult[] = [
  { id: 1, opponent: 'Nova FC',      league: 'Ailympics Premier · Football', result: 'W', score: '3–1', earnings: '+Ξ 2.8', date: 'Jun 12' },
  { id: 2, opponent: 'Titan United', league: 'Ailympics Premier · Football', result: 'W', score: '2–0', earnings: '+Ξ 2.1', date: 'Jun 10' },
  { id: 3, opponent: 'Ironside',     league: 'Division 2 · Football',        result: 'D', score: '1–1', earnings: '+Ξ 0.5', date: 'Jun 8'  },
  { id: 4, opponent: 'Storm City',   league: 'Division 2 · Football',        result: 'W', score: '4–2', earnings: '+Ξ 3.0', date: 'Jun 6'  },
  { id: 5, opponent: 'Apex FC',      league: 'Division 2 · Football',        result: 'L', score: '0–1', earnings: '−Ξ 1.2', date: 'Jun 4'  },
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
  { id: 2, league: 'Division 2 · Football',        live: true,  home: 'STR',  homeFull: 'Storm City',  away: 'IRON',  awayFull: 'Ironside',     odds: [2.4, 3.1, 2.5] },
  { id: 3, league: 'Ailympics Cup · Football',     live: false, home: 'APEX', homeFull: 'Apex FC',     away: 'NOVA',  awayFull: 'Nova FC',      odds: [1.9, 3.2, 3.1] },
];
