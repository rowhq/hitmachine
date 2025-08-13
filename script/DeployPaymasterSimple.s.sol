// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DeployPaymasterSimpleScript is Script, TestExt {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");
        
        console.log("Deploying with deployer:", deployer);
        console.log("Using paymaster:", paymaster);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Configure paymaster for gasless transactions
        bytes memory paymasterInput = abi.encodeWithSelector(
            bytes4(keccak256("general(bytes)")),
            bytes("0x")
        );
        vmExt.zkUsePaymaster(paymaster, paymasterInput);

        // Deploy only MockUSDC for testing
        MockUSDC mockUSDC = new MockUSDC();
        console.log("MockUSDC deployed at:", address(mockUSDC));

        vm.stopBroadcast();
        
        console.log("\n========================================");
        console.log("TEST DEPLOYMENT COMPLETE");
        console.log("========================================");
    }
}