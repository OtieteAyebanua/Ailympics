import { verifyPurchase } from '@/server/data/purchase';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();

  let body: { txHash?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  if (!body.txHash) return json({ error: 'txHash is required' }, 400);

  const result = await verifyPurchase(wallet, body.txHash);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ok: true, player_id: result.player_id });
}
