// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TestExt} from "lib/forge-zksync-std/src/TestExt.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";
import {NanoBand} from "../src/NanoBand.sol";

// Grant roles to deployed contracts on mainnet (separate from deployment)
// Usage:
// MAINNET:
// source .env && forge script ./script/GrantRolesProd.s.sol --rpc-url https://rpc.sophon.xyz --zksync --broadcast

contract GrantRolesProdScript is Script, TestExt {
    // Sophon Mainnet addresses (from deployment)
    address constant MAINNET_STORE = 0x966F836502171b402f69eC4B9d2835d1c5066a32; // NanoMusicStore Proxy
    address constant MAINNET_BAND = 0x85219AF6f0a3d1181649e78d310A66b15D377713; // NanoBand Proxy
    address constant SOPHON_MAINNET_PAYMASTER = 0x98546B226dbbA8230cf620635a1e4ab01F6A99B2;

    function run() external {
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get wallet2 mnemonic
        string memory wallet2Mnemonic = vm.envString("wallet2");

        // Determine network
        uint256 chainId = block.chainid;
        bool isMainnet = chainId == 50104;

        require(isMainnet, "This script is for MAINNET only!");

        require(MAINNET_STORE != address(0), "Store address not set - update MAINNET_STORE constant");
        require(MAINNET_BAND != address(0), "Band address not set - update MAINNET_BAND constant");

        console.log("========================================");
        console.log("GRANTING ROLES ON MAINNET PRODUCTION");
        console.log("========================================");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Store Contract:", MAINNET_STORE);
        console.log("Band Contract:", MAINNET_BAND);
        console.log("========================================");

        // Derive admin addresses from wallet2 mnemonic
        address bandAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(2)));
        address storeAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(3)));
        address marketingAdmin = vm.addr(vm.deriveKey(wallet2Mnemonic, uint32(4)));

        console.log("\nAdmin Addresses (derived from wallet2 mnemonic):");
        console.log("-------------------");
        console.log("Index 2 (Band Admin):", bandAdmin);
        console.log("Index 3 (Store Admin):", storeAdmin);
        console.log("Index 4 (Marketing):", marketingAdmin);
        console.log("Indices 100-199 (100 Distributors): will be granted DISTRIBUTOR_ROLE");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Get contract instances
        NanoMusicStore musicStore = NanoMusicStore(MAINNET_STORE);
        NanoBand band = NanoBand(MAINNET_BAND);

        console.log("\n========================================");
        console.log("GRANTING ROLES");
        console.log("========================================");

        // Configure paymaster for role granting
        bytes memory paymasterInput = abi.encodeWithSelector(bytes4(keccak256("general(bytes)")), bytes("0x"));

        // Grant ADMIN_ROLE to bandAdmin on Band
        console.log("\n1. Granting ADMIN_ROLE to Index 2 on Band...");
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        band.grantRole(band.ADMIN_ROLE(), bandAdmin);
        console.log("   [DONE] ADMIN_ROLE granted");

        // Grant ADMIN_ROLE to storeAdmin on Store
        console.log("\n2. Granting ADMIN_ROLE to Index 3 on Store...");
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        musicStore.grantRole(musicStore.ADMIN_ROLE(), storeAdmin);
        console.log("   [DONE] ADMIN_ROLE granted");

        // Grant MARKETING_BUDGET_ROLE to marketingAdmin on Store
        console.log("\n3. Granting MARKETING_BUDGET_ROLE to Index 4 on Store...");
        vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
        musicStore.grantRole(musicStore.MARKETING_BUDGET_ROLE(), marketingAdmin);
        console.log("   [DONE] MARKETING_BUDGET_ROLE granted");

        // Grant DISTRIBUTOR_ROLE to 100 addresses (indices 100-199)
        console.log("\n4. Granting DISTRIBUTOR_ROLE to 100 addresses (indices 100-199)...");
        for (uint32 i = 100; i < 200; i++) {
            address distributor = vm.addr(vm.deriveKey(wallet2Mnemonic, i));
            vmExt.zkUsePaymaster(SOPHON_MAINNET_PAYMASTER, paymasterInput);
            band.grantRole(band.DISTRIBUTOR_ROLE(), distributor);
        }
        console.log("   [DONE] DISTRIBUTOR_ROLE granted to all 100 addresses");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("ROLE GRANTING COMPLETE!");
        console.log("========================================");
        console.log("\nRoles granted:");
        console.log("- ADMIN_ROLE on Band -> Index 2");
        console.log("- ADMIN_ROLE on Store -> Index 3");
        console.log("- MARKETING_BUDGET_ROLE on Store -> Index 4");
        console.log("- DISTRIBUTOR_ROLE on Band -> Indices 100-199 (100 addresses)");
        console.log("========================================");
    }
}
