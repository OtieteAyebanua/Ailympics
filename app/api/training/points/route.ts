import { getTrainingPoints } from '@/server/data/training';
import { requireWallet, unauthorized, json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export async function GET(req: Request) {
  const wallet = await requireWallet(req);
  if (!wallet) return unauthorized();
  return json({ points: await getTrainingPoints(wallet) });
}
