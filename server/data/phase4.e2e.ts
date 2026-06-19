/* Phase-4 API e2e — run: npx tsx server/data/phase4.e2e.ts  (Next on :3000) */
import { privateKeyToAccount } from 'viem/accounts';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, players, user_players, user_strategies } from '../db/schema';

const BASE = 'http://localhost:3000';
const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const address = account.address;
const wallet = address.toLowerCase();
const ok = (b: boolean) => (b ? '✓' : '✗ FAIL');

const message = [
  'Welcome to Ailympics', '', 'Sign this message to verify you own this wallet.',
  'This does not trigger a transaction or cost any gas.', '',
  `Wallet:    ${address}`, `Timestamp: ${Date.now()}`,
].join('\n');
const signature = await account.signMessage({ message });
const { access_token } = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, message, signature }),
})).json();
const H = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

// Clean slate
await db.delete(user_players).where(eq(user_players.user_wallet, wallet));
await db.delete(user_strategies).where(eq(user_strategies.user_wallet, wallet));
await db.update(users).set({ training_points: 500 }).where(eq(users.wallet_address, wallet));

const get = (p: string, auth = true) => fetch(`${BASE}${p}`, auth ? { headers: H } : undefined).then((r) => r.json());
const post = (p: string, body: unknown) => fetch(`${BASE}${p}`, { method: 'POST', headers: H, body: JSON.stringify(body) });

console.log('\n— MARKETPLACE —');
const cloneable = await get('/api/marketplace/cloneable', false);
const nfts = await get('/api/marketplace/nft', false);
console.log('cloneable catalog:', cloneable.length, ok(cloneable.length === 5), '| nft catalog:', nfts.length, ok(nfts.length === 3));
const cId = cloneable[0].id, nId = nfts[0].id;

console.log('clone cloneable →', (await post('/api/marketplace/clone', { playerId: cId })).status, ok(true));
const dup = await post('/api/marketplace/clone', { playerId: cId });
console.log('clone again →', dup.status, (await dup.json()).error, ok(dup.status === 400));
const badClone = await post('/api/marketplace/clone', { playerId: nId });
console.log('clone an NFT →', badClone.status, (await badClone.json()).error, ok(badClone.status === 400));

console.log('\n— TRAINING —');
console.log('points before:', (await get('/api/training/points')).points, ok((await get('/api/training/points')).points === 500));
const train = await post('/api/training/session', { playerId: cId, allocations: { pace: 30, finishing: 15 } });
const result = await train.json();
console.log('train result:', result, ok(result.improved === true && result.gains.pace === 2 && result.gains.finishing === 1));
console.log('points after (expect 455):', (await get('/api/training/points')).points, ok((await get('/api/training/points')).points === 455));
const squad = await get('/api/squad');
const trained = squad.find((p: { id: number }) => p.id === cId);
console.log('boosts on squad player:', trained?.boosts, ok(trained?.boosts?.pace === 2 && trained?.boosts?.finishing === 1));

console.log('\n— STRATEGY —');
console.log('strategy before:', await get('/api/strategy'), ok((await get('/api/strategy')) === null));
const put = await fetch(`${BASE}/api/strategy`, {
  method: 'PUT', headers: H,
  body: JSON.stringify({
    formation: '433', mentality: 'balanced', pressing: 'mid_press', tempo: 'normal',
    player_positions: [{ id: cId, num: 9, x: 50, y: 20 }],
  }),
});
console.log('PUT strategy →', put.status, ok(put.status === 200));
const loaded = await get('/api/strategy');
console.log('loaded strategy:', loaded?.formation, loaded?.player_positions, ok(loaded?.formation === '433' && loaded?.player_positions?.[0]?.num === 9));

console.log('\nPHASE 4 E2E DONE');
process.exit(0);
