// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentPassport {
    struct Passport {
        address owner;
        address agentWallet;
        string  metadataURI;
        bool    active;
        uint64  createdAt;
        uint16  trustScore;
    }

    address public immutable platform;
    address public actionLog;
    uint256 public nextId = 1;

    mapping(uint256 => Passport) public passports;
    mapping(address => uint256[]) public agentsByOwner;
    mapping(address => uint256)   public passportByWallet;

    event PassportMinted(uint256 indexed id, address indexed owner, address indexed agentWallet);
    event PassportStatusChanged(uint256 indexed id, bool active);
    event TrustScoreChanged(uint256 indexed id, uint16 newScore);
    event ActionLogSet(address indexed actionLog);

    error NotPlatform();
    error NotPlatformOrOwner();
    error NotActionLog();
    error WalletAlreadyRegistered();
    error UnknownPassport();
    error ActionLogAlreadySet();

    modifier onlyPlatform() {
        if (msg.sender != platform) revert NotPlatform();
        _;
    }

    modifier onlyActionLog() {
        if (msg.sender != actionLog) revert NotActionLog();
        _;
    }

    constructor(address _platform) {
        platform = _platform;
    }

    function setActionLog(address _actionLog) external onlyPlatform {
        if (actionLog != address(0)) revert ActionLogAlreadySet();
        actionLog = _actionLog;
        emit ActionLogSet(_actionLog);
    }

    function mintPassport(
        address owner,
        address agentWallet,
        string calldata metadataURI
    ) external onlyPlatform returns (uint256 id) {
        if (passportByWallet[agentWallet] != 0) revert WalletAlreadyRegistered();

        id = nextId++;
        passports[id] = Passport({
            owner:       owner,
            agentWallet: agentWallet,
            metadataURI: metadataURI,
            active:      true,
            createdAt:   uint64(block.timestamp),
            trustScore:  50
        });
        agentsByOwner[owner].push(id);
        passportByWallet[agentWallet] = id;

        emit PassportMinted(id, owner, agentWallet);
    }

    function setActive(uint256 id, bool active_) external {
        Passport storage p = passports[id];
        if (p.agentWallet == address(0)) revert UnknownPassport();
        if (msg.sender != platform && msg.sender != p.owner) revert NotPlatformOrOwner();

        p.active = active_;
        emit PassportStatusChanged(id, active_);
    }

    function bumpTrust(uint256 id, uint16 delta) external onlyActionLog {
        Passport storage p = passports[id];
        if (p.agentWallet == address(0)) revert UnknownPassport();

        uint256 next = uint256(p.trustScore) + uint256(delta);
        if (next > 100) next = 100;
        p.trustScore = uint16(next);
        emit TrustScoreChanged(id, p.trustScore);
    }

    function getPassport(uint256 id) external view returns (Passport memory) {
        return passports[id];
    }

    function passportsOf(address owner) external view returns (uint256[] memory) {
        return agentsByOwner[owner];
    }
}
