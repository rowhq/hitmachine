// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployUpgradeableScript is Script {
    address constant USDC_ADDRESS = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;
    address constant SOPH_ADDRESS = address(0); // Update with actual SOPH token address
    uint256 constant INITIAL_ALBUM_PRICE = 10_000; // 0.01 USDC with 6 decimals
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying upgradeable contracts with deployer:", deployer);
        console.log("USDC address:", USDC_ADDRESS);
        console.log("SOPH address:", SOPH_ADDRESS);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));
        
        // Deploy Store proxy
        bytes memory storeInitData = abi.encodeWithSelector(
            StoreV2.initialize.selector,
            USDC_ADDRESS,
            deployer,
            INITIAL_ALBUM_PRICE
        );
        ERC1967Proxy storeProxy = new ERC1967Proxy(
            address(storeImpl),
            storeInitData
        );
        console.log("Store proxy deployed at:", address(storeProxy));
        
        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));
        
        // Deploy Jobs proxy
        bytes memory jobsInitData = abi.encodeWithSelector(
            JobsV2.initialize.selector,
            USDC_ADDRESS,
            SOPH_ADDRESS,
            deployer,
            address(storeProxy) // Pass the Store proxy address
        );
        ERC1967Proxy jobsProxy = new ERC1967Proxy(
            address(jobsImpl),
            jobsInitData
        );
        console.log("Jobs proxy deployed at:", address(jobsProxy));
        
        // Grant WITHDRAWER_ROLE to Jobs contract on Store
        StoreV2 store = StoreV2(address(storeProxy));
        store.grantRole(store.WITHDRAWER_ROLE(), address(jobsProxy));
        console.log("Granted WITHDRAWER_ROLE to Jobs contract");
        
        vm.stopBroadcast();
        
        console.log("\nDeployment Summary:");
        console.log("==================");
        console.log("Store Proxy:", address(storeProxy));
        console.log("Store Implementation:", address(storeImpl));
        console.log("Jobs Proxy:", address(jobsProxy));
        console.log("Jobs Implementation:", address(jobsImpl));
        console.log("Admin:", deployer);
        console.log("Initial Album Price:", INITIAL_ALBUM_PRICE / 1e6, "USDC");
        console.log("\nJobs contract can now claim funds from Store!");
    }
}