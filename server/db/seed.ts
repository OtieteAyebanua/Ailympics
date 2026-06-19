/**
 * Dev seed — a small catalog so the marketplace/squad UI isn't empty locally.
 * Run: npm run db:seed   (idempotent-ish; clears players first)
 *
 * NOTE: these are placeholder fixtures, not the real roster. Replace with the
 * production player catalog when it's available.
 */
import { db } from './client';
import { players } from './schema';

type NewPlayer = typeof players.$inferInsert;

const CLONEABLE: NewPlayer[] = [
  { name: 'Marcus Vance',  position: 'ST', rarity: 'Common', base_ovr: 68, is_cloneable: true, is_trainable: true, pace: 74, finishing: 70, dribbling: 66, stamina: 72, passing: 60, defending: 38, physicality: 67 },
  { name: 'Diego Romero',  position: 'CM', rarity: 'Common', base_ovr: 66, is_cloneable: true, is_trainable: true, pace: 64, finishing: 55, dribbling: 68, stamina: 75, passing: 72, defending: 60, physicality: 64 },
  { name: 'Kemal Aydin',   position: 'CB', rarity: 'Common', base_ovr: 67, is_cloneable: true, is_trainable: true, pace: 62, finishing: 30, dribbling: 50, stamina: 70, passing: 58, defending: 74, physicality: 75 },
  { name: 'Tobias Lund',   position: 'LW', rarity: 'Common', base_ovr: 65, is_cloneable: true, is_trainable: true, pace: 80, finishing: 62, dribbling: 72, stamina: 68, passing: 64, defending: 34, physicality: 55 },
  { name: 'Owen Hart',     position: 'GK', rarity: 'Common', base_ovr: 66, is_cloneable: true, is_trainable: true, reflexes: 70, positioning: 67, kicking: 62, handling: 68, distribution: 64 },
];

const NFTS: NewPlayer[] = [
  { name: 'Rafael Costa',  position: 'ST',  rarity: 'Legendary', base_ovr: 90, is_nft: true, is_icon: true,  price_eth: 2.5, token_id: '1', pace: 89, finishing: 92, dribbling: 88, stamina: 84, passing: 80, defending: 42, physicality: 82 },
  { name: 'Yuki Tanaka',   position: 'CAM', rarity: 'Epic',      base_ovr: 86, is_nft: true, is_icon: false, price_eth: 1.2, token_id: '2', pace: 82, finishing: 78, dribbling: 90, stamina: 80, passing: 88, defending: 50, physicality: 66 },
  { name: 'Anton Petrov',  position: 'CB',  rarity: 'Rare',      base_ovr: 82, is_nft: true, is_icon: false, price_eth: 0.6, token_id: '3', pace: 74, finishing: 35, dribbling: 58, stamina: 82, passing: 70, defending: 86, physicality: 88 },
];

async function main() {
  await db.delete(players);
  await db.insert(players).values([...CLONEABLE, ...NFTS]);
  const count = (await db.select().from(players)).length;
  console.log(`seeded ${count} players (${CLONEABLE.length} cloneable, ${NFTS.length} NFT)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
