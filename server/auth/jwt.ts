/**
 * App JWT — replaces the Supabase-issued token. HS256, `sub` = lowercase
 * wallet address. The frontend stores it under localStorage 'ailympics_jwt'
 * and sends it as `Authorization: Bearer <token>`; route handlers verify it.
 */
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'dev-only-insecure-secret-change-me',
);
const ISSUER = 'ailympics';
const TTL = '7d';

export async function issueToken(wallet: string): Promise<string> {
  const w = wallet.toLowerCase();
  // `user_metadata.wallet_address` mirrors the old Supabase token so the
  // existing frontend getSessionWallet() keeps working through the migration.
  return new SignJWT({ user_metadata: { wallet_address: w } })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(w)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret);
}

/** Returns the wallet (sub) if the token is valid, else null. */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Extract + verify the bearer token from an Authorization header. */
export async function walletFromAuthHeader(header: string | null): Promise<string | null> {
  if (!header?.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}
