/**
 * Shared helpers for API route handlers — auth, JSON responses, CORS.
 *
 * Per-route authorization replaces Supabase RLS: `requireWallet` extracts the
 * wallet from the JWT, and each route scopes its queries to that wallet.
 */
import { NextResponse } from 'next/server';
import { walletFromAuthHeader } from './auth/jwt';

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS });
}

export function preflight(): NextResponse {
  return new NextResponse(null, { headers: CORS });
}

/** Wallet from the Bearer token, or null. */
export function requireWallet(req: Request): Promise<string | null> {
  return walletFromAuthHeader(req.headers.get('authorization'));
}

export function unauthorized(): NextResponse {
  return json({ error: 'Not signed in' }, 401);
}
