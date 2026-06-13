-- ── Extensions ────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────

create type player_rarity      as enum ('Common', 'Rare', 'Epic', 'Legendary', 'Icon');
create type acquisition_source as enum ('clone', 'purchase', 'gift');
create type stat_label         as enum (
  'pace', 'finishing', 'dribbling', 'stamina', 'passing', 'defending', 'physicality',
  'reflexes', 'positioning', 'kicking', 'handling', 'distribution'
);

-- Stubs — expand when wager work begins
create type match_status  as enum ('upcoming', 'live', 'finished');
create type wager_outcome as enum ('Home', 'Draw', 'Away');
create type wager_status  as enum ('pending', 'won', 'lost', 'void');

-- ── users ──────────────────────────────────────────────────────────────────

create table users (
  wallet_address  text        primary key,               -- lowercase hex, e.g. 0xabc…
  username        text        unique,
  avatar_url      text,
  training_points integer     not null default 500,
  squad_limit     integer     not null default 25,       -- max active players; block clone when full
  created_at      timestamptz not null default now()
);

-- ── players ────────────────────────────────────────────────────────────────

create table players (
  id               serial      primary key,
  name             text        not null,
  position         text        not null,                 -- ST|CM|GK|LW|RW|CB|LB|RB|CDM|CAM|CF
  sport            text        not null default 'football',
  rarity           player_rarity not null,
  base_ovr         integer     not null check (base_ovr between 1 and 99),
  price_eth        numeric(12,4) not null default 0,     -- mint/list price; not live market value
  is_icon          boolean     not null default false,
  is_nft           boolean     not null default false,   -- 1-of-1; buyable & sellable on Celo
  is_trainable     boolean     not null default false,   -- can be trained; NOT sellable
  is_cloneable     boolean     not null default false,   -- free to clone at registration; Common only
  token_id         text,                                 -- on-chain NFT token id (is_nft rows only)
  contract_address text,

  -- Outfield stats (null for GK)
  pace             integer     check (pace        between 1 and 99),
  finishing        integer     check (finishing   between 1 and 99),
  dribbling        integer     check (dribbling   between 1 and 99),
  stamina          integer     check (stamina     between 1 and 99),
  passing          integer     check (passing     between 1 and 99),
  defending        integer     check (defending   between 1 and 99),
  physicality      integer     check (physicality between 1 and 99),

  -- Goalkeeper stats (null for outfield players)
  reflexes         integer     check (reflexes     between 1 and 99),
  positioning      integer     check (positioning  between 1 and 99),
  kicking          integer     check (kicking      between 1 and 99),
  handling         integer     check (handling     between 1 and 99),
  distribution     integer     check (distribution between 1 and 99),

  -- Flag consistency — enforced at DB level
  constraint nft_not_cloneable      check (not (is_nft and is_cloneable)),
  constraint nft_not_trainable      check (not (is_nft and is_trainable)),
  constraint cloneable_must_be_common     check (not is_cloneable or rarity = 'Common'),
  constraint cloneable_must_be_trainable  check (not is_cloneable or is_trainable)
);

-- ── user_players ───────────────────────────────────────────────────────────

create table user_players (
  id                    uuid        primary key default gen_random_uuid(),
  user_wallet           text        not null references users(wallet_address)  on delete cascade,
  player_id             integer     not null references players(id)            on delete restrict,
  source                acquisition_source not null,
  acquired_at           timestamptz not null default now(),
  acquisition_price_eth numeric(12,4),                  -- null for clones and gifts
  tx_hash               text,                            -- Celo tx hash (purchases only)
  deleted_at            timestamptz                      -- soft-delete; only allowed for non-NFT players
);

-- Clone-once guard: one active copy of each player per user
create unique index user_players_active_unique
  on user_players(user_wallet, player_id)
  where deleted_at is null;

-- ── player_boosts ──────────────────────────────────────────────────────────

create table player_boosts (
  id           uuid       primary key default gen_random_uuid(),
  user_wallet  text       not null references users(wallet_address) on delete cascade,
  player_id    integer    not null references players(id)           on delete restrict,
  stat_label   stat_label not null,
  boost        integer    not null default 0 check (boost >= 0),    -- additive on top of players.{stat}
  updated_at   timestamptz not null default now(),

  unique(user_wallet, player_id, stat_label)
);

-- ── training_sessions ──────────────────────────────────────────────────────

create table training_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_wallet   text        not null references users(wallet_address) on delete cascade,
  player_id     integer     not null references players(id)           on delete restrict,
  points_spent  integer     not null check (points_spent > 0),
  allocations   jsonb       not null default '{}',                    -- { "pace": 20, "finishing": 10 }
  improved      boolean     not null default false,
  cost_eth      numeric(12,4) not null,
  created_at    timestamptz not null default now()
);

-- ── matches (stub — expand when wager work begins) ────────────────────────

create table matches (
  id           serial        primary key,
  league       text          not null,
  home_team    text          not null,
  away_team    text          not null,
  home_score   integer,
  away_score   integer,
  status       match_status  not null default 'upcoming',
  kickoff_at   timestamptz,
  minute       integer,
  home_odds    numeric(6,2)  not null,
  draw_odds    numeric(6,2),
  away_odds    numeric(6,2)  not null
);

-- ── wagers (stub) ──────────────────────────────────────────────────────────

create table wagers (
  id                   uuid          primary key default gen_random_uuid(),
  user_wallet          text          not null references users(wallet_address) on delete cascade,
  match_id             integer       not null references matches(id)           on delete restrict,
  outcome              wager_outcome not null,
  odds                 numeric(6,2)  not null,
  stake_eth            numeric(12,4) not null check (stake_eth > 0),
  potential_payout_eth numeric(12,4) not null,
  status               wager_status  not null default 'pending',
  settled_at           timestamptz,
  created_at           timestamptz   not null default now()
);

-- ── manager_stats (stub) ───────────────────────────────────────────────────

create table manager_stats (
  user_wallet        text          not null references users(wallet_address) on delete cascade,
  season             integer       not null default 1,
  wins               integer       not null default 0,
  losses             integer       not null default 0,
  draws              integer       not null default 0,
  total_winnings_eth numeric(12,4) not null default 0,
  primary key (user_wallet, season)
);

-- ── Row Level Security ─────────────────────────────────────────────────────

alter table users             enable row level security;
alter table players           enable row level security;
alter table user_players      enable row level security;
alter table player_boosts     enable row level security;
alter table training_sessions enable row level security;
alter table matches           enable row level security;
alter table wagers            enable row level security;
alter table manager_stats     enable row level security;

-- users: each wallet sees and edits only its own row
create policy "users: select own"  on users for select using      (wallet_address = auth.jwt() ->> 'sub');
create policy "users: insert own"  on users for insert with check (wallet_address = auth.jwt() ->> 'sub');
create policy "users: update own"  on users for update using      (wallet_address = auth.jwt() ->> 'sub');

-- players: anyone can browse the catalog; only service-role can write
create policy "players: public read" on players for select using (true);

-- user_players: own rows only
create policy "user_players: select" on user_players for select using      (user_wallet = auth.jwt() ->> 'sub');
create policy "user_players: insert" on user_players for insert with check (user_wallet = auth.jwt() ->> 'sub');
create policy "user_players: update" on user_players for update using      (user_wallet = auth.jwt() ->> 'sub');

-- player_boosts: own rows only
create policy "player_boosts: select" on player_boosts for select using      (user_wallet = auth.jwt() ->> 'sub');
create policy "player_boosts: insert" on player_boosts for insert with check (user_wallet = auth.jwt() ->> 'sub');
create policy "player_boosts: update" on player_boosts for update using      (user_wallet = auth.jwt() ->> 'sub');

-- training_sessions: own rows only; no updates (sessions are immutable records)
create policy "training_sessions: select" on training_sessions for select using      (user_wallet = auth.jwt() ->> 'sub');
create policy "training_sessions: insert" on training_sessions for insert with check (user_wallet = auth.jwt() ->> 'sub');

-- matches: public read; service-role writes
create policy "matches: public read" on matches for select using (true);

-- wagers: own rows only
create policy "wagers: select" on wagers for select using      (user_wallet = auth.jwt() ->> 'sub');
create policy "wagers: insert" on wagers for insert with check (user_wallet = auth.jwt() ->> 'sub');

-- manager_stats: public read for leaderboard; service-role writes
create policy "manager_stats: public read" on manager_stats for select using (true);

-- ── Indexes ────────────────────────────────────────────────────────────────

create index on user_players      (user_wallet)             where deleted_at is null;
create index on player_boosts     (user_wallet, player_id);
create index on training_sessions (user_wallet, player_id);
create index on wagers            (user_wallet);
create index on matches           (status);
