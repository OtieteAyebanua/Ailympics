import { createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [celo, celoAlfajores],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Ailympics' }),
  ],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoAlfajores.id]: http('https://alfajores-forno.celo-testnet.org'),
  },
});
