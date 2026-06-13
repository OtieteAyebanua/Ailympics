import { createConfig } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";
const c = coinbaseWallet({appName: "test"});
console.log(c.id);
