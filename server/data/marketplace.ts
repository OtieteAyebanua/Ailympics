/** Marketplace data access — server-side port of src/lib/marketplace.ts. */
import { and, eq, isNull, count, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { players, users, user_players } from '../db/schema';

/** Public catalog — Common cloneable templates, best first. */
export function getCloneablePlayers() {
  return db.select().from(players).where(eq(players.is_cloneable, true)).orderBy(desc(players.base_ovr));
}

/** Public catalog — admin-minted NFT players, best first. */
export function getNFTPlayers() {
  return db.select().from(players).where(eq(players.is_nft, true)).orderBy(desc(players.base_ovr));
}

/** Clone a free Common player into a wallet's squad. Returns error string or null. */
export async function clonePlayer(wallet: string, playerId: number): Promise<string | null> {
  const player = await db
    .select({ id: players.id, is_cloneable: players.is_cloneable })
    .from(players).where(eq(players.id, playerId)).get();
  if (!player) return 'Player not found';
  if (!player.is_cloneable) return 'This player cannot be cloned';

  const [cnt] = await db
    .select({ c: count() }).from(user_players)
    .where(and(eq(user_players.user_wallet, wallet), isNull(user_players.deleted_at)));
  const user = await db
    .select({ limit: users.squad_limit }).from(users)
    .where(eq(users.wallet_address, wallet)).get();
  if (!user) return 'Could not load your profile';
  if ((cnt?.c ?? 0) >= user.limit) {
    return `Squad full — release a player to make room (limit: ${user.limit})`;
  }

  const [existing] = await db
    .select({ c: count() }).from(user_players)
    .where(and(
      eq(user_players.user_wallet, wallet),
      eq(user_players.player_id, playerId),
      isNull(user_players.deleted_at),
    ));
  if ((existing?.c ?? 0) > 0) return 'You already have this player in your squad';

  await db.insert(user_players).values({ user_wallet: wallet, player_id: playerId, source: 'clone' });
  return null;
}

/** Record a confirmed on-chain NFT purchase. Returns error string or null. */
export async function recordNFTPurchase(
  wallet: string, playerId: number, priceEth: number, txHash: string,
): Promise<string | null> {
  try {
    await db.insert(user_players).values({
      user_wallet: wallet, player_id: playerId, source: 'purchase',
      acquisition_price_eth: priceEth, tx_hash: txHash,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not record purchase';
  }
}
