import { apiGet, apiPost } from './api';
import { type StatLabel } from '../models/models';
import { getSessionWallet } from './auth';

// Training data — now served by the Next.js API (was Supabase).

export interface TrainingResult {
  improved: boolean;
  gains: Partial<Record<StatLabel, number>>;
}

/**
 * Runs a training session for one player. Returns a TrainingResult, or throws
 * with an error message (insufficient points, not trainable, etc.).
 */
export async function runTrainingSession(
  playerId: number,
  allocations: Partial<Record<StatLabel, number>>,
): Promise<TrainingResult> {
  if (!getSessionWallet()) throw new Error('Not signed in');
  return apiPost<TrainingResult>('/api/training/session', { playerId, allocations });
}

/** The current user's remaining training points. */
export async function getTrainingPoints(): Promise<number> {
  if (!getSessionWallet()) return 0;
  try {
    const { points } = await apiGet<{ points: number }>('/api/training/points');
    return points;
  } catch {
    return 0;
  }
}
