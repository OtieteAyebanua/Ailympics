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
  { id: 1,  name: 'M. Okafor',    pos: 'ST',  sport: 'football', ovr: 88, rare: 'Legendary', price: '4.2', usd: '$11,340', icon: false, stats: [{ label: 'PAC', val: 91 }, { label: 'SHO', val: 88 }, { label: 'PAS', val: 74 }] },
  { id: 2,  name: 'L. Sørensen',  pos: 'CM',  sport: 'football', ovr: 84, rare: 'Epic',      price: '2.1', usd: '$5,670',  icon: false, stats: [{ label: 'PAC', val: 79 }, { label: 'SHO', val: 72 }, { label: 'PAS', val: 90 }] },
  { id: 3,  name: 'D. Mensah',    pos: 'CB',  sport: 'football', ovr: 82, rare: 'Rare',      price: '1.4', usd: '$3,780',  icon: false, stats: [{ label: 'PAC', val: 75 }, { label: 'SHO', val: 48 }, { label: 'PAS', val: 78 }] },
  { id: 4,  name: 'R. Petrov',    pos: 'GK',  sport: 'football', ovr: 85, rare: 'Epic',      price: '3.0', usd: '$8,100',  icon: false, stats: [{ label: 'REF', val: 89 }, { label: 'POS', val: 86 }, { label: 'KIC', val: 72 }] },
  { id: 5,  name: 'T. Osei',      pos: 'LW',  sport: 'football', ovr: 87, rare: 'Epic',      price: '3.5', usd: '$9,450',  icon: false, stats: [{ label: 'PAC', val: 94 }, { label: 'SHO', val: 82 }, { label: 'DRI', val: 90 }] },
  { id: 6,  name: 'C. Ferreira',  pos: 'CAM', sport: 'football', ovr: 83, rare: 'Rare',      price: '1.8', usd: '$4,860',  icon: false, stats: [{ label: 'PAC', val: 78 }, { label: 'SHO', val: 80 }, { label: 'PAS', val: 88 }] },
  { id: 7,  name: 'A. Diallo',    pos: 'CDM', sport: 'football', ovr: 86, rare: 'Epic',      price: '2.8', usd: '$7,560',  icon: false, stats: [{ label: 'PAC', val: 80 }, { label: 'DEF', val: 87 }, { label: 'PAS', val: 76 }] },
  { id: 8,  name: 'K. Nakamura',  pos: 'RW',  sport: 'football', ovr: 90, rare: 'Legendary', price: '5.1', usd: '$13,770', icon: false, stats: [{ label: 'PAC', val: 96 }, { label: 'SHO', val: 85 }, { label: 'DRI', val: 93 }] },
  { id: 9,  name: 'E. Hartmann',  pos: 'CB',  sport: 'football', ovr: 81, rare: 'Rare',      price: '1.2', usd: '$3,240',  icon: false, stats: [{ label: 'PAC', val: 68 }, { label: 'DEF', val: 84 }, { label: 'PHY', val: 88 }] },
  { id: 10, name: 'J. Mbeki',     pos: 'ST',  sport: 'football', ovr: 93, rare: 'Icon',      price: '9.8', usd: '$26,460', icon: true,  stats: [{ label: 'PAC', val: 90 }, { label: 'SHO', val: 95 }, { label: 'DRI', val: 88 }] },
  { id: 11, name: 'P. Volkov',    pos: 'LB',  sport: 'football', ovr: 80, rare: 'Common',    price: '0.8', usd: '$2,160',  icon: false, stats: [{ label: 'PAC', val: 82 }, { label: 'DEF', val: 79 }, { label: 'PAS', val: 72 }] },
  { id: 12, name: 'S. Al-Rashid', pos: 'CM',  sport: 'football', ovr: 85, rare: 'Epic',      price: '2.4', usd: '$6,480',  icon: false, stats: [{ label: 'PAC', val: 76 }, { label: 'SHO', val: 74 }, { label: 'PAS', val: 91 }] },
  { id: 13, name: 'F. Andersen',  pos: 'RB',  sport: 'football', ovr: 79, rare: 'Common',    price: '0.7', usd: '$1,890',  icon: false, stats: [{ label: 'PAC', val: 84 }, { label: 'DEF', val: 77 }, { label: 'PAS', val: 68 }] },
  { id: 14, name: 'O. Adeyemi',   pos: 'CF',  sport: 'football', ovr: 89, rare: 'Legendary', price: '4.7', usd: '$12,690', icon: false, stats: [{ label: 'PAC', val: 88 }, { label: 'SHO', val: 91 }, { label: 'DRI', val: 86 }] },
  { id: 15, name: 'V. Rossi',     pos: 'GK',  sport: 'football', ovr: 83, rare: 'Rare',      price: '1.6', usd: '$4,320',  icon: false, stats: [{ label: 'REF', val: 85 }, { label: 'POS', val: 82 }, { label: 'KIC', val: 68 }] },
  { id: 16, name: 'B. Traoré',    pos: 'LW',  sport: 'football', ovr: 84, rare: 'Epic',      price: '2.2', usd: '$5,940',  icon: false, stats: [{ label: 'PAC', val: 93 }, { label: 'SHO', val: 78 }, { label: 'DRI', val: 88 }] },
  { id: 17, name: 'H. Park',      pos: 'CDM', sport: 'football', ovr: 82, rare: 'Rare',      price: '1.5', usd: '$4,050',  icon: false, stats: [{ label: 'PAC', val: 74 }, { label: 'DEF', val: 83 }, { label: 'PHY', val: 85 }] },
  { id: 18, name: 'G. Santos',    pos: 'CAM', sport: 'football', ovr: 86, rare: 'Epic',      price: '2.9', usd: '$7,830',  icon: false, stats: [{ label: 'PAC', val: 80 }, { label: 'SHO', val: 83 }, { label: 'PAS', val: 89 }] },
  { id: 19, name: 'N. Čović',     pos: 'CB',  sport: 'football', ovr: 84, rare: 'Rare',      price: '1.9', usd: '$5,130',  icon: false, stats: [{ label: 'PAC', val: 71 }, { label: 'DEF', val: 86 }, { label: 'PHY', val: 87 }] },
  { id: 20, name: 'I. Kone',      pos: 'ST',  sport: 'football', ovr: 91, rare: 'Legendary', price: '6.3', usd: '$17,010', icon: false, stats: [{ label: 'PAC', val: 87 }, { label: 'SHO', val: 92 }, { label: 'PHY', val: 84 }] },
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
  score?: { home: number; away: number };
  minute?: number;
  kickoff?: string;
}

export const matches: MatchData[] = [
  { id: 1, league: 'Ailympics Premier · Football', live: true,  home: 'NOVA', homeFull: 'Nova FC',    away: 'TITAN', awayFull: 'Titan United', odds: [2.1, 3.4, 2.8], score: { home: 1, away: 0 }, minute: 67 },
  { id: 2, league: 'Division 2 · Football',        live: true,  home: 'STR',  homeFull: 'Storm City', away: 'IRON',  awayFull: 'Ironside',     odds: [2.4, 3.1, 2.5], score: { home: 2, away: 2 }, minute: 43 },
  { id: 3, league: 'Ailympics Cup · Football',     live: false, home: 'APEX', homeFull: 'Apex FC',    away: 'NOVA',  awayFull: 'Nova FC',      odds: [1.9, 3.2, 3.1], kickoff: 'Tomorrow 19:00' },
];
