import { clonePlayer } from '@/server/data/marketplace';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();

  let body: { playerId?: number };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  if (typeof body.playerId !== 'number') return json({ error: 'playerId is required' }, 400);

  const error = await clonePlayer(wallet, body.playerId);
  if (error) return json({ error }, 400);
  return json({ ok: true });
}
