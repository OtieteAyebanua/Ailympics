import { apiGet, apiPost } from './api';
import { type DbPlayer } from '../models/models';
import { getSessionWallet } from './auth';

// Marketplace data — now served by the Next.js API (was Supabase).

/** All Common cloneable templates (public). */
export function getCloneablePlayers(): Promise<DbPlayer[]> {
  return apiGet<DbPlayer[]>('/api/marketplace/cloneable');
}

/** All admin-minted NFT players (public). */
export function getNFTPlayers(): Promise<DbPlayer[]> {
  return apiGet<DbPlayer[]>('/api/marketplace/nft');
}

/** Clone a free Common player into the squad. Returns null on success, or an error string. */
export async function clonePlayer(playerId: number): Promise<string | null> {
  if (!getSessionWallet()) return 'Not signed in — connect your wallet first';
  try {
    await apiPost('/api/marketplace/clone', { playerId });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Clone failed';
  }
}

/** Record a confirmed on-chain NFT purchase. Returns null on success, or an error string. */
export async function recordNFTPurchase(
  playerId: number, priceEth: number, txHash: string,
): Promise<string | null> {
  if (!getSessionWallet()) return 'Not signed in';
  try {
    await apiPost('/api/marketplace/purchase', { playerId, priceEth, txHash });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not record purchase';
  }
}
