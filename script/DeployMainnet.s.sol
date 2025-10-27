// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoBand} from "../src/NanoBand.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// Deploy to Sophon Mainnet with paymaster:
// source .env && forge script ./script/DeployMainnet.s.sol --rpc-url https://rpc.sophon.xyz --zksync --broadcast
contract DeployMainnetScript is Script {
    // Configuration
    uint256 constant INITIAL_GIFTCARD_PRICE = 31.96e6; // $31.96 with 6 decimals

    // Sophon Mainnet addresses
    address constant SOPHON_MAINNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;
    address constant SOPHON_MAINNET_USDC = 0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F;
    uint256 constant SOPHON_MAINNET_CHAIN_ID = 50104;

    function run() external {
        // Get wallet2 mnemonic and w2 private key from .env
        string memory wallet2Mnemonic = vm.envString("wallet2");
        uint256 deployerPrivateKey = vm.envUint("w2");
        address deployer = vm.addr(deployerPrivateKey);

        // Verify we're on mainnet
        uint256 chainId = block.chainid;
        require(
            chainId == SOPHON_MAINNET_CHAIN_ID,
            "ERROR: This script is for MAINNET only! Use DeployTestnet.s.sol for testnet."
        );

        console.log("========================================");
        console.log("MAINNET DEPLOYMENT WITH PAYMASTER");
        console.log("========================================");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Deployer Balance:", deployer.balance, "wei");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Configure paymaster for gasless deployment
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));

        console.log("\n1. Using paymaster for gasless deployment");
        console.log("2. USDC Address:", SOPHON_MAINNET_USDC);

        // Deploy NanoMusicStore implementation
        console.log("\n3. Deploying NanoMusicStore implementation...");
        (bool success1,) = address(vm).call(
            abi.encodeWithSignature(
                "zkUsePaymaster(address,bytes)",
                SOPHON_MAINNET_PAYMASTER,
                paymasterInput
            )
        );
        require(success1, "Paymaster call failed");
        NanoMusicStore musicStoreImpl = new NanoMusicStore();
        console.log("   Implementation:", address(musicStoreImpl));

        // Deploy NanoMusicStore proxy with initialization
        console.log("\n4. Deploying NanoMusicStore proxy...");
        bytes memory initData = abi.encodeWithSelector(
            NanoMusicStore.initialize.selector,
            SOPHON_MAINNET_USDC,
            deployer,
            INITIAL_GIFTCARD_PRICE
        );
        (bool success2,) = address(vm).call(
            abi.encodeWithSignature(
                "zkUsePaymaster(address,bytes)",
                SOPHON_MAINNET_PAYMASTER,
                paymasterInput
            )
        );
        require(success2, "Paymaster call failed");
        ERC1967Proxy musicStoreProxy = new ERC1967Proxy(address(musicStoreImpl), initData);
        console.log("   Proxy:", address(musicStoreProxy));

        // Deploy NanoBand implementation
        console.log("\n5. Deploying NanoBand implementation...");
        (bool success3,) = address(vm).call(
            abi.encodeWithSignature(
                "zkUsePaymaster(address,bytes)",
                SOPHON_MAINNET_PAYMASTER,
                paymasterInput
            )
        );
        require(success3, "Paymaster call failed");
        NanoBand nanoBandImpl = new NanoBand();
        console.log("   Implementation:", address(nanoBandImpl));

        // Deploy NanoBand proxy with initialization
        console.log("\n6. Deploying NanoBand proxy...");
        bytes memory bandInitData = abi.encodeWithSelector(
            NanoBand.initialize.selector,
            SOPHON_MAINNET_USDC,
            deployer
        );
        (bool success4,) = address(vm).call(
            abi.encodeWithSignature(
                "zkUsePaymaster(address,bytes)",
                SOPHON_MAINNET_PAYMASTER,
                paymasterInput
            )
        );
        require(success4, "Paymaster call failed");
        ERC1967Proxy nanoBandProxy = new ERC1967Proxy(address(nanoBandImpl), bandInitData);
        console.log("   Proxy:", address(nanoBandProxy));

        // Grant roles
        console.log("\n7. Granting roles...");

        // Derive admin addresses from wallet2 mnemonic (shifted indices)
        address bandAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(2)));
        address storeAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(3)));
        address marketingAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(4)));

        console.log("   Index 0 (Deployer/Nano):", deployer);
        console.log("   Index 2 (Band Admin):", bandAdmin);
        console.log("   Index 3 (Store Admin):", storeAdmin);
        console.log("   Index 4 (Marketing):", marketingAdmin);

        // Get contract instances
        NanoMusicStore musicStore = NanoMusicStore(address(musicStoreProxy));
        NanoBand band = NanoBand(address(nanoBandProxy));

        // Grant ADMIN_ROLE to bandAdmin on Band
        band.grantRole(band.ADMIN_ROLE(), bandAdmin);
        console.log("   [DONE] Granted ADMIN_ROLE to Index 2 on Band");

        // Grant ADMIN_ROLE to storeAdmin on Store
        musicStore.grantRole(musicStore.ADMIN_ROLE(), storeAdmin);
        console.log("   [DONE] Granted ADMIN_ROLE to Index 3 on Store");

        // Grant MARKETING_BUDGET_ROLE to marketingAdmin on Store
        musicStore.grantRole(musicStore.MARKETING_BUDGET_ROLE(), marketingAdmin);
        console.log("   [DONE] Granted MARKETING_BUDGET_ROLE to Index 4 on Store");

        // Grant DISTRIBUTOR_ROLE to 100 addresses (indices 100-199) on Band
        console.log("   Granting DISTRIBUTOR_ROLE to 100 addresses (indices 100-199)...");
        for (uint32 i = 100; i < 200; i++) {
            address distributor = vm.addr(vm.deriveKey(wallet2Mnemonic, i));
            band.grantRole(band.DISTRIBUTOR_ROLE(), distributor);
            if (i == 199) {
                console.log("   [DONE] Granted DISTRIBUTOR_ROLE to 100 addresses");
            }
        }

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
        console.log("1. Verify contracts on explorer");
        console.log("2. Update frontend config with addresses");
        console.log("========================================");
    }
}
