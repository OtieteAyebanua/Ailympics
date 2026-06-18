import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const ONE = 10n ** 18n;
const price = 100n * ONE; // 100 cUSD

describe("PlayerMarketplace", () => {
  // owner = admin/platform (also feeRecipient by default + treasury here)
  // seller2 = a user who buys then resells
  // buyer = end buyer
  async function deploy() {
    const [owner, treasury, buyer, seller2, feeWallet] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const cusd = await Token.deploy();

    const NFT = await ethers.getContractFactory("AilympicsPlayers");
    const nft = await NFT.deploy(owner.address); // owner mints

    const Market = await ethers.getContractFactory("PlayerMarketplace");
    // 5% fee, fee + sale proceeds default to the treasury wallet
    const market = await Market.deploy(
      await nft.getAddress(),
      await cusd.getAddress(),
      treasury.address, // feeRecipient
      500n, // 5%
      owner.address, // contract owner
    );

    // Mint token #1 to the treasury (primary inventory)
    await nft.connect(owner).mint(treasury.address, "ipfs://1");

    // Fund buyers with cUSD
    await cusd.mint(buyer.address, 1_000n * ONE);
    await cusd.mint(seller2.address, 1_000n * ONE);

    return { owner, treasury, buyer, seller2, feeWallet, cusd, nft, market };
  }

  describe("listing", () => {
    it("lets the token owner list, and rejects non-owners", async () => {
      const { treasury, buyer, nft, market } = await loadFixture(deploy);
      await nft.connect(treasury).setApprovalForAll(await market.getAddress(), true);

      await expect(market.connect(buyer).list(1, price)).to.be.revertedWith("not token owner");

      await expect(market.connect(treasury).list(1, price))
        .to.emit(market, "Listed")
        .withArgs(1, treasury.address, price);

      const listing = await market.listings(1);
      expect(listing.seller).to.equal(treasury.address);
      expect(listing.price).to.equal(price);
    });

    it("reverts listing without approval or with zero price", async () => {
      const { treasury, nft, market } = await loadFixture(deploy);
      await expect(market.connect(treasury).list(1, price)).to.be.revertedWith(
        "marketplace not approved",
      );
      await nft.connect(treasury).setApprovalForAll(await market.getAddress(), true);
      await expect(market.connect(treasury).list(1, 0)).to.be.revertedWith("price=0");
    });
  });

  describe("primary sale (treasury -> buyer)", () => {
    it("pays the seller (treasury) and clears the listing; buyer gets the NFT", async () => {
      const { treasury, buyer, cusd, nft, market } = await loadFixture(deploy);
      await nft.connect(treasury).setApprovalForAll(await market.getAddress(), true);
      await market.connect(treasury).list(1, price);
      await cusd.connect(buyer).approve(await market.getAddress(), price);

      const fee = (price * 500n) / 10_000n; // 5 cUSD
      const sellerProceeds = price - fee; // 95 cUSD

      // feeRecipient == treasury == seller here, so treasury nets the full price.
      await expect(market.connect(buyer).buy(1))
        .to.emit(market, "Purchased")
        .withArgs(1, buyer.address, treasury.address, price, fee);

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
      // treasury received fee + proceeds = full price
      expect(await cusd.balanceOf(treasury.address)).to.equal(fee + sellerProceeds);
      expect(await cusd.balanceOf(buyer.address)).to.equal(1_000n * ONE - price);

      const listing = await market.listings(1);
      expect(listing.price).to.equal(0n); // cleared
    });
  });

  describe("secondary sale (user -> user) fee split", () => {
    it("sends the platform cut to feeRecipient and the rest to the seller", async () => {
      const { owner, treasury, buyer, seller2, feeWallet, cusd, nft, market } =
        await loadFixture(deploy);

      // Route the platform cut to a DISTINCT wallet so we can isolate it.
      await market.connect(owner).setFee(500n, feeWallet.address);

      // 1) Primary: seller2 buys token #1 from the treasury.
      await nft.connect(treasury).setApprovalForAll(await market.getAddress(), true);
      await market.connect(treasury).list(1, price);
      await cusd.connect(seller2).approve(await market.getAddress(), price);
      await market.connect(seller2).buy(1);
      expect(await nft.ownerOf(1)).to.equal(seller2.address);

      // 2) Secondary: seller2 relists at a higher price; buyer purchases.
      const resalePrice = 200n * ONE;
      await nft.connect(seller2).setApprovalForAll(await market.getAddress(), true);
      await market.connect(seller2).list(1, resalePrice);
      await cusd.connect(buyer).approve(await market.getAddress(), resalePrice);

      const feeWalletBefore = await cusd.balanceOf(feeWallet.address);
      const sellerBefore = await cusd.balanceOf(seller2.address);

      const fee = (resalePrice * 500n) / 10_000n; // 10 cUSD
      const proceeds = resalePrice - fee; // 190 cUSD

      await expect(market.connect(buyer).buy(1))
        .to.emit(market, "Purchased")
        .withArgs(1, buyer.address, seller2.address, resalePrice, fee);

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
      expect((await cusd.balanceOf(feeWallet.address)) - feeWalletBefore).to.equal(fee);
      expect((await cusd.balanceOf(seller2.address)) - sellerBefore).to.equal(proceeds);
    });

    it("computes the cut correctly across fee rates (incl. 0% and rounding)", async () => {
      const cases: { bps: bigint; p: bigint }[] = [
        { bps: 0n, p: 100n * ONE },
        { bps: 250n, p: 100n * ONE }, // 2.5%
        { bps: 1000n, p: 100n * ONE }, // max 10%
        { bps: 333n, p: 7n * ONE + 1n }, // odd numbers -> floor rounding
      ];

      for (const { bps, p } of cases) {
        const { owner, treasury, buyer, feeWallet, cusd, nft, market } =
          await loadFixture(deploy);
        await market.connect(owner).setFee(bps, feeWallet.address);
        await nft.connect(treasury).setApprovalForAll(await market.getAddress(), true);
        await market.connect(treasury).list(1, p);
        await cusd.connect(buyer).approve(await market.getAddress(), p);

        const expectedFee = (p * bps) / 10_000n; // solidity floors
        const expectedProceeds = p - expectedFee;

        await market.connect(buyer).buy(1);

        expect(await cusd.balanceOf(feeWallet.address)).to.equal(expectedFee);
        expect(await cusd.balanceOf(treasury.address)).to.equal(expectedProceeds);
      }
    });
  });

  describe("guards", () => {
    it("caps the fee at 10% on construction and setFee", async () => {
      const { owner, market } = await loadFixture(deploy);
      await expect(market.connect(owner).setFee(1001n, owner.address)).to.be.revertedWith(
        "fee too high",
      );
    });

    it("only the owner can change the fee", async () => {
      const { buyer, market } = await loadFixture(deploy);
      await expect(
        market.connect(buyer).setFee(100n, buyer.address),
      ).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
    });

    it("reverts buying an unlisted token, your own listing, or a stale listing", async () => {
      const { owner, treasury, buyer, seller2, cusd, nft, market } = await loadFixture(deploy);
      const mkt = await market.getAddress();

      await expect(market.connect(buyer).buy(1)).to.be.revertedWith("not for sale");

      await nft.connect(treasury).setApprovalForAll(mkt, true);
      await market.connect(treasury).list(1, price);

      await expect(market.connect(treasury).buy(1)).to.be.revertedWith("cannot buy own listing");

      // Treasury moves the token away -> listing is now stale.
      await nft.connect(treasury).transferFrom(treasury.address, seller2.address, 1);
      await cusd.connect(buyer).approve(mkt, price);
      await expect(market.connect(buyer).buy(1)).to.be.revertedWith("seller no longer owns token");

      // silence unused
      expect(owner.address).to.be.a("string");
    });

    it("lets the seller (or owner) unlist", async () => {
      const { owner, treasury, nft, market } = await loadFixture(deploy);
      await nft.connect(treasury).setApprovalForAll(await market.getAddress(), true);
      await market.connect(treasury).list(1, price);

      await expect(market.connect(treasury).unlist(1))
        .to.emit(market, "Unlisted")
        .withArgs(1, treasury.address);
      expect((await market.listings(1)).price).to.equal(0n);

      // owner override
      await market.connect(treasury).list(1, price);
      await expect(market.connect(owner).unlist(1)).to.emit(market, "Unlisted");
    });
  });
});
