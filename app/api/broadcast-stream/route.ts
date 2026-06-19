/**
 * broadcast-stream — relay between the agenticfoot broadcast server (VPS) and
 * AIlympics clients (port of the Supabase edge function). Proxies
 * `/broadcast/manifest` (JSON), `/broadcast/stream` (SSE), and commentary audio.
 *
 * EventSource can't set headers, so the app JWT rides as `?token=`. Set the
 * upstream URL as a server env: AGENTICFOOT_SERVER_URL=https://sim.your-vps.com
 */
import { verifyToken } from '@/server/auth/jwt';

export const runtime = 'nodejs';

const SERVER_URL = process.env.AGENTICFOOT_SERVER_URL;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

export async function GET(req: Request) {
  if (!SERVER_URL) return json({ error: 'AGENTICFOOT_SERVER_URL not configured' }, 500);

  const url = new URL(req.url);
  const resource = url.searchParams.get('resource') ?? 'stream';
  const token = url.searchParams.get('token') ?? '';

  const wallet = token ? await verifyToken(token) : null;
  if (!wallet) return json({ error: 'Not signed in' }, 401);

  const headers = { authorization: `Bearer ${token}` };

  try {
    if (resource === 'audio') {
      const path = url.searchParams.get('path') ?? '';
      if (!path.startsWith('/')) return json({ error: 'invalid audio path' }, 400);
      const upstream = await fetch(`${SERVER_URL}${path}`, { headers });
      if (!upstream.ok || !upstream.body) return json({ error: `audio upstream ${upstream.status}` }, 502);
      return new Response(upstream.body, {
        status: 200,
        headers: { ...CORS, 'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg', 'cache-control': 'public, max-age=3600' },
      });
    }

    if (resource === 'manifest') {
      const upstream = await fetch(`${SERVER_URL}/broadcast/manifest`, { headers });
      const body = await upstream.text();
      return new Response(body, { status: upstream.status, headers: { ...CORS, 'content-type': 'application/json' } });
    }

    // SSE stream — proxy the upstream body straight through.
    const upstream = await fetch(`${SERVER_URL}/broadcast/stream`, { headers: { accept: 'text/event-stream', ...headers } });
    if (!upstream.ok || !upstream.body) return json({ error: `stream upstream ${upstream.status}` }, 502);
    return new Response(upstream.body, {
      status: 200,
      headers: { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
    });
  } catch (err) {
    return json({ error: `upstream failed: ${err instanceof Error ? err.message : 'unknown'}` }, 502);
  }
}
