// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/StoreV2.sol";
import "../src/JobsV2.sol";
import "../src/MockUSDC.sol";
import "../src/MockSOPH.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployWithPaymaster is Script {
    address constant PAYMASTER_ADDRESS = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying from:", deployer);
        console.log("Using paymaster:", PAYMASTER_ADDRESS);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy Mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));
        
        // Deploy Mock SOPH token
        MockSOPH sophToken = new MockSOPH();
        console.log("MockSOPH token deployed at:", address(sophToken));
        
        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));
        
        // Deploy Store proxy with initializer
        bytes memory storeInitData = abi.encodeWithSelector(
            StoreV2.initialize.selector,
            address(usdc),
            deployer, // admin
            10000 // 0.01 USDC album price
        );
        ERC1967Proxy storeProxy = new ERC1967Proxy(
            address(storeImpl),
            storeInitData
        );
        console.log("Store proxy deployed at:", address(storeProxy));
        
        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));
        
        // Deploy Jobs proxy with initializer
        bytes memory jobsInitData = abi.encodeWithSelector(
            JobsV2.initialize.selector,
            address(usdc),
            address(sophToken),
            deployer, // admin
            address(storeProxy)
        );
        ERC1967Proxy jobsProxy = new ERC1967Proxy(
            address(jobsImpl),
            jobsInitData
        );
        console.log("Jobs proxy deployed at:", address(jobsProxy));
        
        // Setup contracts
        StoreV2 store = StoreV2(address(storeProxy));
        JobsV2 jobs = JobsV2(address(jobsProxy));
        
        // Grant roles in Store contract
        bytes32 WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
        store.grantRole(WITHDRAWER_ROLE, address(jobsProxy));
        console.log("WITHDRAWER_ROLE granted to Jobs contract");
        
        // Grant DISTRIBUTOR_ROLE to deployer and paymaster
        bytes32 DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
        jobs.grantRole(DISTRIBUTOR_ROLE, deployer);
        jobs.grantRole(DISTRIBUTOR_ROLE, PAYMASTER_ADDRESS);
        console.log("DISTRIBUTOR_ROLE granted to deployer and paymaster");
        
        // Mint initial tokens to Jobs contract for distribution
        usdc.mintTo(address(jobsProxy), 1000 * 10**6); // 1000 USDC
        sophToken.mint(); // Mint to deployer first
        sophToken.transfer(address(jobsProxy), 100 * 10**18); // Transfer 100 SOPH to Jobs
        
        // Also send some native SOPH to deployer for gas
        console.log("Jobs contract funded with 1000 USDC and 100 SOPH tokens");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("MockUSDC:", address(usdc));
        console.log("MockSOPH:", address(sophToken));
        console.log("Store Proxy:", address(storeProxy));
        console.log("Jobs Proxy:", address(jobsProxy));
        console.log("Paymaster:", PAYMASTER_ADDRESS);
        console.log("=========================");
    }
}