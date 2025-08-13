// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TestExt} from "../lib/forge-zksync-std/src/TestExt.sol";

contract DeploySimpleScript is Script, TestExt {
    address constant PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    
    function run() external {
        uint256 pk = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        vm.startBroadcast(pk);
        
        // Enable paymaster for gasless deployment
        vmExt.zkUsePaymaster(PAYMASTER, abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x")));
        
        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("USDC:", address(usdc));
        
        // Deploy implementations
        StoreV2 storeImpl = new StoreV2();
        JobsV2 jobsImpl = new JobsV2();
        console.log("Store impl:", address(storeImpl));
        console.log("Jobs impl:", address(jobsImpl));
        
        // Deploy Store proxy
        ERC1967Proxy storeProxy = new ERC1967Proxy(
            address(storeImpl),
            abi.encodeCall(StoreV2.initialize, (address(usdc), deployer, 32e6))
        );
        console.log("Store proxy:", address(storeProxy));
        
        // Deploy Jobs proxy
        ERC1967Proxy jobsProxy = new ERC1967Proxy(
            address(jobsImpl),
            abi.encodeCall(JobsV2.initialize, (address(usdc), deployer))
        );
        console.log("Jobs proxy:", address(jobsProxy));
        
        // Mint USDC
        usdc.mintTo(deployer, 10000e6);
        usdc.mintTo(address(jobsProxy), 10000e6);
        
        vm.stopBroadcast();
        
        console.log("Deployment complete with PAYMASTER (gasless)!");
    }
}