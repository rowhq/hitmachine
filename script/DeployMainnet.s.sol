// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoBand} from "../src/NanoBand.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploy to Sophon Mainnet with:
// source .env && forge script ./script/DeployMainnet.s.sol --rpc-url https://rpc.sophon.xyz --zksync --broadcast
contract DeployMainnetScript is Script, TestExt {
    // Configuration
    uint256 constant INITIAL_GIFTCARD_PRICE = 31.96e6; // $31.96 with 6 decimals

    // Sophon Mainnet config
    address constant SOPHON_MAINNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    address constant SOPHON_MAINNET_USDC = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;
    uint256 constant SOPHON_MAINNET_CHAIN_ID = 50104;

    function run() external {
        // Get wallet2 mnemonic and deployer private key from .env
        string memory wallet2Mnemonic = vm.envString("wallet2");
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Verify we're on mainnet
        uint256 chainId = block.chainid;
        require(
            chainId == SOPHON_MAINNET_CHAIN_ID,
            "ERROR: This script is for MAINNET only! Use DeployTestnet.s.sol for testnet."
        );

        console.log("========================================");
        console.log("MAINNET DEPLOYMENT");
        console.log("========================================");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Deployer Balance:", deployer.balance, "wei");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Configure paymaster for contract deployments
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));

        console.log("\n1. Using mainnet USDC at:", SOPHON_MAINNET_USDC);

        // Deploy NanoMusicStore implementation
        console.log("\n2. Deploying NanoMusicStore implementation...");
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        NanoMusicStore musicStoreImpl = new NanoMusicStore();
        console.log("   Implementation:", address(musicStoreImpl));

        // Deploy NanoMusicStore proxy with initialization
        console.log("\n3. Deploying NanoMusicStore proxy...");
        bytes memory initData = abi.encodeWithSelector(
            NanoMusicStore.initialize.selector, SOPHON_MAINNET_USDC, deployer, INITIAL_GIFTCARD_PRICE
        );
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        ERC1967Proxy musicStoreProxy = new ERC1967Proxy(address(musicStoreImpl), initData);
        console.log("   Proxy:", address(musicStoreProxy));

        // Deploy NanoBand implementation
        console.log("\n4. Deploying NanoBand implementation...");
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        NanoBand nanoBandImpl = new NanoBand();
        console.log("   Implementation:", address(nanoBandImpl));

        // Deploy NanoBand proxy with initialization
        console.log("\n5. Deploying NanoBand proxy...");
        bytes memory bandInitData = abi.encodeWithSelector(NanoBand.initialize.selector, SOPHON_MAINNET_USDC, deployer);
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        ERC1967Proxy nanoBandProxy = new ERC1967Proxy(address(nanoBandImpl), bandInitData);
        console.log("   Proxy:", address(nanoBandProxy));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n========================================");
        console.log("MAINNET DEPLOYMENT COMPLETE!");
        console.log("========================================");
        console.log("\nDeployed Contracts:");
        console.log("-------------------");
        console.log("USDC (mainnet):", SOPHON_MAINNET_USDC);
        console.log("NanoMusicStore:");
        console.log("  Implementation:", address(musicStoreImpl));
        console.log("  Proxy:", address(musicStoreProxy));
        console.log("NanoBand:");
        console.log("  Implementation:", address(nanoBandImpl));
        console.log("  Proxy:", address(nanoBandProxy));

        console.log("\n========================================");
        console.log("NEXT STEPS:");
        console.log("========================================");
        console.log("1. Grant roles using GrantRolesMainnet.s.sol");
        console.log("2. Verify contracts on explorer");
        console.log("3. Update frontend config with addresses");
        console.log("4. Fund NanoBand contract with USDC");
        console.log("========================================");
    }
}
