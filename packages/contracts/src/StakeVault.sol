// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StakeVault {
    struct StakePosition {
        uint256 activeStake;
        uint256 totalSlashed;
        uint64 lastStakeAt;
    }

    address public immutable platform;
    mapping(uint256 => StakePosition) private positions;

    event StakeDeposited(
        uint256 indexed passportId,
        address indexed staker,
        uint256 amount,
        uint256 activeStake
    );
    event StakeSlashed(
        uint256 indexed passportId,
        address indexed reporter,
        uint256 amount,
        bytes32 evidenceHash,
        uint256 activeStake
    );

    error NotPlatform();
    error ZeroAmount();
    error InsufficientStake();

    modifier onlyPlatform() {
        if (msg.sender != platform) revert NotPlatform();
        _;
    }

    constructor(address _platform) {
        platform = _platform;
    }

    function depositStake(uint256 passportId) external payable {
        if (msg.value == 0) revert ZeroAmount();

        StakePosition storage position = positions[passportId];
        position.activeStake += msg.value;
        position.lastStakeAt = uint64(block.timestamp);

        emit StakeDeposited(passportId, msg.sender, msg.value, position.activeStake);
    }

    function slashStake(
        uint256 passportId,
        uint256 amount,
        bytes32 evidenceHash
    ) external onlyPlatform {
        if (amount == 0) revert ZeroAmount();

        StakePosition storage position = positions[passportId];
        if (position.activeStake < amount) revert InsufficientStake();

        position.activeStake -= amount;
        position.totalSlashed += amount;

        emit StakeSlashed(
            passportId,
            msg.sender,
            amount,
            evidenceHash,
            position.activeStake
        );
    }

    function getStake(
        uint256 passportId
    ) external view returns (uint256 activeStake, uint256 totalSlashed, uint64 lastStakeAt) {
        StakePosition memory position = positions[passportId];
        return (position.activeStake, position.totalSlashed, position.lastStakeAt);
    }
}
