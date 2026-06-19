/**
 * Public runtime config. Next.js statically inlines `process.env.NEXT_PUBLIC_*`
 * at build time, so each must be referenced as a literal (as below).
 */
export const JWT_KEY = 'ailympics_jwt';

export const env = {
  /** API base — empty = same origin (the Next app). */
  apiUrl:         (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, ''),
  nftAddress:     process.env.NEXT_PUBLIC_NFT_ADDRESS as `0x${string}` | undefined,
  marketAddress:  process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined,
  contractsChain: process.env.NEXT_PUBLIC_CONTRACTS_CHAIN,
  /** Direct broadcast server URL (bypasses the relay) — local/ngrok testing. */
  broadcastUrl:   process.env.NEXT_PUBLIC_BROADCAST_URL,
} as const;
