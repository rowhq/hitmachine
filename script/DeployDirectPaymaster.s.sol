// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DeployDirectPaymasterScript is Script, TestExt {
    uint256 constant INITIAL_GIFTCARD_PRICE = 32e6; // 32 USDC with 6 decimals

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address paymaster = vm.envAddress("PAYMASTER_ADDRESS");
        
        console.log("========================================");
        console.log("Deploying with paymaster (gasless)");
        console.log("Deployer:", deployer);
        console.log("Paymaster:", paymaster);
        console.log("========================================");
        
        // Get initial balance
        uint256 initialBalance = deployer.balance;
        console.log("Initial balance:", initialBalance, "wei");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Configure paymaster for ALL transactions
        bytes memory paymasterInput = abi.encodeWithSelector(
            bytes4(keccak256("general(bytes)")),
            bytes("0x")
        );
        vmExt.zkUsePaymaster(paymaster, paymasterInput);

        // Deploy MockUSDC first
        console.log("\nDeploying MockUSDC...");
        MockUSDC mockUSDC = new MockUSDC();
        console.log("MockUSDC deployed at:", address(mockUSDC));

        // Deploy Store implementation only (no proxy)
        console.log("\nDeploying StoreV2 implementation...");
        StoreV2 storeImpl = new StoreV2();
        console.log("StoreV2 implementation deployed at:", address(storeImpl));

        // Deploy Jobs implementation only (no proxy)  
        console.log("\nDeploying JobsV2 implementation...");
        JobsV2 jobsImpl = new JobsV2();
        console.log("JobsV2 implementation deployed at:", address(jobsImpl));

        vm.stopBroadcast();
        
        // Check final balance
        uint256 finalBalance = deployer.balance;
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("Initial balance:", initialBalance, "wei");
        console.log("Final balance:", finalBalance, "wei");
        if (initialBalance == finalBalance) {
            console.log("SUCCESS: No gas spent - Paymaster worked!");
        } else {
            console.log("WARNING: Gas was spent:", initialBalance - finalBalance, "wei");
        }
        console.log("========================================");
        
        // Save addresses
        string memory addresses = string.concat(
            "MOCK_USDC=", vm.toString(address(mockUSDC)), "\n",
            "STORE_IMPL=", vm.toString(address(storeImpl)), "\n", 
            "JOBS_IMPL=", vm.toString(address(jobsImpl)), "\n"
        );
        vm.writeFile("deployed-direct-testnet.txt", addresses);
    }
}