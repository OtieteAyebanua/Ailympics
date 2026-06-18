import { ethers, network } from "hardhat";

// Canonical cUSD addresses on Celo.
const CUSD: Record<string, string> = {
  celo: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
};

async function main() {
  const cusd = CUSD[network.name];
  if (!cusd) throw new Error(`No cUSD address configured for network "${network.name}"`);

  const [deployer] = await ethers.getSigners();
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const feeBps = BigInt(process.env.FEE_BPS ?? "500"); // default 5%

  console.log(`Network:      ${network.name}`);
  console.log(`Deployer:     ${deployer.address}`);
  console.log(`Treasury:     ${treasury}`);
  console.log(`Fee recipient:${feeRecipient}`);
  console.log(`Fee:          ${Number(feeBps) / 100}%`);
  console.log(`cUSD:         ${cusd}\n`);

  // The deployer is the contract owner (the mint + fee-config authority).
  const Players = await ethers.getContractFactory("AilympicsPlayers");
  const players = await Players.deploy(deployer.address);
  await players.waitForDeployment();
  const playersAddr = await players.getAddress();
  console.log(`AilympicsPlayers deployed:  ${playersAddr}`);

  const Market = await ethers.getContractFactory("PlayerMarketplace");
  const market = await Market.deploy(playersAddr, cusd, feeRecipient, feeBps, deployer.address);
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log(`PlayerMarketplace deployed: ${marketAddr}\n`);

  console.log("── Next steps ──────────────────────────────────────────────");
  console.log("Add these to contracts/.env:");
  console.log(`  PLAYERS_ADDRESS=${playersAddr}`);
  console.log(`  MARKET_ADDRESS=${marketAddr}`);
  console.log("Then run the mint script:");
  console.log(`  npm run mint:${network.name}`);
  if (treasury.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(
      `\n⚠ Treasury ${treasury} differs from deployer — listing must be done from the` +
        ` treasury wallet (it must own the tokens). The mint script can only auto-list` +
        ` when the treasury is the deployer.`,
    );
  }
  console.log("\nAlso point your frontend at these addresses (VITE_NFT_ADDRESS / VITE_MARKET_ADDRESS).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
