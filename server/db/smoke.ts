/* Foundation smoke test — run: npx tsx server/db/smoke.ts */
import { createClient } from '@libsql/client';
import { db } from './client';
import { users, players } from './schema';
import { eq } from 'drizzle-orm';
import { issueToken, verifyToken } from '../auth/jwt';

const raw = createClient({ url: 'file:./server/db/ailympics.db' });

const tables = await raw.execute(
  "select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
);
console.log('tables:', tables.rows.map((r) => r.name).join(', '));

// JWT round-trip
const token = await issueToken('0xABCdef0000000000000000000000000000000001');
const sub = await verifyToken(token);
console.log('jwt sub:', sub, sub === '0xabcdef0000000000000000000000000000000001' ? '✓' : '✗ MISMATCH');

// DB write/read
await db.insert(users).values({ wallet_address: '0xabc1' }).onConflictDoNothing();
const u = await db.select().from(users).where(eq(users.wallet_address, '0xabc1')).get();
console.log('user row:', u?.wallet_address, 'tp=', u?.training_points, 'limit=', u?.squad_limit, 'created=', u?.created_at);

await db.insert(players).values({
  name: 'Test Striker', position: 'ST', rarity: 'Common', base_ovr: 70, is_cloneable: true, is_trainable: true,
}).onConflictDoNothing();
const p = await db.select().from(players).where(eq(players.name, 'Test Striker')).get();
console.log('player row:', p?.id, p?.name, p?.rarity, 'nft=', p?.is_nft, 'cloneable=', p?.is_cloneable);

console.log('SMOKE OK');
