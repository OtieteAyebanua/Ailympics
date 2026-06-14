import { supabase } from './supabase';
import { getSessionWallet } from './auth';
import {
  type DbStrategy,
  type Formation,
  type Mentality,
  type Pressing,
  type Tempo,
} from '../models/models';
import { pitchPctToWorld, type WorldPos } from './pitchUtils';

export type { Formation, Mentality, Pressing, Tempo };

// ── Types ──────────────────────────────────────────────────────────────────────

/** One player's position as stored in the DB (2D % only, no world coords). */
export interface RawPlayerPosition {
  id:  number;
  num: number;
  x:   number;   // retro-pitch % left→right  (0–100)
  y:   number;   // retro-pitch % top→bottom  (0–100)
}

/** Player position as used in the app — includes pre-computed 3D world coords. */
export interface StrategyPlayerPosition extends RawPlayerPosition {
  world: WorldPos;
}

/** Full strategy state used throughout the app. */
export interface StrategyState {
  formation:       Formation;
  mentality:       Mentality;
  pressing:        Pressing;
  tempo:           Tempo;
  playerPositions: StrategyPlayerPosition[];
  updatedAt?:      string;   // ISO timestamp from DB — undefined if never saved
}

/**
 * Minimal payload sent to the AI simulation edge function.
 * Includes only what the model needs — no UI-only fields.
 */
export interface MatchStrategyPayload {
  formation: Formation;
  mentality: Mentality;
  pressing:  Pressing;
  tempo:     Tempo;
  spawns: {
    id:    number;
    num:   number;
    world: WorldPos;   // 3D spawn position at kick-off
  }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function enrichPositions(raw: RawPlayerPosition[]): StrategyPlayerPosition[] {
  return raw.map(p => ({ ...p, world: pitchPctToWorld(p.x, p.y) }));
}

function toMatchPayload(state: StrategyState): MatchStrategyPayload {
  return {
    formation: state.formation,
    mentality: state.mentality,
    pressing:  state.pressing,
    tempo:     state.tempo,
    spawns:    state.playerPositions.map(({ id, num, world }) => ({ id, num, world })),
  };
}

// ── Read ───────────────────────────────────────────────────────────────────────

/** Load the current user's saved strategy, or null if none saved yet. */
export async function loadStrategy(): Promise<StrategyState | null> {
  const wallet = getSessionWallet();
  if (!wallet) return null;

  const { data, error } = await supabase
    .from('user_strategies')
    .select('*')
    .eq('user_wallet', wallet)
    .maybeSingle();

  if (error) {
    console.error('[strategy] loadStrategy:', error.message);
    return null;
  }
  if (!data) return null;

  const s = data as DbStrategy;
  return {
    formation:       s.formation,
    mentality:       s.mentality,
    pressing:        s.pressing,
    tempo:           s.tempo,
    playerPositions: enrichPositions(s.player_positions ?? []),
    updatedAt:       s.updated_at,
  };
}

/**
 * Load the strategy for any wallet — used by the match simulation service
 * to fetch both home and away team strategies.
 * Falls back to default values if the user hasn't saved a strategy yet.
 */
export async function loadStrategyForWallet(wallet: string): Promise<MatchStrategyPayload | null> {
  const { data, error } = await supabase
    .from('user_strategies')
    .select('*')
    .eq('user_wallet', wallet)
    .maybeSingle();

  if (error) return null;
  if (!data) return null;

  const s = data as DbStrategy;
  const state: StrategyState = {
    formation:       s.formation,
    mentality:       s.mentality,
    pressing:        s.pressing,
    tempo:           s.tempo,
    playerPositions: enrichPositions(s.player_positions ?? []),
  };

  return toMatchPayload(state);
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Upsert the current user's strategy.
 * World coords are stripped before storage — they're re-computed on load.
 * Returns null on success, or an error string.
 */
export async function saveStrategy(state: StrategyState): Promise<string | null> {
  const wallet = getSessionWallet();
  if (!wallet) return 'Not signed in';

  // Strip world coords — they're derived, not stored
  const rawPositions: RawPlayerPosition[] = state.playerPositions.map(
    ({ world: _w, ...rest }) => rest,
  );

  const { error } = await supabase
    .from('user_strategies')
    .upsert(
      {
        user_wallet:      wallet,
        formation:        state.formation,
        mentality:        state.mentality,
        pressing:         state.pressing,
        tempo:            state.tempo,
        player_positions: rawPositions,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'user_wallet' },
    );

  return error ? error.message : null;
}
