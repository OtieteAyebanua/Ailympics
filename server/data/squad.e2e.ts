/* Squad API e2e — run: npx tsx server/data/squad.e2e.ts  (Next on :3000) */
import { privateKeyToAccount } from 'viem/accounts';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { players, user_players } from '../db/schema';

const BASE = 'http://localhost:3000';
const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const address = account.address;
const wallet = address.toLowerCase();

const message = [
  'Welcome to Ailympics', '', 'Sign this message to verify you own this wallet.',
  'This does not trigger a transaction or cost any gas.', '',
  `Wallet:    ${address}`, `Timestamp: ${Date.now()}`,
].join('\n');
const signature = await account.signMessage({ message });

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, message, signature }),
});
const { access_token } = await login.json();
const H = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

// Seed ownership directly (clone flow not built yet): one clone + one NFT.
const clone = await db.select().from(players).where(eq(players.is_cloneable, true)).get();
const nft = await db.select().from(players).where(eq(players.is_nft, true)).get();
await db.delete(user_players).where(eq(user_players.user_wallet, wallet));
await db.insert(user_players).values([
  { user_wallet: wallet, player_id: clone!.id, source: 'clone' },
  { user_wallet: wallet, player_id: nft!.id, source: 'purchase' },
]);

type Owned = { id: number; name: string; ownership: { id: string }; boosts: Record<string, number> };
const squad: Owned[] = await (await fetch(`${BASE}/api/squad`, { headers: H })).json();
console.log('GET /api/squad → size:', squad.length,
  '| shape ok:', squad.every((p) => p.ownership?.id && p.boosts !== undefined) ? '✓' : '✗');

const info = await (await fetch(`${BASE}/api/squad/info`, { headers: H })).json();
console.log('GET /api/squad/info →', info, info.count === 2 && info.limit === 25 ? '✓' : '✗');

const cloneUP = squad.find((p) => p.id === clone!.id)!.ownership.id;
const rel = await fetch(`${BASE}/api/squad/release`, { method: 'POST', headers: H, body: JSON.stringify({ userPlayerId: cloneUP }) });
console.log('release clone →', rel.status, await rel.json());

const nftUP = squad.find((p) => p.id === nft!.id)!.ownership.id;
const relNft = await fetch(`${BASE}/api/squad/release`, { method: 'POST', headers: H, body: JSON.stringify({ userPlayerId: nftUP }) });
console.log('release NFT →', relNft.status, await relNft.json(), relNft.status === 400 ? '✓ (blocked)' : '✗');

const after: Owned[] = await (await fetch(`${BASE}/api/squad`, { headers: H })).json();
console.log('squad after release → size:', after.length, after.length === 1 ? '✓' : '✗');

const noauth = await fetch(`${BASE}/api/squad`);
console.log('no-auth GET /api/squad →', noauth.status, noauth.status === 401 ? '✓' : '✗');

console.log('SQUAD E2E OK');
process.exit(0);
