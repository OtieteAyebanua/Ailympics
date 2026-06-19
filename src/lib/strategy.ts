import { apiGet, apiPut } from './api';
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
  updatedAt?:      string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function enrichPositions(raw: RawPlayerPosition[]): StrategyPlayerPosition[] {
  return raw.map(p => ({ ...p, world: pitchPctToWorld(p.x, p.y) }));
}

// ── Read ───────────────────────────────────────────────────────────────────────

/** Load the current user's saved strategy, or null if none saved yet. */
export async function loadStrategy(): Promise<StrategyState | null> {
  if (!getSessionWallet()) return null;
  try {
    const s = await apiGet<DbStrategy | null>('/api/strategy');
    if (!s) return null;
    return {
      formation:       s.formation,
      mentality:       s.mentality,
      pressing:        s.pressing,
      tempo:           s.tempo,
      playerPositions: enrichPositions(s.player_positions ?? []),
      updatedAt:       s.updated_at,
    };
  } catch {
    return null;
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Upsert the current user's strategy. World coords are stripped before storage
 * (re-computed on load). Returns null on success, or an error string.
 */
export async function saveStrategy(state: StrategyState): Promise<string | null> {
  if (!getSessionWallet()) return 'Not signed in';
  const rawPositions: RawPlayerPosition[] = state.playerPositions.map(
    ({ world: _w, ...rest }) => rest,
  );
  try {
    await apiPut('/api/strategy', {
      formation:        state.formation,
      mentality:        state.mentality,
      pressing:         state.pressing,
      tempo:            state.tempo,
      player_positions: rawPositions,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Save failed';
  }
}
