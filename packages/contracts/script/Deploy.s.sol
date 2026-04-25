// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {ActionLog} from "../src/ActionLog.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PLATFORM_PRIVATE_KEY");
        address platform = vm.addr(pk);
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(pk);
        AgentPassport passport = new AgentPassport(platform);
        ActionLog logContract  = new ActionLog(address(passport), usdc);
        passport.setActionLog(address(logContract));
        vm.stopBroadcast();

        console.log("Platform:      ", platform);
        console.log("AgentPassport: ", address(passport));
        console.log("ActionLog:     ", address(logContract));
        console.log("USDC:          ", usdc);
        console.log("ChainId:       ", block.chainid);
    }
}
