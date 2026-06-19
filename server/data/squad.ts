/**
 * Squad data access — server-side port of src/lib/squad.ts.
 * Every function is scoped to a wallet (the route handler supplies it from the
 * verified JWT), replacing the old Supabase RLS "own rows only" policies.
 */
import { and, eq, isNull, count } from 'drizzle-orm';
import { db } from '../db/client';
import { users, players, user_players, player_boosts } from '../db/schema';

/** All active squad players for a wallet, with training boosts merged in. */
export async function getUserSquad(wallet: string) {
  const rows = await db
    .select()
    .from(user_players)
    .innerJoin(players, eq(user_players.player_id, players.id))
    .where(and(eq(user_players.user_wallet, wallet), isNull(user_players.deleted_at)));

  const boosts = await db
    .select()
    .from(player_boosts)
    .where(eq(player_boosts.user_wallet, wallet));

  const boostsByPlayer = new Map<number, Record<string, number>>();
  for (const b of boosts) {
    const entry = boostsByPlayer.get(b.player_id) ?? {};
    entry[b.stat_label] = b.boost;
    boostsByPlayer.set(b.player_id, entry);
  }

  return rows.map((r) => ({
    ...r.players,
    ownership: r.user_players,
    boosts: boostsByPlayer.get(r.players.id) ?? {},
  }));
}

/** Active squad count + the wallet's squad limit. */
export async function getSquadInfo(wallet: string): Promise<{ count: number; limit: number }> {
  const [cnt] = await db
    .select({ c: count() })
    .from(user_players)
    .where(and(eq(user_players.user_wallet, wallet), isNull(user_players.deleted_at)));

  const user = await db
    .select({ limit: users.squad_limit })
    .from(users)
    .where(eq(users.wallet_address, wallet))
    .get();

  return { count: cnt?.c ?? 0, limit: user?.limit ?? 25 };
}

/** Soft-delete (release) a cloned player. Returns an error string, or null on success. */
export async function releasePlayer(wallet: string, userPlayerId: string): Promise<string | null> {
  const row = await db
    .select({ id: user_players.id, is_nft: players.is_nft })
    .from(user_players)
    .innerJoin(players, eq(user_players.player_id, players.id))
    .where(and(
      eq(user_players.id, userPlayerId),
      eq(user_players.user_wallet, wallet),
      isNull(user_players.deleted_at),
    ))
    .get();

  if (!row) return 'Player not found in your squad';
  if (row.is_nft) return 'NFT players cannot be released — sell them on the marketplace instead';

  await db
    .update(user_players)
    .set({ deleted_at: new Date().toISOString() })
    .where(and(eq(user_players.id, userPlayerId), eq(user_players.user_wallet, wallet)));

  return null;
}
