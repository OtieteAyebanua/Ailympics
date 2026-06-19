import { JWT_KEY, env } from './env';

const LOGIN_URL = `${env.apiUrl}/api/auth/login`;

export async function signInWithWallet(
  address: string,
  signMessage: (message: string) => Promise<string>,
): Promise<void> {
  const message   = buildMessage(address);
  const signature = await signMessage(message);

  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message, signature }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Auth failed');

  localStorage.setItem(JWT_KEY, data.access_token);
}

/**
 * Returns true if a valid, unexpired JWT is stored.
 * Clears and rejects expired/malformed tokens so the caller re-authenticates.
 */
export function restoreSession(): boolean {
  const token = localStorage.getItem(JWT_KEY);
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds; treat as expired 30s early to avoid edge races
    if (typeof payload.exp === 'number' && Date.now() / 1000 >= payload.exp - 30) {
      localStorage.removeItem(JWT_KEY);
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(JWT_KEY);
    return false;
  }
}

/** Returns the wallet address decoded from the stored JWT, or null. */
export function getSessionWallet(): string | null {
  const token = localStorage.getItem(JWT_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.user_metadata?.wallet_address ?? null;
  } catch {
    return null;
  }
}

export function signOut(): void {
  localStorage.removeItem(JWT_KEY);
}

function buildMessage(address: string): string {
  return [
    'Welcome to Ailympics',
    '',
    'Sign this message to verify you own this wallet.',
    'This does not trigger a transaction or cost any gas.',
    '',
    `Wallet:    ${address}`,
    `Timestamp: ${Date.now()}`,
  ].join('\n');
}
