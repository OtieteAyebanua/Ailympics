/**
 * POST /api/auth/login — wallet-signature login (replaces the Supabase
 * `auth-wallet` edge function). Body: { address, message, signature }.
 * Returns { access_token } on success, matching the old response shape so the
 * frontend's signInWithWallet() works unchanged.
 */
import { NextResponse } from 'next/server';
import { loginWithWallet } from '@/server/auth/wallet';

// libsql + viem need the Node runtime (not edge).
export const runtime = 'nodejs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function POST(req: Request) {
  let body: { address?: string; message?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400, headers: CORS });
  }

  const result = await loginWithWallet({
    address: body.address ?? '',
    message: body.message ?? '',
    signature: body.signature ?? '',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: CORS });
  }
  return NextResponse.json({ access_token: result.token }, { headers: CORS });
}
