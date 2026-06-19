/**
 * Wallet-signature login — port of supabase/functions/auth-wallet.
 *
 * Verifies an EOA / smart-wallet signature (viem `verifyMessage`, trying Celo
 * then Base for ERC-1271/6492 wallets), ensures a `users` row exists, and
 * issues our own JWT. No Supabase auth involved.
 */
import { createPublicClient, http } from 'viem';
import { celo, base } from 'viem/chains';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { issueToken } from './jwt';

const celoClient = createPublicClient({ chain: celo, transport: http() });
const baseClient = createPublicClient({ chain: base, transport: http() });

// Only the verifyMessage capability is needed — typing it this way sidesteps
// the per-chain client type differences (Celo vs Base).
interface MessageVerifier {
  verifyMessage(args: {
    address: `0x${string}`;
    message: string;
    signature: `0x${string}`;
  }): Promise<boolean>;
}

async function verifyOn(
  client: MessageVerifier,
  address: `0x${string}`,
  message: string,
  signature: `0x${string}`,
): Promise<boolean> {
  try {
    return await client.verifyMessage({ address, message, signature });
  } catch {
    return false;
  }
}

export interface LoginInput {
  address: string;
  message: string;
  signature: string;
}

export type LoginResult =
  | { ok: true; token: string; wallet: string }
  | { ok: false; status: number; error: string };

export async function loginWithWallet(input: LoginInput): Promise<LoginResult> {
  const { address, message, signature } = input;
  if (!address || !message || !signature) {
    return { ok: false, status: 400, error: 'address, message and signature are required' };
  }

  // Reject stale messages (signed within the last 5 minutes).
  const tsMatch = message.match(/Timestamp:\s*(\d+)/);
  if (!tsMatch) return { ok: false, status: 400, error: 'Message missing timestamp' };
  if (Date.now() - parseInt(tsMatch[1], 10) > 5 * 60 * 1000) {
    return { ok: false, status: 401, error: 'Message expired — please sign again' };
  }

  // Verify signature (EOA or smart wallet), trying Celo then Base.
  const addr = address as `0x${string}`;
  const sig = signature as `0x${string}`;
  const verified =
    (await verifyOn(celoClient, addr, message, sig)) ||
    (await verifyOn(baseClient, addr, message, sig));
  if (!verified) return { ok: false, status: 401, error: 'Invalid signature' };

  const wallet = address.toLowerCase();

  // Ensure the user row exists (idempotent).
  await db.insert(users).values({ wallet_address: wallet }).onConflictDoNothing();
  // Confirm it's there (defensive against a race).
  const row = await db.select({ w: users.wallet_address }).from(users).where(eq(users.wallet_address, wallet)).get();
  if (!row) return { ok: false, status: 500, error: 'Could not create user profile' };

  const token = await issueToken(wallet);
  return { ok: true, token, wallet };
}
