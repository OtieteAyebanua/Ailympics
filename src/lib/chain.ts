import { celo, celoAlfajores } from 'wagmi/chains';
import { env } from './env';

/**
 * The chain the app targets — driven by NEXT_PUBLIC_CONTRACTS_CHAIN.
 * Set it to 'alfajores' for testnet, or leave unset / 'celo' for mainnet.
 * Used both for on-chain reads and for the wallet's auto network switch, so the
 * whole app stays on the same chain the contracts are deployed to.
 */
export const ACTIVE_CHAIN =
  env.contractsChain === 'alfajores' ? celoAlfajores : celo;

export const ACTIVE_CHAIN_ID = ACTIVE_CHAIN.id;
