import { supabase } from './supabase';
import { getSessionWallet } from './auth';
import type { DbSimMatch, DbMatchEvent, MatchTrigger } from '../models/models';

export type { DbSimMatch, DbMatchEvent };

const SIMULATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-match`;

// ── Match lifecycle ────────────────────────────────────────────────────────────

export async function createSimMatch(
  awayWallet: string | null,
  trigger: MatchTrigger = 'on_demand',
): Promise<DbSimMatch | null> {
  const homeWallet = getSessionWallet();
  if (!homeWallet) return null;

  const { data, error } = await supabase
    .from('sim_matches')
    .insert({ home_wallet: homeWallet, away_wallet: awayWallet, trigger })
    .select()
    .single();

  if (error) { console.error('[matchRoom] createSimMatch:', error.message); return null; }
  return data as DbSimMatch;
}

/**
 * Run a simulation and await all events.
 * The edge function generates every event, stores them in the DB,
 * then returns them all in a single response. No streaming needed.
 */
export async function runSimulation(
  matchId: string,
): Promise<{ ok: boolean; events?: DbMatchEvent[]; error?: string }> {
  const token  = localStorage.getItem('ailympics_jwt');
  const wallet = getSessionWallet();

  let lineup: number[] = [];
  try {
    const raw = localStorage.getItem(`ailympics_starting5_${wallet ?? 'guest'}`);
    lineup = raw ? (JSON.parse(raw) as number[]) : [];
  } catch { /* ignore */ }

  let res: Response;
  try {
    res = await fetch(SIMULATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ match_id: matchId, lineup: lineup.length ? lineup : undefined }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }

  const data = await res.json() as { ok?: boolean; events?: DbMatchEvent[]; error?: string };
  if (!data.ok) return { ok: false, error: data.error ?? 'Simulation failed' };
  return { ok: true, events: data.events ?? [] };
}

/** Fetch all stored events for a finished match (for replay). */
export async function fetchMatchEvents(matchId: string): Promise<DbMatchEvent[]> {
  const { data, error } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', matchId)
    .order('seq', { ascending: true });

  if (error) { console.error('[matchRoom] fetchMatchEvents:', error.message); return []; }
  return (data ?? []) as DbMatchEvent[];
}

export async function getSimMatch(matchId: string): Promise<DbSimMatch | null> {
  const { data, error } = await supabase
    .from('sim_matches').select().eq('id', matchId).single();

  if (error) { console.error('[matchRoom] getSimMatch:', error.message); return null; }
  return data as DbSimMatch;
}

export interface LeaderboardEntry {
  wallet: string;
  wins: number; losses: number; draws: number;
  gf: number; ga: number; gd: number;
  played: number;
}

export async function fetchLeaderboard(limit = 500): Promise<LeaderboardEntry[]> {
  const { data } = await supabase
    .from('sim_matches')
    .select('home_wallet, away_wallet, home_score, away_score')
    .eq('status', 'finished')
    .limit(limit);

  const map = new Map<string, { wins: number; losses: number; draws: number; gf: number; ga: number }>();
  const get = (w: string) => map.get(w) ?? { wins: 0, losses: 0, draws: 0, gf: 0, ga: 0 };

  for (const m of (data ?? []) as { home_wallet: string; away_wallet: string | null; home_score: number; away_score: number }[]) {
    const hs = m.home_score ?? 0;
    const as_ = m.away_score ?? 0;

    const home = get(m.home_wallet);
    if (hs > as_) home.wins++; else if (hs < as_) home.losses++; else home.draws++;
    home.gf += hs; home.ga += as_;
    map.set(m.home_wallet, home);

    if (m.away_wallet) {
      const away = get(m.away_wallet);
      if (as_ > hs) away.wins++; else if (as_ < hs) away.losses++; else away.draws++;
      away.gf += as_; away.ga += hs;
      map.set(m.away_wallet, away);
    }
  }

  return Array.from(map.entries())
    .map(([wallet, s]) => ({ wallet, ...s, gd: s.gf - s.ga, played: s.wins + s.losses + s.draws }))
    .sort((a, b) => b.wins - a.wins || b.gd - a.gd);
}

export async function listMyMatches(limit = 20): Promise<DbSimMatch[]> {
  const wallet = getSessionWallet();
  if (!wallet) return [];

  const { data } = await supabase
    .from('sim_matches')
    .select()
    .or(`home_wallet.eq.${wallet},away_wallet.eq.${wallet}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as DbSimMatch[];
}
