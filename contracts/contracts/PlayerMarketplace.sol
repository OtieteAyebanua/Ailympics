// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PlayerMarketplace
 * @notice Marketplace for AIlympics player NFTs, priced in an ERC-20 (cUSD).
 *
 * Handles BOTH:
 *   - Primary sales — your treasury lists freshly-minted players.
 *   - Secondary sales — any owner relists a player they bought.
 *
 * Every sale takes a platform cut (`feeBps`) that goes to `feeRecipient` (you);
 * the remainder goes to the seller. On a primary sale where the treasury and the
 * fee recipient are the same wallet, that wallet simply receives 100%.
 *
 * Requirements:
 *   - Seller must approve this contract for the token
 *     (approve(marketplace, tokenId) or setApprovalForAll(marketplace, true)).
 *   - Buyer must approve this contract to spend `price` of the pay token.
 */
contract PlayerMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC721 public immutable nft;
    IERC20  public immutable payToken; // e.g. cUSD

    /// Platform cut in basis points (1% = 100). Hard-capped at 10%.
    uint96 public feeBps;
    address public feeRecipient;

    uint96 public constant MAX_FEE_BPS = 1_000; // 10%
    uint96 public constant BPS_DENOMINATOR = 10_000;

    struct Listing {
        address seller;
        uint256 price; // in payToken's smallest unit (cUSD = 18 decimals)
    }

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event Unlisted(uint256 indexed tokenId, address indexed seller);
    event Purchased(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        uint256 fee
    );
    event FeeUpdated(uint96 feeBps, address feeRecipient);

    constructor(
        address nft_,
        address payToken_,
        address feeRecipient_,
        uint96 feeBps_,
        address owner_
    ) Ownable(owner_) {
        require(nft_ != address(0) && payToken_ != address(0) && feeRecipient_ != address(0), "zero addr");
        require(feeBps_ <= MAX_FEE_BPS, "fee too high");
        nft = IERC721(nft_);
        payToken = IERC20(payToken_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    // ── Admin ───────────────────────────────────────────────────────────────

    /// @notice Update the platform cut and where it's paid. Owner only.
    function setFee(uint96 feeBps_, address feeRecipient_) external onlyOwner {
        require(feeBps_ <= MAX_FEE_BPS, "fee too high");
        require(feeRecipient_ != address(0), "zero addr");
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    // ── Listing (callable by whoever owns the token) ──────────────────────────

    function list(uint256 tokenId, uint256 price) public {
        require(price > 0, "price=0");
        require(nft.ownerOf(tokenId) == msg.sender, "not token owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "marketplace not approved"
        );
        listings[tokenId] = Listing(msg.sender, price);
        emit Listed(tokenId, msg.sender, price);
    }

    function listBatch(uint256[] calldata ids, uint256[] calldata prices) external {
        require(ids.length == prices.length, "length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            list(ids[i], prices[i]);
        }
    }

    /// @notice Remove a listing. Callable by the seller, or the owner (moderation).
    function unlist(uint256 tokenId) external {
        Listing memory l = listings[tokenId];
        require(l.seller != address(0), "not listed");
        require(msg.sender == l.seller || msg.sender == owner(), "not seller");
        delete listings[tokenId];
        emit Unlisted(tokenId, l.seller);
    }

    // ── Buy ───────────────────────────────────────────────────────────────────

    /// @notice Buy a listed token. Buyer must have approved `price` of payToken.
    function buy(uint256 tokenId) external nonReentrant {
        Listing memory l = listings[tokenId];
        require(l.price > 0, "not for sale");
        require(msg.sender != l.seller, "cannot buy own listing");
        // Listing can go stale if the seller transferred the token elsewhere.
        require(nft.ownerOf(tokenId) == l.seller, "seller no longer owns token");

        // Effects before interactions.
        delete listings[tokenId];

        uint256 fee = (l.price * feeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = l.price - fee;

        // Pull payment: platform cut to you, the rest to the seller.
        if (fee > 0) {
            payToken.safeTransferFrom(msg.sender, feeRecipient, fee);
        }
        payToken.safeTransferFrom(msg.sender, l.seller, sellerProceeds);

        // Deliver the NFT.
        nft.safeTransferFrom(l.seller, msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, l.price, fee);
    }
}
