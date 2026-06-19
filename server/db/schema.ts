/**
 * Drizzle SQLite schema — ported from supabase/migrations/0001_initial.sql.
 *
 * JS property names are snake_case to match the column names AND the frontend's
 * existing model types (DbPlayer/DbUserPlayer/… in src/models/models.ts), so
 * query results are drop-in compatible with what Supabase returned.
 *
 * Translation notes vs Postgres:
 *  • serial → integer pk autoincrement · uuid → text pk (crypto.randomUUID())
 *  • timestamptz → text ISO-8601 · numeric → real · boolean → integer{boolean}
 *  • jsonb → text{json} · enums → text{enum} · RLS → enforced in route handlers
 */
import { sql } from 'drizzle-orm';
import {
  sqliteTable, text, integer, real, check, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/sqlite-core';

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const PLAYER_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Icon'] as const;
export const ACQUISITION_SOURCES = ['clone', 'purchase', 'gift'] as const;
export const STAT_LABELS = [
  'pace', 'finishing', 'dribbling', 'stamina', 'passing', 'defending', 'physicality',
  'reflexes', 'positioning', 'kicking', 'handling', 'distribution',
] as const;
export const MATCH_STATUSES = ['upcoming', 'live', 'finished'] as const;
export const WAGER_OUTCOMES = ['Home', 'Draw', 'Away'] as const;
export const WAGER_STATUSES = ['pending', 'won', 'lost', 'void'] as const;

const uuidPk = () => text().primaryKey().$defaultFn(() => crypto.randomUUID());

// ── users ──────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  wallet_address:  text('wallet_address').primaryKey(),
  username:        text('username').unique(),
  avatar_url:      text('avatar_url'),
  training_points: integer('training_points').notNull().default(500),
  squad_limit:     integer('squad_limit').notNull().default(25),
  created_at:      text('created_at').notNull().default(nowIso),
});

// ── players ────────────────────────────────────────────────────────────────
export const players = sqliteTable('players', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  name:             text('name').notNull(),
  position:         text('position').notNull(),
  sport:            text('sport').notNull().default('football'),
  rarity:           text('rarity', { enum: PLAYER_RARITIES }).notNull(),
  base_ovr:         integer('base_ovr').notNull(),
  price_eth:        real('price_eth').notNull().default(0),
  is_icon:          integer('is_icon', { mode: 'boolean' }).notNull().default(false),
  is_nft:           integer('is_nft', { mode: 'boolean' }).notNull().default(false),
  is_trainable:     integer('is_trainable', { mode: 'boolean' }).notNull().default(false),
  is_cloneable:     integer('is_cloneable', { mode: 'boolean' }).notNull().default(false),
  token_id:         text('token_id'),
  contract_address: text('contract_address'),
  pace:             integer('pace'),
  finishing:        integer('finishing'),
  dribbling:        integer('dribbling'),
  stamina:          integer('stamina'),
  passing:          integer('passing'),
  defending:        integer('defending'),
  physicality:      integer('physicality'),
  reflexes:         integer('reflexes'),
  positioning:      integer('positioning'),
  kicking:          integer('kicking'),
  handling:         integer('handling'),
  distribution:     integer('distribution'),
}, (t) => [
  check('base_ovr_range', sql`${t.base_ovr} between 1 and 99`),
  check('nft_not_cloneable', sql`not (${t.is_nft} and ${t.is_cloneable})`),
  check('nft_not_trainable', sql`not (${t.is_nft} and ${t.is_trainable})`),
  check('cloneable_must_be_common', sql`not ${t.is_cloneable} or ${t.rarity} = 'Common'`),
  check('cloneable_must_be_trainable', sql`not ${t.is_cloneable} or ${t.is_trainable}`),
]);

// ── user_players ─────────────────────────────────────────────────────────────
export const user_players = sqliteTable('user_players', {
  id:                    uuidPk(),
  user_wallet:           text('user_wallet').notNull().references(() => users.wallet_address, { onDelete: 'cascade' }),
  player_id:             integer('player_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  source:                text('source', { enum: ACQUISITION_SOURCES }).notNull(),
  acquired_at:           text('acquired_at').notNull().default(nowIso),
  acquisition_price_eth: real('acquisition_price_eth'),
  tx_hash:               text('tx_hash'),
  deleted_at:            text('deleted_at'),
}, (t) => [
  uniqueIndex('user_players_active_unique').on(t.user_wallet, t.player_id).where(sql`${t.deleted_at} is null`),
  index('user_players_wallet_idx').on(t.user_wallet),
]);

// ── player_boosts ────────────────────────────────────────────────────────────
export const player_boosts = sqliteTable('player_boosts', {
  id:          uuidPk(),
  user_wallet: text('user_wallet').notNull().references(() => users.wallet_address, { onDelete: 'cascade' }),
  player_id:   integer('player_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  stat_label:  text('stat_label', { enum: STAT_LABELS }).notNull(),
  boost:       integer('boost').notNull().default(0),
  updated_at:  text('updated_at').notNull().default(nowIso),
}, (t) => [
  uniqueIndex('player_boosts_unique').on(t.user_wallet, t.player_id, t.stat_label),
  check('boost_non_negative', sql`${t.boost} >= 0`),
]);

// ── training_sessions ────────────────────────────────────────────────────────
export const training_sessions = sqliteTable('training_sessions', {
  id:           uuidPk(),
  user_wallet:  text('user_wallet').notNull().references(() => users.wallet_address, { onDelete: 'cascade' }),
  player_id:    integer('player_id').notNull().references(() => players.id, { onDelete: 'restrict' }),
  points_spent: integer('points_spent').notNull(),
  allocations:  text('allocations', { mode: 'json' }).notNull().$type<Partial<Record<typeof STAT_LABELS[number], number>>>().default({}),
  improved:     integer('improved', { mode: 'boolean' }).notNull().default(false),
  cost_eth:     real('cost_eth').notNull(),
  created_at:   text('created_at').notNull().default(nowIso),
}, (t) => [
  check('points_spent_positive', sql`${t.points_spent} > 0`),
  index('training_sessions_idx').on(t.user_wallet, t.player_id),
]);

// ── user_strategies ──────────────────────────────────────────────────────────
export const user_strategies = sqliteTable('user_strategies', {
  user_wallet:      text('user_wallet').primaryKey().references(() => users.wallet_address, { onDelete: 'cascade' }),
  formation:        text('formation').notNull(),
  mentality:        text('mentality').notNull(),
  pressing:         text('pressing').notNull(),
  tempo:            text('tempo').notNull(),
  player_positions: text('player_positions', { mode: 'json' }).notNull().$type<{ id: number; x: number; y: number; num: number }[]>().default([]),
  updated_at:       text('updated_at').notNull().default(nowIso),
});

// ── matches (stub) ───────────────────────────────────────────────────────────
export const matches = sqliteTable('matches', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  league:     text('league').notNull(),
  home_team:  text('home_team').notNull(),
  away_team:  text('away_team').notNull(),
  home_score: integer('home_score'),
  away_score: integer('away_score'),
  status:     text('status', { enum: MATCH_STATUSES }).notNull().default('upcoming'),
  kickoff_at: text('kickoff_at'),
  minute:     integer('minute'),
  home_odds:  real('home_odds').notNull(),
  draw_odds:  real('draw_odds'),
  away_odds:  real('away_odds').notNull(),
}, (t) => [index('matches_status_idx').on(t.status)]);

// ── wagers (stub) ────────────────────────────────────────────────────────────
export const wagers = sqliteTable('wagers', {
  id:                   uuidPk(),
  user_wallet:          text('user_wallet').notNull().references(() => users.wallet_address, { onDelete: 'cascade' }),
  match_id:             integer('match_id').notNull().references(() => matches.id, { onDelete: 'restrict' }),
  outcome:              text('outcome', { enum: WAGER_OUTCOMES }).notNull(),
  odds:                 real('odds').notNull(),
  stake_eth:            real('stake_eth').notNull(),
  potential_payout_eth: real('potential_payout_eth').notNull(),
  status:               text('status', { enum: WAGER_STATUSES }).notNull().default('pending'),
  settled_at:           text('settled_at'),
  created_at:           text('created_at').notNull().default(nowIso),
}, (t) => [
  check('stake_positive', sql`${t.stake_eth} > 0`),
  index('wagers_wallet_idx').on(t.user_wallet),
]);

// ── manager_stats (stub) ─────────────────────────────────────────────────────
export const manager_stats = sqliteTable('manager_stats', {
  user_wallet:         text('user_wallet').notNull().references(() => users.wallet_address, { onDelete: 'cascade' }),
  season:              integer('season').notNull().default(1),
  wins:                integer('wins').notNull().default(0),
  losses:              integer('losses').notNull().default(0),
  draws:               integer('draws').notNull().default(0),
  total_winnings_eth:  real('total_winnings_eth').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.user_wallet, t.season] })]);
