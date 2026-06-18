import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Celo runs as an Ethereum L2 (Cel2) and supports the Cancun opcode set,
      // which OpenZeppelin v5.x requires (uses the `mcopy` opcode).
      evmVersion: "cancun",
    },
  },
  networks: {
    celo: {
      url: process.env.CELO_RPC_URL ?? "https://forno.celo.org",
      chainId: 42220,
      accounts,
    },
    alfajores: {
      url: process.env.ALFAJORES_RPC_URL ?? "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      accounts,
    },
  },
  // `npx hardhat verify` support via Celoscan.
  etherscan: {
    apiKey: {
      celo: process.env.CELOSCAN_API_KEY ?? "",
      alfajores: process.env.CELOSCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: { apiURL: "https://api.celoscan.io/api", browserURL: "https://celoscan.io" },
      },
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io",
        },
      },
    ],
  },
};

export default config;
