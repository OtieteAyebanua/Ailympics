import { injected, coinbaseWallet } from "wagmi/connectors";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
const config = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
  connectors: [injected(), coinbaseWallet({appName: "test", preference: "all"})]
});
console.log(config.connectors.map(c => ({ id: c.id, type: c.type })));
