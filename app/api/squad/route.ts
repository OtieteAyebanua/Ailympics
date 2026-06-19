import { getUserSquad } from '@/server/data/squad';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';

export const OPTIONS = preflight;

export async function GET(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();
  return json(await getUserSquad(wallet));
}
