// ── Enums / union types ────────────────────────────────────────────────────

export type PlayerRarity    = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Icon';
export type MatchStatus     = 'upcoming' | 'live' | 'finished';
export type WagerOutcome    = 'Home' | 'Draw' | 'Away';
export type WagerStatus     = 'pending' | 'won' | 'lost' | 'void';

// How a player row ended up in user_players:
//   clone    — user cloned a free Common template from the marketplace
//   purchase — user bought an NFT player on-chain via Celo
//   gift     — granted by admin (e.g. onboarding bonus)
export type AcquisitionSource = 'clone' | 'purchase' | 'gift';

// ── Raw DB row types (mirror database table columns exactly) ──────────────

export interface DbUser {
  wallet_address: string;       // PK — lowercase hex wallet address
  username: string | null;
  avatar_url: string | null;    // profile picture; UI falls back to truncated wallet if null
  training_points: number;      // shared pool consumed by trainable-player sessions
  squad_limit: number;          // max active players allowed (default 25); blocks cloning when full
  created_at: string;
}

export interface DbPlayer {
  id: number;
  name: string;
  position: string;             // ST | CM | GK | LW | RW | CB | LB | RB | CDM | CAM | CF
  sport: string;                // 'football' — extend as more sports are added
  rarity: PlayerRarity;
  base_ovr: number;
  price_eth: number;
  is_icon: boolean;
  is_nft: boolean;              // admin-minted; buyable & sellable on Celo — NOT trainable, NOT cloneable (1-of-1)
  is_trainable: boolean;        // trainable by the owning user — NOT sellable
  is_cloneable: boolean;         // true only for Common non-NFT templates; users clone these for free at registration
  token_id: string | null;      // on-chain NFT token ID (is_nft only)
  contract_address: string | null;

  // Rule enforced at DB level:
  //   is_nft=true  → is_cloneable=false, is_trainable=false
  //   is_cloneable=true → is_nft=false,  is_trainable=true, rarity='Common'

  // Outfield stats (null for GK)
  pace: number | null;
  finishing: number | null;
  dribbling: number | null;
  stamina: number | null;
  passing: number | null;
  defending: number | null;
  physicality: number | null;

  // Goalkeeper stats (null for outfield players)
  reflexes: number | null;
  positioning: number | null;
  kicking: number | null;
  handling: number | null;
  distribution: number | null;
}

// DB constraints:
//   UNIQUE(user_wallet, player_id) WHERE deleted_at IS NULL  — clone-once guard (only one active copy)
//   deleted_at may only be set when the linked player has is_nft = false (clones only, never sellable NFTs)
//
// Clone flow:  check squad count < squad_limit  →  check no active row for this player  →  INSERT
// Delete flow: check player.is_nft = false  →  SET deleted_at = now()  (soft delete, history preserved)
export interface DbUserPlayer {
  id: string;                   // uuid
  user_wallet: string;          // FK → users.wallet_address
  player_id: number;            // FK → players.id — UNIQUE (with user_wallet) when active
  source: AcquisitionSource;    // how this player was added to the user's squad
  acquired_at: string;
  acquisition_price_eth: number | null;  // null for clones and gifts
  tx_hash: string | null;       // Celo transaction hash (purchase only)
  deleted_at: string | null;    // set when user releases a clone; null = active in squad
}

// Stat columns that can receive training boosts
export type StatLabel =
  | 'pace' | 'finishing' | 'dribbling' | 'stamina' | 'passing' | 'defending' | 'physicality'
  | 'reflexes' | 'positioning' | 'kicking' | 'handling' | 'distribution';

// Training boosts accumulate per (user, player, stat). Only applies to trainable players.
export interface DbPlayerBoost {
  id: string;                   // uuid
  user_wallet: string;          // FK → users.wallet_address
  player_id: number;            // FK → players.id
  stat_label: StatLabel;
  boost: number;                // additive — effective value = players.{stat} + boost
  updated_at: string;           // last time this stat was boosted — used for "Last trained X ago" UI
}

// ── Strategy ──────────────────────────────────────────────────────────────

export type Formation  = '433' | '442' | '352' | '532' | '4231';
export type Mentality  = 'defensive' | 'balanced' | 'attacking';
export type Pressing   = 'low_block' | 'mid_press' | 'high_press' | 'gegenpressing';
export type Tempo      = 'slow' | 'normal' | 'direct' | 'fast';

export interface DbStrategy {
  user_wallet:       string;
  formation:         Formation;
  mentality:         Mentality;
  pressing:          Pressing;
  tempo:             Tempo;
  player_positions:  { id: number; x: number; y: number; num: number }[];
  updated_at:        string;
}

export interface DbTrainingSession {
  id: string;                   // uuid
  user_wallet: string;
  player_id: number;
  points_spent: number;
  allocations: Partial<Record<StatLabel, number>>; // e.g. { pace: 20, finishing: 10 }
  improved: boolean;
  cost_eth: number;
  created_at: string;
}

export interface DbMatch {
  id: number;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  kickoff_at: string | null;
  minute: number | null;
  home_odds: number;
  draw_odds: number | null;     // null for sports without draws (e.g. basketball)
  away_odds: number;
}

export interface DbWager {
  id: string;                   // uuid
  user_wallet: string;          // FK → users.wallet_address
  match_id: number;             // FK → matches.id
  outcome: WagerOutcome;
  odds: number;
  stake_eth: number;
  potential_payout_eth: number;
  status: WagerStatus;
  settled_at: string | null;
  created_at: string;
}

// One row per (user, season). Updated when wagers are settled.
// ── Simulation matches ────────────────────────────────────────────────────

export type SimMatchStatus = 'pending' | 'live' | 'finished';
export type MatchTrigger   = 'on_demand' | 'tournament';

/** A user-vs-user (or user-vs-AI) simulation match. */
export interface DbSimMatch {
  id:          string;
  home_wallet: string;
  away_wallet: string | null;   // null = AI opponent
  status:      SimMatchStatus;
  home_score:  number;
  away_score:  number;
  trigger:     MatchTrigger;
  kickoff_at:  string | null;
  finished_at: string | null;
  created_at:  string;
}

export type MatchEventType =
  | 'kickoff' | 'pass' | 'shot' | 'goal' | 'foul'
  | 'save' | 'tackle' | 'full_time' | 'tick';

/** Player entry inside the kickoff formation payload. */
export interface FormationPlayer {
  id:   number;
  team: 'home' | 'away';
  num:  number;
  pos:  string;   // GK | CB | LB | RB | CM | CDM | CAM | LW | RW | ST | CF
  x:    number;   // world X at kickoff
  z:    number;   // world Z at kickoff
  pace: number;   // effective pace (base + boost)
}

/**
 * Quadratic bezier trajectory for the ball.
 * Frontend interpolates: P(t) = (1-t)²·start + 2(1-t)t·peak + t²·end
 */
export interface BezierBall {
  sx: number; sy: number; sz: number;  // start position
  px: number; py: number; pz: number;  // peak (control point — arc apex)
  ex: number; ey: number; ez: number;  // end position
}

/** A player that actively moves during an event. */
export interface PlayerMover {
  id: number;
  fx: number; fz: number;  // from position (world X/Z)
  tx: number; tz: number;  // to position (world X/Z)
}

/**
 * Animation-driven payload — AI supplies full trajectory data per event.
 * Frontend plays back as pure bezier animation; no physics engine needed.
 */
export interface MatchEventPayload {
  narrative: string;
  // kickoff only
  formation?: FormationPlayer[];
  // all animated events
  duration?: number;       // seconds this event plays for
  ball?: BezierBall;       // ball trajectory (absent for goal celebration, full_time)
  movers?: PlayerMover[];  // players that actively move during this event
  // pass
  from?: number; to?: number;
  // shot
  shooter?: number;
  // goal
  scorer?: number; assist?: number;
  // save
  keeper?: number;
  // tackle / foul
  tackler?: number; tackled?: number;
  fouler?:  number; fouled?:  number;
  // goal + full_time
  home_score?: number; away_score?: number;
}

export interface DbMatchEvent {
  id:         string;
  match_id:   string;
  seq:        number;
  t:          number;            // game time in seconds (0–5400)
  event_type: MatchEventType;
  payload:    MatchEventPayload;
  created_at: string;
}

// ── Manager stats ─────────────────────────────────────────────────────────

export interface DbManagerStat {
  user_wallet: string;          // FK → users.wallet_address
  season: number;
  wins: number;
  losses: number;
  draws: number;
  total_winnings_eth: number;
}

// ── App-layer types (enriched with joins) ─────────────────────────────────

// A player owned by the current user, with per-user training boosts applied.
// effectiveStat(name) = players.{name} + (boosts[name] ?? 0)
// Boosts are always 0 for NFT players — only trainable players accumulate them.
export interface OwnedPlayer extends DbPlayer {
  ownership: DbUserPlayer;
  boosts: Partial<Record<StatLabel, number>>;
}

export interface ManagerProfile extends DbUser {
  stats: DbManagerStat | null;
}
