import { getStrategy, saveStrategy, type StrategyInput } from '@/server/data/strategy';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export async function GET(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();
  return json(await getStrategy(wallet));
}

export async function PUT(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();

  let body: Partial<StrategyInput>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  const { formation, mentality, pressing, tempo, player_positions } = body;
  if (!formation || !mentality || !pressing || !tempo || !Array.isArray(player_positions)) {
    return json({ error: 'formation, mentality, pressing, tempo and player_positions are required' }, 400);
  }

  await saveStrategy(wallet, { formation, mentality, pressing, tempo, player_positions });
  return json({ ok: true });
}
