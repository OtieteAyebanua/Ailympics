-- ── sim_matches ───────────────────────────────────────────────────────────────
-- One row per user-vs-user (or user-vs-AI) simulation match.
-- Distinct from the `matches` table, which holds real-world wager targets.

create type sim_match_status as enum ('pending', 'live', 'finished');
create type match_trigger    as enum ('on_demand', 'tournament');

create table sim_matches (
  id           uuid             primary key default gen_random_uuid(),
  home_wallet  text             not null references users(wallet_address),
  away_wallet  text                      references users(wallet_address), -- null = AI opponent
  status       sim_match_status not null default 'pending',
  home_score   integer          not null default 0,
  away_score   integer          not null default 0,
  trigger      match_trigger    not null default 'on_demand',
  kickoff_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz      not null default now()
);

create index idx_sim_matches_home   on sim_matches (home_wallet);
create index idx_sim_matches_away   on sim_matches (away_wallet);
create index idx_sim_matches_status on sim_matches (status);

alter table sim_matches enable row level security;

-- Any authenticated user can watch any match (spectator mode)
create policy "sim_matches: authenticated read" on sim_matches
  for select using (auth.role() = 'authenticated');

-- Only the home team player can kick off (insert) a match
create policy "sim_matches: home insert" on sim_matches
  for insert with check (
    home_wallet = auth.jwt() -> 'user_metadata' ->> 'wallet_address'
  );

-- Score and status are updated by the edge function (service role bypasses RLS)


-- ── match_events ──────────────────────────────────────────────────────────────
-- One row per simulated event. The edge function inserts here AND broadcasts
-- to the Realtime channel `match:{match_id}`. Late joiners replay from this
-- table, then continue from the live channel.

create table match_events (
  id          uuid        primary key default gen_random_uuid(),
  match_id    uuid        not null references sim_matches(id) on delete cascade,
  seq         integer     not null,         -- monotonic per match; used for de-dup by late joiners
  t           integer     not null,         -- game time in seconds (0 = kick-off)
  event_type  text        not null
                            check (event_type in (
                              'kickoff', 'pass', 'shot', 'goal', 'foul',
                              'save', 'tackle', 'full_time', 'tick'
                            )),
  payload     jsonb       not null,         -- ball pos, player positions, narrative, impulse, scorer
  created_at  timestamptz not null default now(),

  unique (match_id, seq)
);

create index idx_match_events_match on match_events (match_id, seq);

alter table match_events enable row level security;

-- Any authenticated user can read events (spectator support)
create policy "match_events: authenticated read" on match_events
  for select using (auth.role() = 'authenticated');

-- Only the service role (edge function) can insert events
