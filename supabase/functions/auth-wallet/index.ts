import { createClient }            from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http } from 'npm:viem';
import { celo, base }               from 'npm:viem/chains';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Public clients for on-chain signature verification.
// verifyMessage handles EOA, ERC-1271 and ERC-6492 (smart wallet) signatures.
// Coinbase Smart Wallet may only be deployed/validatable on certain chains,
// so we try Celo first, then Base.
const celoClient = createPublicClient({ chain: celo, transport: http() });
const baseClient = createPublicClient({ chain: base, transport: http() });

async function tryVerify(client: typeof celoClient, address: string, message: string, signature: string) {
  try {
    const ok = await client.verifyMessage({
      address:   address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return { ok, error: null as string | null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    let body: { address?: string; message?: string; signature?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid request body' }, 400); }

    const { address, message, signature } = body;
    if (!address || !message || !signature) {
      return json({ error: 'address, message and signature are required' }, 400);
    }

    // 1. Reject stale messages
    const tsMatch = message.match(/Timestamp:\s*(\d+)/);
    if (!tsMatch) return json({ error: 'Message missing timestamp' }, 400);
    if (Date.now() - parseInt(tsMatch[1], 10) > 5 * 60 * 1000) {
      return json({ error: 'Message expired — please sign again' }, 401);
    }

    // 2. Verify wallet signature (EOA or smart wallet), trying Celo then Base
    const celoResult = await tryVerify(celoClient, address, message, signature);
    const baseResult = celoResult.ok
      ? { ok: false, error: null as string | null }
      : await tryVerify(baseClient, address, message, signature);

    if (!celoResult.ok && !baseResult.ok) {
      console.error('Signature verification failed:', { celo: celoResult, base: baseResult });
      return json({ error: 'Invalid signature' }, 401);
    }

    const wallet   = address.toLowerCase();
    const email    = `${wallet}@ailympics.local`;
    const password = wallet;

    // 3. Create user if not exists (ignore "already registered" errors)
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { wallet_address: wallet },
    });
    if (createError && !createError.message.toLowerCase().includes('already')) {
      console.error('createUser error:', createError.message);
      return json({ error: createError.message }, 500);
    }

    // 4. Sign in to get a Supabase JWT
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) {
      console.error('signIn error:', signInError?.message);
      return json({ error: signInError?.message ?? 'Sign in failed' }, 500);
    }

    // 5. Ensure public.users row exists (select first, insert if missing)
    const { data: existingUser } = await admin
      .from('users')
      .select('wallet_address')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (!existingUser) {
      const { error: insertError } = await admin
        .from('users')
        .insert({ wallet_address: wallet });
      // Ignore unique-violation races; fail loudly on anything else
      if (insertError && insertError.code !== '23505') {
        console.error('users insert error:', insertError);
        return json({ error: 'Could not create user profile', detail: insertError.message }, 500);
      }
    }

    return json({ access_token: signIn.session.access_token });

  } catch (err) {
    console.error('Unhandled error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
