// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAgentPassport {
    struct Passport {
        address owner;
        address agentWallet;
        string  metadataURI;
        bool    active;
        uint64  createdAt;
        uint16  trustScore;
    }

    function getPassport(uint256 id) external view returns (Passport memory);
    function bumpTrust(uint256 id, uint16 delta) external;
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ActionLog {
    IAgentPassport public immutable passportContract;
    IERC20         public immutable feeToken;
    uint256        public actionCount;

    event ActionLogged(
        uint256 indexed passportId,
        address indexed agentWallet,
        bytes32 taskHash,
        bytes32 actionsRoot,
        uint256 feeAmount,
        address beneficiary,
        uint256 blockTimestamp
    );

    error WrongAgent();
    error PassportInactive();
    error FeeTransferFailed();

    constructor(address _passport, address _feeToken) {
        passportContract = IAgentPassport(_passport);
        feeToken         = IERC20(_feeToken);
    }

    function logAction(
        uint256 passportId,
        bytes32 taskHash,
        bytes32 actionsRoot,
        uint256 feeAmount,
        address beneficiary
    ) external {
        IAgentPassport.Passport memory p = passportContract.getPassport(passportId);
        if (msg.sender != p.agentWallet) revert WrongAgent();
        if (!p.active) revert PassportInactive();

        if (feeAmount > 0) {
            bool ok = feeToken.transferFrom(msg.sender, beneficiary, feeAmount);
            if (!ok) revert FeeTransferFailed();
        }

        unchecked { actionCount += 1; }

        passportContract.bumpTrust(passportId, 1);

        emit ActionLogged(
            passportId,
            msg.sender,
            taskHash,
            actionsRoot,
            feeAmount,
            beneficiary,
            block.timestamp
        );
    }
}
