// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentPassport
/// @notice Minimal non-transferable identity passport for AI agents.
/// @dev This is hackathon-grade code. Audit before production use.
contract AgentPassport is ERC721, Ownable {
    error AgentWalletZero();
    error NotPassportController();
    error PassportInactive();
    error SoulboundToken();
    error PassportDoesNotExist();

    struct Passport {
        address controller;
        address agentWallet;
        string metadataURI;
        bytes32 capabilitiesHash;
        bool active;
        uint256 createdAt;
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 tokenId => Passport passport) private _passports;

    event PassportMinted(
        uint256 indexed tokenId,
        address indexed controller,
        address indexed agentWallet,
        string metadataURI,
        bytes32 capabilitiesHash
    );

    event PassportRevoked(uint256 indexed tokenId, address indexed controller);

    event PassportUpdated(
        uint256 indexed tokenId,
        address indexed controller,
        string metadataURI,
        bytes32 capabilitiesHash
    );

    event AccessRecorded(
        uint256 indexed tokenId,
        address indexed agentWallet,
        bytes32 indexed targetHash,
        bytes32 intentHash,
        uint256 timestamp
    );

    constructor() ERC721("Agent Passport", "APASS") Ownable(msg.sender) {}

    function mintPassport(
        address agentWallet,
        string calldata metadataURI,
        bytes32 capabilitiesHash
    ) external returns (uint256 tokenId) {
        if (agentWallet == address(0)) revert AgentWalletZero();

        tokenId = _nextTokenId++;

        _passports[tokenId] = Passport({
            controller: msg.sender,
            agentWallet: agentWallet,
            metadataURI: metadataURI,
            capabilitiesHash: capabilitiesHash,
            active: true,
            createdAt: block.timestamp
        });

        _safeMint(msg.sender, tokenId);

        emit PassportMinted(tokenId, msg.sender, agentWallet, metadataURI, capabilitiesHash);
    }

    function updatePassport(
        uint256 tokenId,
        string calldata metadataURI,
        bytes32 capabilitiesHash
    ) external {
        Passport storage passport = _requirePassport(tokenId);
        if (passport.controller != msg.sender) revert NotPassportController();
        if (!passport.active) revert PassportInactive();

        passport.metadataURI = metadataURI;
        passport.capabilitiesHash = capabilitiesHash;

        emit PassportUpdated(tokenId, msg.sender, metadataURI, capabilitiesHash);
    }

    function revokePassport(uint256 tokenId) external {
        Passport storage passport = _requirePassport(tokenId);
        if (passport.controller != msg.sender) revert NotPassportController();
        if (!passport.active) revert PassportInactive();

        passport.active = false;

        emit PassportRevoked(tokenId, msg.sender);
    }

    function getPassport(uint256 tokenId) external view returns (Passport memory) {
        return _requirePassportView(tokenId);
    }

    function isValidAgent(uint256 tokenId, address agentWallet) public view returns (bool) {
        Passport memory passport = _passports[tokenId];

        if (passport.controller == address(0)) return false;

        return passport.active && passport.agentWallet == agentWallet && _ownerOf(tokenId) != address(0);
    }

    /// @notice Optional demo event proving Avalanche can record access events.
    /// @dev Any caller can emit this event for a currently valid agent passport.
    function recordAccess(
        uint256 tokenId,
        address agentWallet,
        bytes32 targetHash,
        bytes32 intentHash
    ) external {
        if (!isValidAgent(tokenId, agentWallet)) revert PassportInactive();

        emit AccessRecorded(tokenId, agentWallet, targetHash, intentHash, block.timestamp);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        Passport memory passport = _requirePassportView(tokenId);
        return passport.metadataURI;
    }

    /// @dev OpenZeppelin Contracts v5 transfer hook. Allows mint/burn, blocks transfer.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address from) {
        from = _ownerOf(tokenId);

        bool isMint = from == address(0);
        bool isBurn = to == address(0);

        if (!isMint && !isBurn) revert SoulboundToken();

        return super._update(to, tokenId, auth);
    }

    function _requirePassport(uint256 tokenId) internal view returns (Passport storage passport) {
        passport = _passports[tokenId];
        if (passport.controller == address(0)) revert PassportDoesNotExist();
    }

    function _requirePassportView(uint256 tokenId) internal view returns (Passport memory passport) {
        passport = _passports[tokenId];
        if (passport.controller == address(0)) revert PassportDoesNotExist();
    }
}
