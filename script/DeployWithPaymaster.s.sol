// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {StoreV2} from "../src/StoreV2.sol";
import {JobsV2} from "../src/JobsV2.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployWithPaymasterScript is Script, TestExt {
    uint256 constant INITIAL_GIFTCARD_PRICE = 32e6; // 32 USDC with 6 decimals

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

        // Deploy MockUSDC
        MockUSDC mockUSDC = new MockUSDC();
        console.log("MockUSDC deployed at:", address(mockUSDC));

        // Deploy Store implementation
        StoreV2 storeImpl = new StoreV2();
        console.log("Store implementation deployed at:", address(storeImpl));

        // Deploy Store proxy
        bytes memory storeInitData = abi.encodeWithSelector(
            StoreV2.initialize.selector, 
            address(mockUSDC), 
            deployer, 
            INITIAL_GIFTCARD_PRICE
        );
        ERC1967Proxy storeProxy = new ERC1967Proxy(address(storeImpl), storeInitData);
        console.log("Store proxy deployed at:", address(storeProxy));

        // Deploy Jobs implementation
        JobsV2 jobsImpl = new JobsV2();
        console.log("Jobs implementation deployed at:", address(jobsImpl));

        // Deploy Jobs proxy
        bytes memory jobsInitData = abi.encodeWithSelector(
            JobsV2.initialize.selector,
            address(mockUSDC),
            deployer
        );
        ERC1967Proxy jobsProxy = new ERC1967Proxy(address(jobsImpl), jobsInitData);
        console.log("Jobs proxy deployed at:", address(jobsProxy));

        // Mint test USDC
        mockUSDC.mintTo(deployer, 10000 * 10**6);
        mockUSDC.mintTo(address(jobsProxy), 10000 * 10**6);
        console.log("Minted test USDC");

        vm.stopBroadcast();

        // Save addresses
        string memory addresses = string.concat(
            "STORE_PROXY=", vm.toString(address(storeProxy)), "\n",
            "STORE_IMPL=", vm.toString(address(storeImpl)), "\n",
            "JOBS_PROXY=", vm.toString(address(jobsProxy)), "\n",
            "JOBS_IMPL=", vm.toString(address(jobsImpl)), "\n",
            "USDC_ADDRESS=", vm.toString(address(mockUSDC)), "\n"
        );
        vm.writeFile("deployed-addresses-testnet.txt", addresses);
        
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
    }
}