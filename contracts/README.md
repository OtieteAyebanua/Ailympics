# AIlympics Contracts

Player NFTs (`AilympicsPlayers`, ERC-721) + primary-sale marketplace
(`PlayerMarketplace`) for AIlympics on **Celo**, priced in **cUSD**.

Model: you mint every NFT player up-front to a **treasury** wallet and list each at
a price you choose. Buyers pay cUSD and receive the NFT in a single transaction.

**Resales earn you a cut.** Any owner can relist a player they bought, and every
sale (primary *and* secondary) sends a platform fee (`FEE_BPS`, default 5%, max
10%) to your `FEE_RECIPIENT` wallet; the rest goes to the seller. Adjust anytime
with `market.setFee(bps, recipient)`.

This is a standalone project — its dependencies are isolated from the Vite app.

## Setup

```bash
cd contracts
npm install
cp .env.example .env      # then fill it in
```

Fill in `.env`:
- `PRIVATE_KEY` — deployer/treasury wallet. Fund it with CELO for gas
  (testnet: https://faucet.celo.org/alfajores).
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — so the mint script can read the
  `is_nft` roster and write back `token_id` / `contract_address`.
- `METADATA_BASE_URI` — optional; where each token's metadata JSON is served.

## Deploy & mint (test on Alfajores first!)

```bash
npm run compile

# 1. Deploy both contracts. Copy the printed PLAYERS_ADDRESS / MARKET_ADDRESS into .env
npm run deploy:alfajores

# 2. Mint every unminted is_nft player to the treasury, list it at price_eth (cUSD),
#    and backfill token_id + contract_address into Supabase. Safe to re-run.
npm run mint:alfajores
```

When it all checks out on Alfajores, repeat with `:celo` for mainnet.

## How sales work on-chain

**Primary (your treasury → buyer):**
1. Treasury holds the NFTs; on first mint the script calls
   `setApprovalForAll(marketplace, true)` so the marketplace can deliver them.
2. To buy token `N`, the buyer approves the marketplace to spend `price` cUSD,
   then calls `marketplace.buy(N)`. The platform fee goes to `feeRecipient`, the
   rest to the seller (the treasury). When treasury == feeRecipient, you get 100%.

**Secondary (a user resells to another user):**
1. The current owner approves the marketplace for their token
   (`approve(marketplace, tokenId)` or `setApprovalForAll`), then `list(tokenId, price)`.
2. A new buyer calls `buy(tokenId)`. The platform fee (`feeBps`) goes to **you**
   (`feeRecipient`); the seller receives the remainder. This is your cut on resales.

## Fees, re-pricing, relisting

```solidity
market.setFee(500, yourWallet);            // 5% cut to your wallet (owner only, max 10%)
market.list(tokenId, newPriceInCusdWei);   // (re-)list a token you own
market.listBatch(ids, prices);             // bulk
market.unlist(tokenId);                     // seller (or owner) pulls from sale
```

`price` is in cUSD's smallest unit (18 decimals): `1 cUSD = 1e18`.

## cUSD addresses

| Network   | cUSD |
|-----------|------|
| Celo      | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| Alfajores | `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1` |
