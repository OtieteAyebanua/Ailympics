/**
 * broadcast-stream — relay between the agenticfoot broadcast server (on a VPS)
 * and AIlympics clients. It does NOT simulate; it proxies the server's
 * `/broadcast/manifest` (JSON) and `/broadcast/stream` (SSE) to the browser.
 *
 * EventSource can't set headers, so the client passes credentials as query
 * params (`?apikey=…&token=…`). Deploy with JWT verification OFF so this
 * function gates requests itself:  supabase functions deploy broadcast-stream --no-verify-jwt
 *
 * Env (project secrets):
 *   AGENTICFOOT_SERVER_URL   base URL of the VPS broadcast server, e.g. https://sim.example.com
 *   SUPABASE_ANON_KEY        injected by Supabase; used as a basic relay gate
 */

const SERVER_URL = Deno.env.get('AGENTICFOOT_SERVER_URL');
const ANON_KEY   = Deno.env.get('SUPABASE_ANON_KEY');

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!SERVER_URL) return json({ error: 'AGENTICFOOT_SERVER_URL not configured' }, 500);

  const url      = new URL(req.url);
  const resource = url.searchParams.get('resource') ?? 'stream';
  const apikey   = url.searchParams.get('apikey') ?? req.headers.get('apikey');
  const token    = url.searchParams.get('token') ?? '';

  // Basic relay gate: the caller must present the project anon key.
  if (ANON_KEY && apikey !== ANON_KEY) return json({ error: 'unauthorized' }, 401);

  // Forward the player's session token upstream so the server can scope/auth it.
  const upstreamHeaders: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};

  // Commentary audio (mp3) — proxy an arbitrary server-relative path's bytes.
  if (resource === 'audio') {
    const path = url.searchParams.get('path') ?? '';
    if (!path.startsWith('/')) return json({ error: 'invalid audio path' }, 400);
    try {
      const upstream = await fetch(`${SERVER_URL}${path}`, { headers: upstreamHeaders });
      if (!upstream.ok || !upstream.body) return json({ error: `audio upstream ${upstream.status}` }, 502);
      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...CORS,
          'content-type':  upstream.headers.get('content-type') ?? 'audio/mpeg',
          'cache-control': 'public, max-age=3600',
        },
      });
    } catch (err) {
      return json({ error: `audio upstream failed: ${err instanceof Error ? err.message : 'unknown'}` }, 502);
    }
  }

  if (resource === 'manifest') {
    try {
      const upstream = await fetch(`${SERVER_URL}/broadcast/manifest`, { headers: upstreamHeaders });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...CORS, 'content-type': 'application/json' },
      });
    } catch (err) {
      return json({ error: `manifest upstream failed: ${err instanceof Error ? err.message : 'unknown'}` }, 502);
    }
  }

  // SSE stream — proxy the upstream body straight through (no buffering).
  try {
    const upstream = await fetch(`${SERVER_URL}/broadcast/stream`, {
      headers: { accept: 'text/event-stream', ...upstreamHeaders },
    });
    if (!upstream.ok || !upstream.body) {
      return json({ error: `stream upstream ${upstream.status}` }, 502);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...CORS,
        'content-type':  'text/event-stream',
        'cache-control': 'no-cache',
        'connection':    'keep-alive',
      },
    });
  } catch (err) {
    return json({ error: `stream upstream failed: ${err instanceof Error ? err.message : 'unknown'}` }, 502);
  }
});
