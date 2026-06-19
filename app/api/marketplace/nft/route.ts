import { getNFTPlayers } from '@/server/data/marketplace';
import { json, preflight } from '@/server/http';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

// Public catalog — no auth required.
export async function GET() {
  return json(await getNFTPlayers());
}
