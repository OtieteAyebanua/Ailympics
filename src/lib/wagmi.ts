import { createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'Ailympics',
      // 'eoaOnly' uses the Coinbase Wallet extension/app instead of the hosted
      // Smart Wallet popup at keys.coinbase.com, which is DNS-blocked in some
      // regions. Avoids the "site can't be reached" wall for users without a VPN.
      preference: { options: 'eoaOnly' },
    }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoAlfajores.id]: http('https://alfajores-forno.celo-testnet.org'),
  },
});
