import { ethers, network } from "hardhat";
import type { ContractTransactionReceipt, Interface } from "ethers";
import { createClient } from "@supabase/supabase-js";

/**
 * Mints every is_nft player from Supabase that hasn't been minted yet (token_id is
 * null), to the treasury, lists it on the marketplace at its `price_eth` (in cUSD),
 * and backfills token_id + contract_address back into the DB.
 *
 * Safe to re-run: already-minted players are skipped because token_id is set.
 */
async function main() {
  const playersAddr = required("PLAYERS_ADDRESS");
  const marketAddr = required("MARKET_ADDRESS");
  const supabaseUrl = required("SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const metadataBase = process.env.METADATA_BASE_URI ?? "";

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const [signer] = await ethers.getSigners();
  const treasury = process.env.TREASURY_ADDRESS || signer.address;

  const nft = await ethers.getContractAt("AilympicsPlayers", playersAddr);
  const market = await ethers.getContractAt("PlayerMarketplace", marketAddr);

  console.log(`Network:  ${network.name}`);
  console.log(`Signer:   ${signer.address}`);
  console.log(`Treasury: ${treasury}\n`);

  // Fetch the NFT roster that still needs minting.
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, price_eth, token_id")
    .eq("is_nft", true)
    .is("token_id", null)
    .order("id", { ascending: true });

  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  if (!players || players.length === 0) {
    console.log("Nothing to mint — every is_nft player already has a token_id.");
    return;
  }
  console.log(`Found ${players.length} player(s) to mint.\n`);

  // Listing requires the lister to OWN the token, so the script can only auto-list
  // when the signer is the treasury (the wallet we mint to). Otherwise we mint
  // only, and the treasury wallet lists its own tokens later (UI or its own run).
  const canList = treasury.toLowerCase() === signer.address.toLowerCase();
  if (canList) {
    const approved = await nft.isApprovedForAll(treasury, marketAddr);
    if (!approved) {
      console.log("Approving marketplace to transfer treasury NFTs…");
      await (await nft.setApprovalForAll(marketAddr, true)).wait();
    }
  } else {
    console.warn(
      `⚠ Treasury ${treasury} != signer ${signer.address}. Minting only — list from the ` +
        `treasury wallet (it must approve the marketplace and own the tokens first).\n`,
    );
  }

  for (const p of players) {
    const uri = metadataBase ? `${metadataBase}${p.id}` : "";

    console.log(`Minting #${p.id} "${p.name}" → ${treasury}`);
    const mintReceipt = await (await nft.mint(treasury, uri)).wait();
    const tokenId = tokenIdFromReceipt(nft.interface, mintReceipt);

    // price_eth is the price you set; cUSD has 18 decimals.
    const price = ethers.parseUnits(String(p.price_eth ?? "0"), 18);
    if (canList && price > 0n) {
      console.log(`  Listing token ${tokenId} at ${p.price_eth} cUSD`);
      await (await market.list(tokenId, price)).wait();
    } else if (price === 0n) {
      console.log(`  price_eth is 0 — minted but NOT listed (set a price, then list later)`);
    }

    const { error: upErr } = await supabase
      .from("players")
      .update({ token_id: tokenId.toString(), contract_address: playersAddr })
      .eq("id", p.id);
    if (upErr) throw new Error(`DB backfill failed for player ${p.id}: ${upErr.message}`);

    console.log(`  ✓ token ${tokenId} recorded in Supabase\n`);
  }

  console.log("Done.");
}

function tokenIdFromReceipt(iface: Interface, receipt: ContractTransactionReceipt | null): bigint {
  if (!receipt) throw new Error("No transaction receipt");
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "Transfer") return parsed.args.tokenId as bigint;
    } catch {
      // not a log from this contract — ignore
    }
  }
  throw new Error("Could not find Transfer event in mint receipt");
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
