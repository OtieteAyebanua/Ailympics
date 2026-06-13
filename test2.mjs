import { coinbaseWallet } from "wagmi/connectors";
const c = coinbaseWallet({appName: "test", preference: "all"}); 
// c is a function that creates the connector instance
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
const config = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
  connectors: [c]
});
console.log(config.connectors.map(c => c.id));
