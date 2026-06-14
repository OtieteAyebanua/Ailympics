import { supabase } from './supabase';
import { type StatLabel } from '../models/models';
import { getSessionWallet } from './auth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrainingResult {
  improved: boolean;
  gains: Partial<Record<StatLabel, number>>; // stat → how much it went up (0 if no gain)
}

// ── Run a training session ────────────────────────────────────────────────────

/**
 * Runs a training session for one player.
 *
 * Flow:
 *   1. Verify the player is in the user's squad and is trainable
 *   2. Check the user has enough training points
 *   3. Deduct points and log the session
 *   4. Roll for stat improvements based on points allocated
 *   5. Upsert player_boosts for any stats that improved
 *
 * @param playerId   - the players.id
 * @param allocations - { pace: 20, finishing: 10 } — points per stat
 * @returns TrainingResult on success, or throws with an error message
 */
export async function runTrainingSession(
  playerId: number,
  allocations: Partial<Record<StatLabel, number>>,
): Promise<TrainingResult> {
  const wallet = await getWallet();
  if (!wallet) throw new Error('Not signed in');

  const pointsSpent = Object.values(allocations).reduce((s, v) => s + (v ?? 0), 0);
  if (pointsSpent <= 0) throw new Error('Allocate at least some points before training');

  // 1. Verify ownership + trainable
  const { data: ownership, error: ownerErr } = await supabase
    .from('user_players')
    .select('id, players (is_trainable, is_nft)')
    .eq('user_wallet', wallet)
    .eq('player_id', playerId)
    .is('deleted_at', null)
    .single();

  if (ownerErr || !ownership) throw new Error('Player not found in your squad');

  const player = ownership.players as unknown as { is_trainable: boolean; is_nft: boolean } | null;
  if (!player?.is_trainable) throw new Error('NFT players cannot be trained');

  // 2. Check training points
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('training_points')
    .eq('wallet_address', wallet)
    .single();

  if (userErr || !user) throw new Error('Could not load your profile');
  if (user.training_points < pointsSpent) {
    throw new Error(`Not enough training points (need ${pointsSpent}, have ${user.training_points})`);
  }

  // 3. Roll for stat gains
  const { improved, gains, costEth } = rollGains(allocations);

  // 4. Deduct points + log session (run in parallel)
  const [deductResult, logResult] = await Promise.all([
    supabase
      .from('users')
      .update({ training_points: user.training_points - pointsSpent })
      .eq('wallet_address', wallet),
    supabase
      .from('training_sessions')
      .insert({
        user_wallet:  wallet,
        player_id:    playerId,
        points_spent: pointsSpent,
        allocations,
        improved,
        cost_eth:     costEth,
      }),
  ]);

  if (deductResult.error) throw new Error(deductResult.error.message);
  if (logResult.error)    throw new Error(logResult.error.message);

  // 5. Upsert boosts for stats that improved
  if (improved && Object.keys(gains).length > 0) {
    await applyBoosts(wallet, playerId, gains);
  }

  return { improved, gains };
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Returns the current user's remaining training points. */
export async function getTrainingPoints(): Promise<number> {
  const wallet = await getWallet();
  if (!wallet) return 0;

  const { data, error } = await supabase
    .from('users')
    .select('training_points')
    .eq('wallet_address', wallet)
    .single();

  if (error || !data) return 0;
  return data.training_points;
}

/** Returns the full training history for a specific player. */
export async function getTrainingHistory(playerId: number) {
  const wallet = await getWallet();
  if (!wallet) return [];

  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_wallet', wallet)
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Internals ─────────────────────────────────────────────────────────────────

/**
 * Calculates guaranteed stat gains: every 15 points allocated to a stat = +1.
 * e.g. 15 pts → +1, 30 pts → +2, 44 pts → +2 (floor division, no RNG).
 */
function rollGains(allocations: Partial<Record<StatLabel, number>>): {
  improved: boolean;
  gains: Partial<Record<StatLabel, number>>;
  costEth: number;
} {
  const gains: Partial<Record<StatLabel, number>> = {};
  let improved = false;

  for (const [stat, pts] of Object.entries(allocations) as [StatLabel, number][]) {
    if (!pts || pts <= 0) continue;
    const gain = Math.floor(pts / 15);
    if (gain > 0) {
      gains[stat as StatLabel] = gain;
      improved = true;
    }
  }

  const totalPts = Object.values(allocations).reduce((s, v) => s + (v ?? 0), 0);
  const costEth  = parseFloat((0.2 + totalPts * 0.003).toFixed(4));

  return { improved, gains, costEth };
}

/**
 * Upserts player_boosts rows — increments existing boosts rather than overwriting.
 * Uses Supabase's upsert with ignoreDuplicates=false so the boost column accumulates.
 */
async function applyBoosts(
  wallet: string,
  playerId: number,
  gains: Partial<Record<StatLabel, number>>,
): Promise<void> {
  // Fetch existing boosts for this player so we can add on top
  const { data: existing } = await supabase
    .from('player_boosts')
    .select('stat_label, boost')
    .eq('user_wallet', wallet)
    .eq('player_id', playerId);

  const existingMap: Partial<Record<StatLabel, number>> = Object.fromEntries(
    (existing ?? []).map((r: { stat_label: string; boost: number }) => [r.stat_label, r.boost]),
  );

  const rows = Object.entries(gains).map(([stat, gain]) => ({
    user_wallet: wallet,
    player_id:   playerId,
    stat_label:  stat as StatLabel,
    boost:       (existingMap[stat as StatLabel] ?? 0) + (gain ?? 0),
    updated_at:  new Date().toISOString(),
  }));

  await supabase
    .from('player_boosts')
    .upsert(rows, { onConflict: 'user_wallet,player_id,stat_label' });
}

function getWallet(): string | null {
  return getSessionWallet();
}
