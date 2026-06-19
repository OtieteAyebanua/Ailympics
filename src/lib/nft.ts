import {
  readContract, readContracts, writeContract, waitForTransactionReceipt, getAccount,
} from 'wagmi/actions';
import { parseUnits, formatUnits, erc20Abi, type Address } from 'viem';
import { celo, celoAlfajores } from 'wagmi/chains';
import { wagmiConfig } from './wagmi';
import { ACTIVE_CHAIN_ID } from './chain';
import { env } from './env';
import { apiPost } from './api';

// Contract addresses come from the deploy step (see contracts/README.md).
const NFT_ADDRESS    = env.nftAddress    as Address | undefined;
const MARKET_ADDRESS = env.marketAddress as Address | undefined;

// Which chain the contracts live on — used for read calls so the storefront can
// load listings even before a wallet is connected.
const CHAIN_ID = ACTIVE_CHAIN_ID;

// Canonical cUSD per chain.
const CUSD: Record<number, Address> = {
  [celo.id]:          '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  [celoAlfajores.id]: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
};

const marketAbi = [
  { type: 'function', name: 'buy',    stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'list',   stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'price', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unlist', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'listings', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: 'seller', type: 'address' }, { name: 'price', type: 'uint256' }] },
  { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint96' }] },
] as const;

const nftAbi = [
  { type: 'function', name: 'isApprovedForAll', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'setApprovalForAll', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
] as const;

/** True once the NFT + marketplace addresses are configured in env. */
export function nftConfigured(): boolean {
  return !!NFT_ADDRESS && !!MARKET_ADDRESS;
}

/** Pretty-print a cUSD amount (18-decimal wei) for display. */
export function formatCusd(wei: bigint): string {
  return formatUnits(wei, 18);
}

export interface OnchainListing {
  seller: Address;
  price:  bigint;
  active: boolean;
}

/** Read a token's current on-chain listing (price = 0 means not for sale). */
export async function getListing(tokenId: bigint): Promise<OnchainListing> {
  const { market } = requireConfig();
  const [seller, price] = (await readContract(wagmiConfig, {
    address: market, abi: marketAbi, functionName: 'listings', args: [tokenId], chainId: CHAIN_ID,
  })) as readonly [Address, bigint];
  return { seller, price, active: price > 0n };
}

/**
 * Batch-read listings for many tokens at once (single multicall).
 * Returns a map keyed by tokenId string; missing/failed reads are omitted.
 */
export async function getListings(tokenIds: bigint[]): Promise<Map<string, OnchainListing>> {
  const map = new Map<string, OnchainListing>();
  if (!MARKET_ADDRESS || tokenIds.length === 0) return map;

  const results = await readContracts(wagmiConfig, {
    allowFailure: true,
    contracts: tokenIds.map((id) => ({
      address: MARKET_ADDRESS!,
      abi: marketAbi,
      functionName: 'listings' as const,
      args: [id] as const,
      chainId: CHAIN_ID,
    })),
  });

  results.forEach((res, i) => {
    if (res.status !== 'success' || !res.result) return;
    const [seller, price] = res.result as readonly [Address, bigint];
    map.set(tokenIds[i].toString(), { seller, price, active: price > 0n });
  });

  return map;
}

/**
 * Buy a listed NFT: approves cUSD if needed, then calls buy(tokenId).
 * Pays whatever the *current* on-chain listing price is. Returns the tx hash.
 */
export async function buyPlayer(tokenId: bigint): Promise<{ txHash: string }> {
  const { market } = requireConfig();
  const { address, chainId } = getAccount(wagmiConfig);
  if (!address || chainId == null) throw new Error('Connect your wallet');
  const cusd = cusdFor(chainId);

  const listing = await getListing(tokenId);
  if (!listing.active) throw new Error('This player is not for sale');
  const price = listing.price;

  const allowance = (await readContract(wagmiConfig, {
    address: cusd, abi: erc20Abi, functionName: 'allowance', args: [address, market], chainId: CHAIN_ID,
  })) as bigint;

  if (allowance < price) {
    const approveHash = await writeContract(wagmiConfig, {
      address: cusd, abi: erc20Abi, functionName: 'approve', args: [market, price],
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
  }

  const txHash = await writeContract(wagmiConfig, {
    address: market, abi: marketAbi, functionName: 'buy', args: [tokenId],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
  return { txHash };
}

/**
 * List an owned NFT for sale at `priceCusd` (human units, e.g. "2.5").
 * Approves the marketplace to transfer the token if not already approved.
 */
export async function listPlayer(tokenId: bigint, priceCusd: string): Promise<{ txHash: string }> {
  const { nft, market } = requireConfig();
  const { address, chainId } = getAccount(wagmiConfig);
  if (!address || chainId == null) throw new Error('Connect your wallet');

  const price = parseUnits(priceCusd, 18);
  if (price <= 0n) throw new Error('Enter a price greater than 0');

  const approved = (await readContract(wagmiConfig, {
    address: nft, abi: nftAbi, functionName: 'isApprovedForAll', args: [address, market], chainId: CHAIN_ID,
  })) as boolean;

  if (!approved) {
    const approveHash = await writeContract(wagmiConfig, {
      address: nft, abi: nftAbi, functionName: 'setApprovalForAll', args: [market, true],
    });
    await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
  }

  const txHash = await writeContract(wagmiConfig, {
    address: market, abi: marketAbi, functionName: 'list', args: [tokenId, price],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
  return { txHash };
}

/** Pull an owned NFT off the market. */
export async function unlistPlayer(tokenId: bigint): Promise<{ txHash: string }> {
  const { market } = requireConfig();
  const txHash = await writeContract(wagmiConfig, {
    address: market, abi: marketAbi, functionName: 'unlist', args: [tokenId],
  });
  await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
  return { txHash };
}

/**
 * Ask the backend to verify a purchase tx on-chain and record ownership.
 * Returns null on success, or an error string. Never trust the client to write
 * ownership directly — this confirms the transfer happened first.
 */
export async function verifyPurchase(txHash: string): Promise<string | null> {
  try {
    await apiPost('/api/verify-purchase', { txHash });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Verification request failed';
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function requireConfig(): { nft: Address; market: Address } {
  if (!NFT_ADDRESS || !MARKET_ADDRESS) {
    throw new Error('NFT marketplace is not configured yet');
  }
  return { nft: NFT_ADDRESS, market: MARKET_ADDRESS };
}

function cusdFor(chainId: number): Address {
  const addr = CUSD[chainId];
  if (!addr) throw new Error('Unsupported network — switch to Celo');
  return addr;
}
