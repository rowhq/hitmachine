// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployScript is Script {
    uint256 constant INITIAL_ALBUM_PRICE = 10_000; // 0.01 USDC with 6 decimals

    function run() external returns (address storeProxy, address jobsProxy) {
        // Get configuration from environment
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get token addresses from environment (must be set before deployment)
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address sophAddress = vm.envAddress("SOPH_ADDRESS");

        require(usdcAddress != address(0), "USDC_ADDRESS not set in environment");
        require(sophAddress != address(0), "SOPH_ADDRESS not set in environment");

        console.log("Deploying contracts with:");
        console.log("  Deployer:", deployer);
        console.log("  USDC:", usdcAddress);
        console.log("  SOPH:", sophAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));

        // Deploy Store proxy
        bytes memory storeInitData = abi.encodeWithSelector(
            StoreV2.initialize.selector,
            usdcAddress,
            deployer,
            INITIAL_ALBUM_PRICE
        );
        ERC1967Proxy _storeProxy = new ERC1967Proxy(address(storeImpl), storeInitData);
        console.log("Store proxy deployed at:", address(_storeProxy));

        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));

        // Deploy Jobs proxy
        bytes memory jobsInitData = abi.encodeWithSelector(
            JobsV2.initialize.selector,
            usdcAddress,
            sophAddress,
            deployer,
            address(_storeProxy)
        );
        ERC1967Proxy _jobsProxy = new ERC1967Proxy(address(jobsImpl), jobsInitData);
        console.log("Jobs proxy deployed at:", address(_jobsProxy));

        // Grant WITHDRAWER_ROLE to Jobs contract on Store
        StoreV2 store = StoreV2(address(_storeProxy));
        store.grantRole(store.WITHDRAWER_ROLE(), address(_jobsProxy));
        console.log("Granted WITHDRAWER_ROLE to Jobs contract");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("USDC Address:", usdcAddress);
        console.log("SOPH Address:", sophAddress);
        console.log("Store Proxy:", address(_storeProxy));
        console.log("Store Implementation:", address(storeImpl));
        console.log("Jobs Proxy:", address(_jobsProxy));
        console.log("Jobs Implementation:", address(jobsImpl));
        console.log("Admin:", deployer);
        console.log("Initial Album Price: 0.01 USDC");
        console.log("========================================");
        console.log("\nUpdate your frontend/.env with:");
        console.log("NEXT_PUBLIC_STORE_CONTRACT=", address(_storeProxy));
        console.log("NEXT_PUBLIC_JOBS_CONTRACT=", address(_jobsProxy));
        console.log("========================================");

        return (address(_storeProxy), address(_jobsProxy));
    }
}