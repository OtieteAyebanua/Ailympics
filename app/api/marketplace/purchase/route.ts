import { recordNFTPurchase } from '@/server/data/marketplace';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();

  let body: { playerId?: number; priceEth?: number; txHash?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  if (typeof body.playerId !== 'number' || typeof body.priceEth !== 'number' || !body.txHash) {
    return json({ error: 'playerId, priceEth and txHash are required' }, 400);
  }

  const error = await recordNFTPurchase(wallet, body.playerId, body.priceEth, body.txHash);
  if (error) return json({ error }, 400);
  return json({ ok: true });
}
