/**
 * On-chain purchase verification — server-side port of the verify-purchase
 * edge function. Confirms a marketplace `Purchased` event on Celo, checks the
 * buyer matches the caller, and transfers DB ownership of the 1-of-1 NFT.
 */
import { createPublicClient, http, parseEventLogs, formatUnits } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { players, user_players } from '../db/schema';

const NFT_ADDRESS    = (process.env.NFT_CONTRACT_ADDRESS    ?? '').toLowerCase();
const MARKET_ADDRESS = (process.env.MARKET_CONTRACT_ADDRESS ?? '').toLowerCase();
const CHAIN          = process.env.CONTRACTS_CHAIN ?? 'celo';

const chain  = CHAIN === 'alfajores' ? celoAlfajores : celo;
const client = createPublicClient({ chain, transport: http() });

const purchasedEvent = [{
  type: 'event',
  name: 'Purchased',
  inputs: [
    { name: 'tokenId', type: 'uint256', indexed: true },
    { name: 'buyer',   type: 'address', indexed: true },
    { name: 'seller',  type: 'address', indexed: true },
    { name: 'price',   type: 'uint256', indexed: false },
    { name: 'fee',     type: 'uint256', indexed: false },
  ],
}] as const;

export type VerifyResult =
  | { ok: true; player_id: number }
  | { ok: false; status: number; error: string };

export async function verifyPurchase(wallet: string, txHash: string): Promise<VerifyResult> {
  if (!NFT_ADDRESS || !MARKET_ADDRESS) {
    return { ok: false, status: 500, error: 'Contracts not configured on the server' };
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, status: 400, error: 'A valid txHash is required' };
  }

  const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  if (receipt.status !== 'success') return { ok: false, status: 400, error: 'Transaction failed on-chain' };

  // Match by log address (not tx.to) so smart-wallet/batched txs still verify.
  const events = parseEventLogs({ abi: purchasedEvent, logs: receipt.logs, eventName: 'Purchased' });
  const ev = events.find((e) => e.address.toLowerCase() === MARKET_ADDRESS);
  if (!ev) return { ok: false, status: 400, error: 'No marketplace purchase found in this transaction' };

  const { tokenId, buyer, price } = ev.args;
  if (buyer.toLowerCase() !== wallet) {
    return { ok: false, status: 403, error: 'This purchase was made by a different wallet' };
  }

  const player = await db
    .select({ id: players.id })
    .from(players)
    .where(and(
      eq(players.is_nft, true),
      eq(players.token_id, tokenId.toString()),
      sql`lower(${players.contract_address}) = ${NFT_ADDRESS}`,
    ))
    .get();
  if (!player) return { ok: false, status: 404, error: 'No player matches this NFT' };

  const priceEth = Number(formatUnits(price, 18));

  // Transfer ownership: drop any prior active owner of this 1-of-1, record buyer.
  // Idempotent if called twice for the same tx.
  await db.delete(user_players).where(and(eq(user_players.player_id, player.id), isNull(user_players.deleted_at)));
  await db.insert(user_players).values({
    user_wallet: wallet, player_id: player.id, source: 'purchase',
    acquisition_price_eth: priceEth, tx_hash: txHash,
  });

  return { ok: true, player_id: player.id };
}
