import { supabase } from './supabase';
import { type DbPlayer } from '../models/models';
import { getSessionWallet } from './auth';

// ── Catalog queries (no auth required) ───────────────────────────────────────

/** All Common cloneable templates shown in the marketplace clone section. */
export async function getCloneablePlayers(): Promise<DbPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('is_cloneable', true)
    .order('base_ovr', { ascending: false });

  if (error) throw new Error(error.message);
  return data as DbPlayer[];
}

/** All admin-minted NFT players available to buy on-chain. */
export async function getNFTPlayers(): Promise<DbPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('is_nft', true)
    .order('base_ovr', { ascending: false });

  if (error) throw new Error(error.message);
  return data as DbPlayer[];
}

// ── Clone flow (requires auth) ────────────────────────────────────────────────

/**
 * Clones a free Common player into the current user's squad.
 *
 * Checks (in order):
 *   1. Player exists and is_cloneable
 *   2. User's active squad count < squad_limit
 *   3. User does not already own an active copy of this player
 *
 * Returns null on success, or an error string the UI can display.
 */
export async function clonePlayer(playerId: number): Promise<string | null> {
  const wallet = await getWallet();
  if (!wallet) return 'Not signed in — connect your wallet first';

  // 1. Verify the player is cloneable
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('id, is_cloneable')
    .eq('id', playerId)
    .single();

  if (playerErr || !player) return 'Player not found';
  if (!player.is_cloneable)  return 'This player cannot be cloned';

  // 2. Check squad limit
  const { count, error: countErr } = await supabase
    .from('user_players')
    .select('id', { count: 'exact', head: true })
    .eq('user_wallet', wallet)
    .is('deleted_at', null);

  if (countErr) return countErr.message;

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('squad_limit')
    .eq('wallet_address', wallet)
    .single();

  if (userErr || !user) return 'Could not load your profile';
  if ((count ?? 0) >= user.squad_limit) {
    return `Squad full — release a player to make room (limit: ${user.squad_limit})`;
  }

  // 3. Check not already owned (active)
  const { count: existing, error: existErr } = await supabase
    .from('user_players')
    .select('id', { count: 'exact', head: true })
    .eq('user_wallet', wallet)
    .eq('player_id', playerId)
    .is('deleted_at', null);

  if (existErr) return existErr.message;
  if ((existing ?? 0) > 0) return 'You already have this player in your squad';

  // 4. Insert clone record
  const { error: insertErr } = await supabase
    .from('user_players')
    .insert({
      user_wallet:           wallet,
      player_id:             playerId,
      source:                'clone',
      acquisition_price_eth: null,
      tx_hash:               null,
    });

  if (insertErr) return insertErr.message;
  return null;
}

// ── Record NFT purchase (called after on-chain tx confirms) ──────────────────

/**
 * Records a completed on-chain NFT purchase in the DB.
 * Call this after the Celo transaction is confirmed.
 */
export async function recordNFTPurchase(
  playerId: number,
  priceEth: number,
  txHash: string,
): Promise<string | null> {
  const wallet = await getWallet();
  if (!wallet) return 'Not signed in';

  const { error } = await supabase
    .from('user_players')
    .insert({
      user_wallet:           wallet,
      player_id:             playerId,
      source:                'purchase',
      acquisition_price_eth: priceEth,
      tx_hash:               txHash,
    });

  return error ? error.message : null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWallet(): string | null {
  return getSessionWallet();
}
