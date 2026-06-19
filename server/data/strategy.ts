/** Strategy data access — server-side port of src/lib/strategy.ts. */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { user_strategies } from '../db/schema';

export interface StrategyInput {
  formation: string;
  mentality: string;
  pressing: string;
  tempo: string;
  player_positions: { id: number; x: number; y: number; num: number }[];
}

/** The wallet's saved strategy row, or null. */
export async function getStrategy(wallet: string) {
  const row = await db.select().from(user_strategies).where(eq(user_strategies.user_wallet, wallet)).get();
  return row ?? null;
}

/** Upsert the wallet's strategy. */
export async function saveStrategy(wallet: string, input: StrategyInput): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(user_strategies)
    .values({ user_wallet: wallet, ...input, updated_at: now })
    .onConflictDoUpdate({ target: user_strategies.user_wallet, set: { ...input, updated_at: now } });
}
