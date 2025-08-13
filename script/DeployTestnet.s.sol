// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockSOPH} from "../src/MockSOPH.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployTestnetScript is Script {
    uint256 constant INITIAL_ALBUM_PRICE = 10_000; // 0.01 USDC with 6 decimals

    function run() external {
        // Try to get PRIVATE_KEY, fall back to WALLET_PRIVATE_KEY
        uint256 deployerPrivateKey;
        if (vm.envExists("PRIVATE_KEY")) {
            deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        } else {
            deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        }
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying to Sophon Testnet with deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDC
        MockUSDC mockUsdc = new MockUSDC();
        console.log("Mock USDC deployed at:", address(mockUsdc));

        // Deploy Mock SOPH
        MockSOPH mockSoph = new MockSOPH();
        console.log("Mock SOPH deployed at:", address(mockSoph));

        // Mint initial tokens to deployer for testing
        mockUsdc.mintTo(deployer, 10000 * 10 ** 6); // 10,000 USDC
        console.log("Minted 10,000 USDC to deployer");
        
        mockSoph.mintTo(deployer, 1000 * 10 ** 18); // 1,000 SOPH
        console.log("Minted 1,000 SOPH to deployer");

        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));

        // Deploy Store proxy
        bytes memory storeInitData =
            abi.encodeWithSelector(StoreV2.initialize.selector, address(mockUsdc), deployer, INITIAL_ALBUM_PRICE);
        ERC1967Proxy storeProxy = new ERC1967Proxy(address(storeImpl), storeInitData);
        console.log("Store proxy deployed at:", address(storeProxy));

        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));

        // Deploy Jobs proxy
        bytes memory jobsInitData = abi.encodeWithSelector(
            JobsV2.initialize.selector,
            address(mockUsdc),
            address(mockSoph),
            deployer,
            address(storeProxy)
        );
        ERC1967Proxy jobsProxy = new ERC1967Proxy(address(jobsImpl), jobsInitData);
        console.log("Jobs proxy deployed at:", address(jobsProxy));

        // Grant WITHDRAWER_ROLE to Jobs contract on Store
        StoreV2 store = StoreV2(address(storeProxy));
        store.grantRole(store.WITHDRAWER_ROLE(), address(jobsProxy));
        console.log("Granted WITHDRAWER_ROLE to Jobs contract");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("SOPHON TESTNET DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("Mock USDC:", address(mockUsdc));
        console.log("Mock SOPH:", address(mockSoph));
        console.log("Store Proxy:", address(storeProxy));
        console.log("Store Implementation:", address(storeImpl));
        console.log("Jobs Proxy:", address(jobsProxy));
        console.log("Jobs Implementation:", address(jobsImpl));
        console.log("Admin:", deployer);
        console.log("Initial Album Price: 0.01 USDC");
        console.log("========================================");
        console.log("\nNEXT STEPS:");
        console.log("1. Update frontend/.env with:");
        console.log("   NEXT_PUBLIC_USDC_ADDRESS=", address(mockUsdc));
        console.log("   NEXT_PUBLIC_SOPH_ADDRESS=", address(mockSoph));
        console.log("   NEXT_PUBLIC_STORE_CONTRACT=", address(storeProxy));
        console.log("   NEXT_PUBLIC_JOBS_CONTRACT=", address(jobsProxy));
        console.log("\n2. Users can mint test USDC at:", address(mockUsdc));
        console.log("   and test SOPH at:", address(mockSoph));
        console.log("   by calling the mint() function");
        console.log("========================================");
    }
}