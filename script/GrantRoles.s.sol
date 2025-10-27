// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoBand} from "../src/NanoBand.sol";

// ⚠️  DEPRECATED: Roles are now granted automatically during deployment!
// Use DeployTestnet.s.sol or DeployMainnet.s.sol instead.
// This script is kept for reference only.
//
// Old command (DO NOT USE):
// source .env && forge script ./script/GrantRoles.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast

contract GrantRolesScript is Script {
    // Sophon Testnet addresses
    address constant TESTNET_STORE = 0x86E1D788FFCd8232D85dD7eB02c508e7021EB474;
    address constant TESTNET_BAND = 0xAAfD6b707770BC9F60A773405dE194348B6C4392;

    // Sophon Mainnet addresses
    address constant MAINNET_STORE = 0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5;
    address constant MAINNET_BAND = 0xF3f5E96d9a7786224Fd826Ff0a86D5e210f0b2Ce;

    function run() external {
        // Get admin private key (index 0)
        uint256 adminPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address admin = vm.addr(adminPrivateKey);
        
        // Get admin mnemonic
        string memory adminMnemonic = vm.envString("ADMIN_MNEMONIC");
        
        // Determine network
        uint256 chainId = block.chainid;
        bool isMainnet = chainId == 50104;
        bool isTestnet = chainId == 531050104;
        
        require(isMainnet || isTestnet, "Unsupported network");
        
        // Get contract addresses based on network
        address storeAddress = isMainnet ? MAINNET_STORE : TESTNET_STORE;
        address bandAddress = isMainnet ? MAINNET_BAND : TESTNET_BAND;

        console.log("========================================");
        console.log("Granting Roles on", isMainnet ? "MAINNET" : "TESTNET");
        console.log("Chain ID:", chainId);
        console.log("Admin:", admin);
        console.log("Store:", storeAddress);
        console.log("Band:", bandAddress);
        console.log("========================================");

        // Derive addresses from admin mnemonic (uses new shifted indices)
        address nanoWallet = vm.deriveKey(adminMnemonic, uint32(0));
        address bandAdmin = vm.deriveKey(adminMnemonic, uint32(2));
        address storeAdmin = vm.deriveKey(adminMnemonic, uint32(3));
        address marketingAdmin = vm.deriveKey(adminMnemonic, uint32(4));

        console.log("\nDerived Admin Addresses:");
        console.log("Index 0 (Nano Wallet - Deployer):", nanoWallet);
        console.log("Index 2 (Band Admin):", bandAdmin);
        console.log("Index 3 (Store Admin):", storeAdmin);
        console.log("Index 4 (Marketing Budget):", marketingAdmin);
        
        // Start broadcasting transactions
        vm.startBroadcast(adminPrivateKey);
        
        // Get contract instances
        NanoMusicStore store = NanoMusicStore(storeAddress);
        NanoBand band = NanoBand(bandAddress);

        // Grant ADMIN_ROLE to admin1 on Band
        console.log("\nGranting ADMIN_ROLE to", admin1, "on Band...");
        band.grantRole(band.ADMIN_ROLE(), admin1);
        console.log("✓ Granted ADMIN_ROLE on Band");

        // Grant ADMIN_ROLE to admin2 on Store
        console.log("\nGranting ADMIN_ROLE to", admin2, "on Store...");
        store.grantRole(store.ADMIN_ROLE(), admin2);
        console.log("✓ Granted ADMIN_ROLE on Store");

        // Grant MARKETING_BUDGET_ROLE to admin3 on Store
        console.log("\nGranting MARKETING_BUDGET_ROLE to", admin3, "on Store...");
        store.grantRole(store.MARKETING_BUDGET_ROLE(), admin3);
        console.log("✓ Granted MARKETING_BUDGET_ROLE on Store");

        // Grant DISTRIBUTOR_ROLE to addresses 100-200 on Band
        console.log("\nGranting DISTRIBUTOR_ROLE to addresses 100-200...");
        uint256 batchSize = 10; // Process in batches to avoid gas limits

        for (uint32 i = 100; i <= 200; i++) {
            address distributor = vm.deriveKey(adminMnemonic, i);
            band.grantRole(band.DISTRIBUTOR_ROLE(), distributor);

            if (i % batchSize == 0 || i == 200) {
                console.log("  ✓ Granted DISTRIBUTOR_ROLE to addresses", i - batchSize + 1, "-", i);
            }
        }
        
        vm.stopBroadcast();
        
        // Verify roles were granted
        console.log("\n========================================");
        console.log("Verification:");
        console.log("Admin1 has ADMIN_ROLE on Band:", band.hasRole(band.ADMIN_ROLE(), admin1));
        console.log("Admin2 has ADMIN_ROLE on Store:", store.hasRole(store.ADMIN_ROLE(), admin2));
        console.log("Admin3 has MARKETING_BUDGET_ROLE on Store:", store.hasRole(store.MARKETING_BUDGET_ROLE(), admin3));

        // Verify a sample distributor
        address sampleDistributor = vm.deriveKey(adminMnemonic, uint32(100));
        console.log("Address 100 has DISTRIBUTOR_ROLE on Band:", band.hasRole(band.DISTRIBUTOR_ROLE(), sampleDistributor));
        console.log("========================================");

        console.log("\n✅ Role assignment complete!");
    }
}