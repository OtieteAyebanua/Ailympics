import { supabase } from './supabase';
import { type OwnedPlayer, type DbPlayer, type DbPlayerBoost, type StatLabel } from '../models/models';
import { getSessionWallet } from './auth';

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns all active players in the current user's squad,
 * with their training boosts merged in.
 */
export async function getUserSquad(): Promise<OwnedPlayer[]> {
  const wallet = await getWallet();
  if (!wallet) return [];

  const { data, error } = await supabase
    .from('user_players')
    .select(`
      *,
      players (*)
    `)
    .eq('user_wallet', wallet)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  if (!data)  return [];

  // Boosts aren't FK-related to user_players (soft-delete breaks the unique
  // constraint PostgREST needs), so fetch them separately and merge by player_id.
  const boostsByPlayer = await getBoostsByPlayer(wallet);

  return data.map((row) => {
    const player = row.players as DbPlayer;
    const { players: _p, ...ownership } = row;

    return {
      ...player,
      ownership,
      boosts: boostsByPlayer.get(player.id) ?? {},
    } as OwnedPlayer;
  });
}

/** Fetches all of a user's boosts, grouped by player_id. */
async function getBoostsByPlayer(
  wallet: string,
): Promise<Map<number, Partial<Record<StatLabel, number>>>> {
  const { data } = await supabase
    .from('player_boosts')
    .select('player_id, stat_label, boost')
    .eq('user_wallet', wallet);

  const map = new Map<number, Partial<Record<StatLabel, number>>>();
  for (const b of (data ?? []) as Pick<DbPlayerBoost, 'player_id' | 'stat_label' | 'boost'>[]) {
    const entry = map.get(b.player_id) ?? {};
    entry[b.stat_label] = b.boost;
    map.set(b.player_id, entry);
  }
  return map;
}

/**
 * Returns a single owned player with boosts, or null if not found / not owned.
 */
export async function getOwnedPlayer(playerId: number): Promise<OwnedPlayer | null> {
  const wallet = await getWallet();
  if (!wallet) return null;

  const { data, error } = await supabase
    .from('user_players')
    .select(`
      *,
      players (*)
    `)
    .eq('user_wallet', wallet)
    .eq('player_id', playerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  const { data: boostRows } = await supabase
    .from('player_boosts')
    .select('stat_label, boost')
    .eq('user_wallet', wallet)
    .eq('player_id', playerId);

  const player  = data.players as DbPlayer;
  const boosts  = Object.fromEntries(
    ((boostRows ?? []) as Pick<DbPlayerBoost, 'stat_label' | 'boost'>[]).map((b) => [b.stat_label, b.boost]),
  ) as Partial<Record<StatLabel, number>>;
  const { players: _p, ...ownership } = data;

  return { ...player, ownership, boosts } as OwnedPlayer;
}

/**
 * Returns how many active players the user has and their squad limit.
 */
export async function getSquadInfo(): Promise<{ count: number; limit: number } | null> {
  const wallet = await getWallet();
  if (!wallet) return null;

  const [countResult, userResult] = await Promise.all([
    supabase
      .from('user_players')
      .select('id', { count: 'exact', head: true })
      .eq('user_wallet', wallet)
      .is('deleted_at', null),
    supabase
      .from('users')
      .select('squad_limit')
      .eq('wallet_address', wallet)
      .single(),
  ]);

  if (countResult.error || userResult.error || !userResult.data) return null;

  return {
    count: countResult.count ?? 0,
    limit: userResult.data.squad_limit,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Soft-deletes a cloned player, releasing their squad slot.
 * Blocked if the player is an NFT (sellable players can't be deleted).
 *
 * Returns null on success, or an error string.
 */
export async function releasePlayer(userPlayerId: string): Promise<string | null> {
  const wallet = await getWallet();
  if (!wallet) return 'Not signed in';

  // Fetch the row and verify ownership + non-NFT
  const { data: row, error: fetchErr } = await supabase
    .from('user_players')
    .select('id, player_id, players (is_nft)')
    .eq('id', userPlayerId)
    .eq('user_wallet', wallet)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !row) return 'Player not found in your squad';

  const player = row.players as { is_nft: boolean } | null;
  if (player?.is_nft) return 'NFT players cannot be released — sell them on the marketplace instead';

  // Soft-delete
  const { error: updateErr } = await supabase
    .from('user_players')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', userPlayerId)
    .eq('user_wallet', wallet);

  return updateErr ? updateErr.message : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWallet(): string | null {
  return getSessionWallet();
}
