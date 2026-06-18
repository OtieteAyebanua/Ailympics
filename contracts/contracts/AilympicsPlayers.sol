// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AilympicsPlayers
 * @notice 1-of-1 player NFTs for AIlympics. The owner (admin) mints every
 *         player up-front to a treasury wallet; sales happen via PlayerMarketplace.
 *         Token ids are sequential starting at 1.
 */
contract AilympicsPlayers is ERC721URIStorage, Ownable {
    uint256 public nextTokenId = 1;

    constructor(address initialOwner)
        ERC721("Ailympics Players", "AILP")
        Ownable(initialOwner)
    {}

    /// @notice Mint a single player to `to` with metadata at `uri`.
    function mint(address to, string calldata uri) external onlyOwner returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /// @notice Mint many players in one transaction (cheaper than N separate txs).
    function mintBatch(address to, string[] calldata uris)
        external
        onlyOwner
        returns (uint256[] memory ids)
    {
        ids = new uint256[](uris.length);
        for (uint256 i = 0; i < uris.length; i++) {
            uint256 tokenId = nextTokenId++;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);
            ids[i] = tokenId;
        }
    }
}
