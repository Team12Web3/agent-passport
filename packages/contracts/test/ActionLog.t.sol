// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {ActionLog} from "../src/ActionLog.sol";
import {MockUSDC} from "./MockUSDC.sol";

contract ActionLogTest is Test {
    // Mirror of ActionLog.ActionLogged so vm.expectEmit can match it without
    // a contract-qualified reference (Solidity 0.8.20 doesn't resolve those).
    event ActionLogged(
        uint256 indexed passportId,
        address indexed agentWallet,
        bytes32 taskHash,
        bytes32 actionsRoot,
        uint256 feeAmount,
        address beneficiary,
        uint256 blockTimestamp
    );

    AgentPassport passport;
    ActionLog logContract;
    MockUSDC usdc;

    address platform = address(0xA11CE);
    address user     = address(0xB0B);
    uint256 agentPk  = 0xA1;
    address agentW;
    address beneficiary = address(0xBEEF);

    bytes32 taskHash    = keccak256("task");
    bytes32 actionsRoot = keccak256("actions");

    function setUp() public {
        agentW = vm.addr(agentPk);

        vm.prank(platform);
        passport = new AgentPassport(platform);

        usdc = new MockUSDC();
        logContract  = new ActionLog(address(passport), address(usdc));

        vm.prank(platform);
        passport.setActionLog(address(logContract));

        vm.prank(platform);
        passport.mintPassport(user, agentW, "x");

        usdc.mint(agentW, 1_000_000); // 1 USDC

        vm.prank(agentW);
        usdc.approve(address(logContract), type(uint256).max);
    }

    function test_LogAction_Succeeds_AsAgentWallet() public {
        vm.prank(agentW);
        logContract.logAction(1, taskHash, actionsRoot, 0, beneficiary);
        assertEq(logContract.actionCount(), 1);
        assertEq(passport.getPassport(1).trustScore, 51);
    }

    function test_LogAction_RevertsWhenNotAgentWallet() public {
        vm.prank(user);
        vm.expectRevert(ActionLog.WrongAgent.selector);
        logContract.logAction(1, taskHash, actionsRoot, 0, beneficiary);
    }

    function test_LogAction_RevertsWhenInactive() public {
        vm.prank(platform);
        passport.setActive(1, false);

        vm.prank(agentW);
        vm.expectRevert(ActionLog.PassportInactive.selector);
        logContract.logAction(1, taskHash, actionsRoot, 0, beneficiary);
    }

    function test_LogAction_TransfersFee() public {
        uint256 fee = 100_000; // 0.10 USDC
        vm.prank(agentW);
        logContract.logAction(1, taskHash, actionsRoot, fee, beneficiary);

        assertEq(usdc.balanceOf(beneficiary), fee);
        assertEq(usdc.balanceOf(agentW), 1_000_000 - fee);
    }

    function test_LogAction_ZeroFee_SkipsTransfer() public {
        vm.prank(agentW);
        logContract.logAction(1, taskHash, actionsRoot, 0, beneficiary);
        assertEq(usdc.balanceOf(beneficiary), 0);
        assertEq(usdc.balanceOf(agentW), 1_000_000);
    }

    function test_ActionLogged_EventFields() public {
        vm.expectEmit(true, true, false, true, address(logContract));
        emit ActionLogged(
            1,
            agentW,
            taskHash,
            actionsRoot,
            100_000,
            beneficiary,
            block.timestamp
        );

        vm.prank(agentW);
        logContract.logAction(1, taskHash, actionsRoot, 100_000, beneficiary);
    }
}
