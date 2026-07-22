// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std-1.9.6/src/Script.sol";
import {CommunityVault} from "../src/CommunityVault.sol";

/// @notice Deploys CommunityVault with a 10 ETH goal and a 7-day deadline from now.
contract DeployCommunityVault is Script {
    function run() external returns (CommunityVault) {
        uint256 goal = 10 ether;
        uint256 deadline = block.timestamp + 7 days;

        vm.startBroadcast();
        CommunityVault vault = new CommunityVault(goal, deadline, "Vault Receipt", "VRT");
        vm.stopBroadcast();

        console.log("CommunityVault deployed at:", address(vault));
        console.log("Goal (wei):", goal);
        console.log("Deadline (unix ts):", deadline);

        return vault;
    }
}
