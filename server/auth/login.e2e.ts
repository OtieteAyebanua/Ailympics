/* End-to-end test of POST /api/auth/login — run: npx tsx server/auth/login.e2e.ts
   (requires the Next server running on :3000) */
import { privateKeyToAccount } from 'viem/accounts';
import { verifyToken } from './jwt';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const address = account.address;

const message = [
  'Welcome to Ailympics', '',
  'Sign this message to verify you own this wallet.',
  'This does not trigger a transaction or cost any gas.', '',
  `Wallet:    ${address}`,
  `Timestamp: ${Date.now()}`,
].join('\n');

const signature = await account.signMessage({ message });

const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, message, signature }),
});
const data = await res.json();
console.log('status:', res.status);
console.log('body:', data);

if (!res.ok) { console.error('LOGIN FAILED'); process.exit(1); }

const sub = await verifyToken(data.access_token);
console.log('token sub:', sub, '| matches wallet:', sub === address.toLowerCase() ? '✓' : '✗');

const row = await db.select().from(users).where(eq(users.wallet_address, address.toLowerCase())).get();
console.log('user row created:', row?.wallet_address, '| tp:', row?.training_points);

// Bad-signature path
const bad = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, message, signature: '0xdeadbeef' }),
});
console.log('bad-sig status:', bad.status, '(expect 401)');

console.log('E2E OK');
process.exit(0);
