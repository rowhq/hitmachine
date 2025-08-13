// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TestExt} from "../lib/forge-zksync-std/src/TestExt.sol";

contract DeployMainnetScript is Script, TestExt {
    uint256 constant INITIAL_GIFTCARD_PRICE = 32e6; // 32 USDC with 6 decimals

    // Sophon Mainnet USDC address (official)
    address constant MAINNET_USDC = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;
    address constant MAINNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    function run() external returns (address storeProxy) {
        // Get configuration from environment
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Use mainnet USDC address or environment override
        address usdcAddress = vm.envOr("USDC_ADDRESS", MAINNET_USDC);

        console.log("Deploying to Sophon Mainnet with:");
        console.log("  Deployer:", deployer);
        console.log("  USDC:", usdcAddress);
        console.log("  Paymaster:", MAINNET_PAYMASTER);

        vm.startBroadcast(deployerPrivateKey);

        // Setup paymaster for gasless transactions
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));
        vmExt.zkUsePaymaster(MAINNET_PAYMASTER, paymasterInput);

        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));

        // Deploy Store proxy
        bytes memory storeInitData =
            abi.encodeWithSelector(StoreV2.initialize.selector, usdcAddress, deployer, INITIAL_GIFTCARD_PRICE);
        ERC1967Proxy _storeProxy = new ERC1967Proxy(address(storeImpl), storeInitData);
        console.log("Store proxy deployed at:", address(_storeProxy));

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("MAINNET DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("Network: Sophon Mainnet");
        console.log("USDC Address:", usdcAddress);
        console.log("Store Proxy:", address(_storeProxy));
        console.log("Store Implementation:", address(storeImpl));
        console.log("Admin:", deployer);
        console.log("Initial Gift Card Price: 32 USDC");
        console.log("========================================");
        console.log("\nFrontend configuration:");
        console.log("[SUCCESS] Auto-updated frontend/.env.local with:");
        console.log("  NEXT_PUBLIC_STORE_CONTRACT=", address(_storeProxy));
        console.log("  NEXT_PUBLIC_USDC_ADDRESS=", usdcAddress);
        console.log("========================================");

        // Save deployment info to file
        string memory deploymentInfo = string.concat(
            "# Sophon Mainnet Deployment\n",
            "STORE_PROXY=",
            vm.toString(address(_storeProxy)),
            "\n",
            "STORE_IMPL=",
            vm.toString(address(storeImpl)),
            "\n",
            "USDC_ADDRESS=",
            vm.toString(usdcAddress),
            "\n",
            "ADMIN=",
            vm.toString(deployer),
            "\n"
        );
        vm.writeFile("deployed-addresses-mainnet.txt", deploymentInfo);
        
        // Write frontend env file
        string memory frontendEnv = string.concat(
            "# Auto-generated from DeployMainnet.s.sol\n",
            "NEXT_PUBLIC_STORE_CONTRACT=",
            vm.toString(address(_storeProxy)),
            "\n",
            "NEXT_PUBLIC_USDC_ADDRESS=",
            vm.toString(usdcAddress),
            "\n",
            "NEXT_PUBLIC_NETWORK=mainnet\n"
        );
        vm.writeFile("frontend/.env.local", frontendEnv);

        return address(_storeProxy);
    }
}
