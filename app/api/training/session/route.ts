import { runTrainingSession } from '@/server/data/training';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();

  let body: { playerId?: number; allocations?: Record<string, number> };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  if (typeof body.playerId !== 'number' || !body.allocations) {
    return json({ error: 'playerId and allocations are required' }, 400);
  }

  const { result, error } = await runTrainingSession(wallet, body.playerId, body.allocations);
  if (error) return json({ error }, 400);
  return json(result);
}
