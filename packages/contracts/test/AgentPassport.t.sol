// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {AgentPassport} from "../src/AgentPassport.sol";

contract AgentPassportTest is Test {
    AgentPassport passport;

    address platform = address(0xA11CE);
    address actionLog = address(0xAC10);
    address user1    = address(0xB0B);
    address user2    = address(0xCAFE);
    address agentW1  = address(0xDA7A);
    address agentW2  = address(0xDA7B);

    function setUp() public {
        vm.prank(platform);
        passport = new AgentPassport(platform);
        vm.prank(platform);
        passport.setActionLog(actionLog);
    }

    function test_MintByPlatformSucceeds() public {
        vm.prank(platform);
        uint256 id = passport.mintPassport(user1, agentW1, "ipfs://meta");
        assertEq(id, 1);

        AgentPassport.Passport memory p = passport.getPassport(id);
        assertEq(p.owner, user1);
        assertEq(p.agentWallet, agentW1);
        assertTrue(p.active);
        assertEq(p.trustScore, 50);
        assertEq(p.metadataURI, "ipfs://meta");
    }

    function test_MintByNonPlatformReverts() public {
        vm.prank(user1);
        vm.expectRevert(AgentPassport.NotPlatform.selector);
        passport.mintPassport(user1, agentW1, "x");
    }

    function test_MintDuplicateAgentWalletReverts() public {
        vm.prank(platform);
        passport.mintPassport(user1, agentW1, "x");
        vm.prank(platform);
        vm.expectRevert(AgentPassport.WalletAlreadyRegistered.selector);
        passport.mintPassport(user2, agentW1, "y");
    }

    function test_SetActiveByPlatform() public {
        vm.prank(platform);
        uint256 id = passport.mintPassport(user1, agentW1, "x");
        vm.prank(platform);
        passport.setActive(id, false);
        assertFalse(passport.getPassport(id).active);
    }

    function test_SetActiveByOwner() public {
        vm.prank(platform);
        uint256 id = passport.mintPassport(user1, agentW1, "x");
        vm.prank(user1);
        passport.setActive(id, false);
        assertFalse(passport.getPassport(id).active);
    }

    function test_SetActiveByStranger_Reverts() public {
        vm.prank(platform);
        uint256 id = passport.mintPassport(user1, agentW1, "x");
        vm.prank(user2);
        vm.expectRevert(AgentPassport.NotPlatformOrOwner.selector);
        passport.setActive(id, false);
    }

    function test_PassportsOf_ReturnsIds() public {
        vm.startPrank(platform);
        uint256 id1 = passport.mintPassport(user1, agentW1, "x");
        uint256 id2 = passport.mintPassport(user1, agentW2, "y");
        vm.stopPrank();

        uint256[] memory ids = passport.passportsOf(user1);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }

    function test_BumpTrust_OnlyActionLog() public {
        vm.prank(platform);
        uint256 id = passport.mintPassport(user1, agentW1, "x");

        vm.prank(user1);
        vm.expectRevert(AgentPassport.NotActionLog.selector);
        passport.bumpTrust(id, 1);

        vm.prank(actionLog);
        passport.bumpTrust(id, 10);
        assertEq(passport.getPassport(id).trustScore, 60);
    }

    function test_BumpTrust_CapsAt100() public {
        vm.prank(platform);
        uint256 id = passport.mintPassport(user1, agentW1, "x");

        vm.prank(actionLog);
        passport.bumpTrust(id, 200);
        assertEq(passport.getPassport(id).trustScore, 100);

        vm.prank(actionLog);
        passport.bumpTrust(id, 5);
        assertEq(passport.getPassport(id).trustScore, 100);
    }

    function test_SetActionLog_OnlyOnce() public {
        vm.prank(platform);
        vm.expectRevert(AgentPassport.ActionLogAlreadySet.selector);
        passport.setActionLog(address(0xBEEF));
    }
}
