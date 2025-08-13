// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockSOPH} from "../src/MockSOPH.sol";

contract DeployMocksScript is Script {
    function run() external returns (address mockUsdc, address mockSoph) {
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying Mock Tokens with deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDC
        MockUSDC _mockUsdc = new MockUSDC();
        console.log("Mock USDC deployed at:", address(_mockUsdc));

        // Deploy Mock SOPH
        MockSOPH _mockSoph = new MockSOPH();
        console.log("Mock SOPH deployed at:", address(_mockSoph));

        // Mint initial tokens to deployer for testing
        _mockUsdc.mintTo(deployer, 100000 * 10 ** 6); // 100,000 USDC
        console.log("Minted 100,000 USDC to deployer");
        
        _mockSoph.mintTo(deployer, 10000 * 10 ** 18); // 10,000 SOPH
        console.log("Minted 10,000 SOPH to deployer");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("MOCK TOKENS DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("Mock USDC:", address(_mockUsdc));
        console.log("Mock SOPH:", address(_mockSoph));
        console.log("========================================");
        console.log("\nSet these in your .env file:");
        console.log("USDC_ADDRESS=", address(_mockUsdc));
        console.log("SOPH_ADDRESS=", address(_mockSoph));
        console.log("========================================");

        return (address(_mockUsdc), address(_mockSoph));
    }
}