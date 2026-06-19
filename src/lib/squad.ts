import { apiGet, apiPost } from './api';
import { type OwnedPlayer } from '../models/models';
import { getSessionWallet } from './auth';

// Squad data — now served by the Next.js API (was Supabase). Public signatures
// are unchanged so useSquad and the dashboard keep working as-is.

/** All active players in the current user's squad, with training boosts merged. */
export async function getUserSquad(): Promise<OwnedPlayer[]> {
  if (!getSessionWallet()) return [];
  return apiGet<OwnedPlayer[]>('/api/squad');
}

/** Active squad count and the user's squad limit, or null if not signed in. */
export async function getSquadInfo(): Promise<{ count: number; limit: number } | null> {
  if (!getSessionWallet()) return null;
  try {
    return await apiGet<{ count: number; limit: number }>('/api/squad/info');
  } catch {
    return null;
  }
}

/**
 * Releases (soft-deletes) a cloned player. Returns null on success, or an error
 * string. NFT players can't be released.
 */
export async function releasePlayer(userPlayerId: string): Promise<string | null> {
  if (!getSessionWallet()) return 'Not signed in';
  try {
    await apiPost('/api/squad/release', { userPlayerId });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Release failed';
  }
}
