// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentPassport (self-mint variant)
/// @notice Lightweight on-chain identity for AI agents. Each passport binds an
///         owner EOA (the human / connected wallet) to a dedicated agent EOA
///         and stores a small amount of metadata + a trust score.
/// @dev    Adapted from Team12Web3/agent-passport's AgentPassport so it can be
///         minted directly by the owner wallet (no platform key required).
contract AgentPassport {
    struct Passport {
        uint256 id;
        address owner;
        address agentWallet;
        string metadataURI;
        uint16 trustScore;
        bool active;
        uint256 createdAt;
    }

    mapping(uint256 => Passport) private _passports;
    mapping(address => uint256[]) private _passportsByOwner;
    mapping(address => uint256) public passportByWallet;

    uint256 public nextId = 1;
    uint16 public constant MAX_TRUST = 1000;
    uint16 public constant DEFAULT_TRUST = 50;

    event PassportMinted(
        uint256 indexed id,
        address indexed owner,
        address indexed agentWallet,
        string metadataURI
    );
    event ActiveUpdated(uint256 indexed id, bool active);
    event TrustBumped(uint256 indexed id, uint16 newScore);

    error WalletAlreadyRegistered();
    error PassportNotFound();
    error NotPassportOwner();
    error ZeroAddress();

    /// @notice Mint a passport for `agentWallet`, owned by `msg.sender`.
    /// @param agentWallet The dedicated EOA that represents the agent.
    /// @param metadataURI Free-form metadata pointer (label, ipfs://, https://, json...).
    /// @return id The newly minted passport id.
    function mintPassport(address agentWallet, string calldata metadataURI)
        external
        returns (uint256 id)
    {
        if (agentWallet == address(0)) revert ZeroAddress();
        if (passportByWallet[agentWallet] != 0) revert WalletAlreadyRegistered();

        id = nextId++;
        _passports[id] = Passport({
            id: id,
            owner: msg.sender,
            agentWallet: agentWallet,
            metadataURI: metadataURI,
            trustScore: DEFAULT_TRUST,
            active: true,
            createdAt: block.timestamp
        });
        _passportsByOwner[msg.sender].push(id);
        passportByWallet[agentWallet] = id;

        emit PassportMinted(id, msg.sender, agentWallet, metadataURI);
    }

    /// @notice Toggle whether a passport is active. Only the owner may call.
    function setActive(uint256 id, bool active_) external {
        Passport storage p = _passports[id];
        if (p.owner == address(0)) revert PassportNotFound();
        if (p.owner != msg.sender) revert NotPassportOwner();
        p.active = active_;
        emit ActiveUpdated(id, active_);
    }

    /// @notice Owner-only manual trust bump (handy for the demo). In a full
    ///         deployment this is normally driven by the ActionLog contract.
    function bumpTrust(uint256 id, uint16 delta) external {
        Passport storage p = _passports[id];
        if (p.owner == address(0)) revert PassportNotFound();
        if (p.owner != msg.sender) revert NotPassportOwner();
        uint256 next = uint256(p.trustScore) + uint256(delta);
        if (next > MAX_TRUST) next = MAX_TRUST;
        p.trustScore = uint16(next);
        emit TrustBumped(id, p.trustScore);
    }

    function getPassport(uint256 id) external view returns (Passport memory) {
        Passport memory p = _passports[id];
        if (p.owner == address(0)) revert PassportNotFound();
        return p;
    }

    function passportsOf(address owner) external view returns (uint256[] memory) {
        return _passportsByOwner[owner];
    }

    function verifyAgent(uint256 id, uint16 minScore) external view returns (bool) {
        Passport memory p = _passports[id];
        if (p.owner == address(0)) return false;
        return p.active && p.trustScore >= minScore;
    }
}
