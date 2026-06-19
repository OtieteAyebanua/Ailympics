/** Training data access — server-side port of src/lib/training.ts. */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { users, players, user_players, player_boosts, training_sessions, STAT_LABELS } from '../db/schema';

type StatLabel = typeof STAT_LABELS[number];
type Allocations = Partial<Record<StatLabel, number>>;

export interface TrainingResult {
  improved: boolean;
  gains: Allocations;
}

export async function getTrainingPoints(wallet: string): Promise<number> {
  const u = await db.select({ tp: users.training_points }).from(users).where(eq(users.wallet_address, wallet)).get();
  return u?.tp ?? 0;
}

/**
 * Run a training session. Returns { result } on success or { error } string.
 * Verifies ownership + trainable, checks points, deducts + logs, applies boosts.
 */
export async function runTrainingSession(
  wallet: string, playerId: number, allocations: Allocations,
): Promise<{ result?: TrainingResult; error?: string }> {
  const pointsSpent = Object.values(allocations).reduce<number>((s, v) => s + (v ?? 0), 0);
  if (pointsSpent <= 0) return { error: 'Allocate at least some points before training' };

  const owner = await db
    .select({ id: user_players.id, is_trainable: players.is_trainable })
    .from(user_players)
    .innerJoin(players, eq(user_players.player_id, players.id))
    .where(and(
      eq(user_players.user_wallet, wallet),
      eq(user_players.player_id, playerId),
      isNull(user_players.deleted_at),
    )).get();
  if (!owner) return { error: 'Player not found in your squad' };
  if (!owner.is_trainable) return { error: 'NFT players cannot be trained' };

  const user = await db.select({ tp: users.training_points }).from(users).where(eq(users.wallet_address, wallet)).get();
  if (!user) return { error: 'Could not load your profile' };
  if (user.tp < pointsSpent) {
    return { error: `Not enough training points (need ${pointsSpent}, have ${user.tp})` };
  }

  const { improved, gains, costEth } = rollGains(allocations);

  await db.update(users).set({ training_points: user.tp - pointsSpent }).where(eq(users.wallet_address, wallet));
  await db.insert(training_sessions).values({
    user_wallet: wallet, player_id: playerId, points_spent: pointsSpent,
    allocations, improved, cost_eth: costEth,
  });

  if (improved && Object.keys(gains).length > 0) {
    await applyBoosts(wallet, playerId, gains);
  }
  return { result: { improved, gains } };
}

/** Every 15 points allocated to a stat = +1 (floor division, no RNG). */
function rollGains(allocations: Allocations): { improved: boolean; gains: Allocations; costEth: number } {
  const gains: Allocations = {};
  let improved = false;
  for (const [stat, pts] of Object.entries(allocations) as [StatLabel, number][]) {
    if (!pts || pts <= 0) continue;
    const gain = Math.floor(pts / 15);
    if (gain > 0) { gains[stat] = gain; improved = true; }
  }
  const totalPts = Object.values(allocations).reduce<number>((s, v) => s + (v ?? 0), 0);
  const costEth = parseFloat((0.2 + totalPts * 0.003).toFixed(4));
  return { improved, gains, costEth };
}

/** Increment player_boosts (accumulates on top of existing boosts). */
async function applyBoosts(wallet: string, playerId: number, gains: Allocations): Promise<void> {
  const existing = await db
    .select({ stat_label: player_boosts.stat_label, boost: player_boosts.boost })
    .from(player_boosts)
    .where(and(eq(player_boosts.user_wallet, wallet), eq(player_boosts.player_id, playerId)));
  const existingMap = new Map(existing.map((r) => [r.stat_label, r.boost]));
  const now = new Date().toISOString();

  for (const [stat, gain] of Object.entries(gains) as [StatLabel, number][]) {
    const boost = (existingMap.get(stat) ?? 0) + (gain ?? 0);
    await db
      .insert(player_boosts)
      .values({ user_wallet: wallet, player_id: playerId, stat_label: stat, boost, updated_at: now })
      .onConflictDoUpdate({
        target: [player_boosts.user_wallet, player_boosts.player_id, player_boosts.stat_label],
        set: { boost, updated_at: now },
      });
  }
}
