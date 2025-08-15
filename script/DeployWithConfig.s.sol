// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoAnimalCare} from "../src/NanoAnimalCare.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploy with:
// For testnet: forge script ./script/DeployWithConfig.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast
// For mainnet: NETWORK=mainnet forge script ./script/DeployWithConfig.s.sol --rpc-url $SOPHON_MAINNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast

contract DeployWithConfigScript is Script, TestExt {
    // Configuration - matches frontend/app/config/environment.ts
    uint256 constant INITIAL_GIFTCARD_PRICE = 31.96e6; // $31.96 with 6 decimals
    
    // Network addresses
    address constant PAYMASTER_ADDRESS = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    address constant SOPHON_MAINNET_USDC = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Determine network from environment variable (default to testnet)
        string memory network = vm.envOr("NETWORK", string("testnet"));
        bool isMainnet = keccak256(bytes(network)) == keccak256(bytes("mainnet"));
        
        uint256 chainId = block.chainid;
        bool isMainnetChain = chainId == 50104;
        bool isTestnetChain = chainId == 531050104;

        require(isMainnetChain || isTestnetChain, "Unsupported network");
        
        // Verify environment matches chain
        if (isMainnet) {
            require(isMainnetChain, "NETWORK=mainnet but connected to testnet chain");
        } else {
            require(isTestnetChain, "NETWORK=testnet but connected to mainnet chain");
        }

        address usdcAddress;

        console.log("========================================");
        console.log("Deploying with unified config");
        console.log("Environment:", network);
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Paymaster:", PAYMASTER_ADDRESS);
        console.log("Gift card price: $31.96");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Configure paymaster for gasless deployment
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));

        // Deploy MockUSDC on testnet, use real USDC on mainnet
        if (!isMainnet) {
            console.log("\n1. Deploying MockUSDC (testnet)...");
            vmExt.zkUsePaymaster(PAYMASTER_ADDRESS, paymasterInput);
            MockUSDC mockUsdc = new MockUSDC();
            usdcAddress = address(mockUsdc);
            console.log("   MockUSDC deployed at:", usdcAddress);
        } else {
            usdcAddress = SOPHON_MAINNET_USDC;
            console.log("\n1. Using mainnet USDC at:", usdcAddress);
        }

        // Deploy NanoMusicStore
        console.log("\n2. Deploying NanoMusicStore implementation...");
        vmExt.zkUsePaymaster(PAYMASTER_ADDRESS, paymasterInput);
        NanoMusicStore musicStoreImpl = new NanoMusicStore();
        console.log("   Implementation:", address(musicStoreImpl));

        console.log("\n3. Deploying NanoMusicStore proxy...");
        bytes memory initData = abi.encodeWithSelector(
            NanoMusicStore.initialize.selector, 
            usdcAddress, 
            deployer, 
            INITIAL_GIFTCARD_PRICE
        );
        vmExt.zkUsePaymaster(PAYMASTER_ADDRESS, paymasterInput);
        ERC1967Proxy musicStoreProxy = new ERC1967Proxy(address(musicStoreImpl), initData);
        console.log("   Proxy:", address(musicStoreProxy));

        // Deploy NanoAnimalCare
        console.log("\n4. Deploying NanoAnimalCare implementation...");
        vmExt.zkUsePaymaster(PAYMASTER_ADDRESS, paymasterInput);
        NanoAnimalCare animalCareImpl = new NanoAnimalCare();
        console.log("   Implementation:", address(animalCareImpl));

        console.log("\n5. Deploying NanoAnimalCare proxy...");
        bytes memory animalInitData = abi.encodeWithSelector(
            NanoAnimalCare.initialize.selector, 
            usdcAddress, 
            deployer
        );
        vmExt.zkUsePaymaster(PAYMASTER_ADDRESS, paymasterInput);
        ERC1967Proxy animalCareProxy = new ERC1967Proxy(address(animalCareImpl), animalInitData);
        console.log("   Proxy:", address(animalCareProxy));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("\nDeployed Contracts:");
        console.log("-------------------");
        if (!isMainnet) {
            console.log("MockUSDC:", usdcAddress);
        }
        console.log("NanoMusicStore Proxy:", address(musicStoreProxy));
        console.log("NanoAnimalCare Proxy:", address(animalCareProxy));

        console.log("\n========================================");
        console.log("UPDATE ENVIRONMENT CONFIG:");
        console.log("========================================");
        console.log("\nUpdate frontend/app/config/environment.ts:");
        console.log(string.concat("  ", network, ": {"));
        console.log(string.concat("    storeContract: \"", vm.toString(address(musicStoreProxy)), "\","));
        console.log(string.concat("    animalCareContract: \"", vm.toString(address(animalCareProxy)), "\","));
        console.log(string.concat("    usdcAddress: \"", vm.toString(usdcAddress), "\","));
        console.log("  }");
        console.log("========================================");
    }
}