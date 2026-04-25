// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentPassport {
    struct Passport {
        address owner;
        string agentId;
        uint256 score;
        bool active;
    }

    mapping(string => Passport) public passports;

    function createPassport(string calldata agentId) external {
        Passport storage p = passports[agentId];
        require(p.owner == address(0), "Passport already exists");

        passports[agentId] = Passport({
            owner: msg.sender,
            agentId: agentId,
            score: 100,
            active: true
        });
    }

    function verifyAgent(string calldata agentId, uint256 minScore) external view returns (bool) {
        Passport storage p = passports[agentId];
        return p.active && p.score >= minScore;
    }

    function updateScore(string calldata agentId, uint256 newScore) external {
        Passport storage p = passports[agentId];
        require(p.owner == msg.sender, "Not owner");
        p.score = newScore;
    }

    function getPassport(string calldata agentId)
        external
        view
        returns (address owner, string memory storedAgentId, uint256 score, bool active)
    {
        Passport storage p = passports[agentId];
        return (p.owner, p.agentId, p.score, p.active);
    }
}

