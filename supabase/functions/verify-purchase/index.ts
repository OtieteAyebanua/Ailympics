import { createClient }                          from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, parseEventLogs, formatUnits } from 'npm:viem';
import { celo, celoAlfajores }                    from 'npm:viem/chains';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Set these via `supabase secrets set` after deploying the contracts.
const NFT_ADDRESS    = (Deno.env.get('NFT_CONTRACT_ADDRESS')    ?? '').toLowerCase();
const MARKET_ADDRESS = (Deno.env.get('MARKET_CONTRACT_ADDRESS') ?? '').toLowerCase();
const CHAIN          = Deno.env.get('CONTRACTS_CHAIN') ?? 'celo'; // 'celo' | 'alfajores'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const chain  = CHAIN === 'alfajores' ? celoAlfajores : celo;
const client = createPublicClient({ chain, transport: http() });

// Only the event we need to decode.
const purchasedEvent = [{
  type: 'event',
  name: 'Purchased',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'buyer',   type: 'address', indexed: true },
    { name: 'seller',  type: 'address', indexed: true },
    { name: 'price',   type: 'uint256', indexed: false },
    { name: 'fee',     type: 'uint256', indexed: false },
  ],
}] as const;

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    if (!NFT_ADDRESS || !MARKET_ADDRESS) {
      return json({ error: 'Contracts not configured on the server' }, 500);
    }

    // 1. Authenticate the caller → wallet from their Supabase JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Not authenticated' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401);
    const wallet = (userData.user.user_metadata?.wallet_address ?? '').toLowerCase();
    if (!wallet) return json({ error: 'No wallet on session' }, 401);

    // 2. Parse input.
    let body: { txHash?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid request body' }, 400); }
    const txHash = body.txHash;
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return json({ error: 'A valid txHash is required' }, 400);
    }

    // 3. Fetch the receipt and confirm it succeeded.
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (receipt.status !== 'success') return json({ error: 'Transaction failed on-chain' }, 400);

    // 4. Find the Purchased event emitted by OUR marketplace. Using the log
    //    address (not tx.to) keeps this correct for smart-wallet/batched txs.
    const events = parseEventLogs({ abi: purchasedEvent, logs: receipt.logs, eventName: 'Purchased' });
    const ev = events.find((e) => e.address.toLowerCase() === MARKET_ADDRESS);
    if (!ev) return json({ error: 'No marketplace purchase found in this transaction' }, 400);

    const { tokenId, buyer, price } = ev.args;

    // 5. The buyer must be the authenticated caller.
    if (buyer.toLowerCase() !== wallet) {
      return json({ error: 'This purchase was made by a different wallet' }, 403);
    }

    // 6. Map the on-chain token to a player row.
    const { data: player, error: playerErr } = await admin
      .from('players')
      .select('id')
      .eq('is_nft', true)
      .eq('token_id', tokenId.toString())
      .ilike('contract_address', NFT_ADDRESS)
      .maybeSingle();

    if (playerErr) return json({ error: playerErr.message }, 500);
    if (!player)   return json({ error: 'No player matches this NFT' }, 404);

    const priceEth = Number(formatUnits(price, 18));

    // 7. Transfer ownership in the DB: remove any prior active owner of this
    //    1-of-1 NFT (hard delete — NFT rows can't be soft-deleted), then record
    //    the buyer. Idempotent if called twice for the same tx.
    const { error: delErr } = await admin
      .from('user_players')
      .delete()
      .eq('player_id', player.id)
      .is('deleted_at', null);
    if (delErr) return json({ error: delErr.message }, 500);

    const { error: insErr } = await admin
      .from('user_players')
      .insert({
        user_wallet:           wallet,
        player_id:             player.id,
        source:                'purchase',
        acquisition_price_eth: priceEth,
        tx_hash:               txHash,
      });
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, player_id: player.id });

  } catch (err) {
    console.error('verify-purchase error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
