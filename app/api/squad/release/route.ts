import { releasePlayer } from '@/server/data/squad';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();

  let body: { userPlayerId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!body.userPlayerId) return json({ error: 'userPlayerId is required' }, 400);

  const error = await releasePlayer(wallet, body.userPlayerId);
  if (error) return json({ error }, 400);
  return json({ ok: true });
}
