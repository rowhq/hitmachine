// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";

// Update price on Sophon Mainnet with:
// source .env && forge script ./script/UpdatePriceMainnet.s.sol --rpc-url https://rpc.sophon.xyz --zksync --broadcast
contract UpdatePriceMainnetScript is Script {
    // Configuration
    uint256 constant NEW_PRICE = 7.99e6; // $7.99 with 6 decimals (7,990,000)
    uint256 constant SOPHON_MAINNET_CHAIN_ID = 50104;

    // NanoMusicStore proxy address on mainnet (from frontend/app/config/environment.ts)
    address constant MUSIC_STORE_PROXY = 0x963842e934594072B0996366c568e37B1Ad5F3f2;

    function run() external {
        // Get PROD_WALLET mnemonic
        string memory PROD_WALLETMnemonic = vm.envString("PROD_WALLET");

        // Derive operator private key from PROD_WALLET at index 0 (deployer has OPERATOR_ROLE)
        uint256 operatorPrivateKey = vm.deriveKey(PROD_WALLETMnemonic, uint32(0));
        address operator = vm.addr(operatorPrivateKey);

        // Verify we're on mainnet
        uint256 chainId = block.chainid;
        require(
            chainId == SOPHON_MAINNET_CHAIN_ID,
            "ERROR: This script is for MAINNET only! Use UpdatePriceTestnet.s.sol for testnet."
        );

        console.log("========================================");
        console.log("MAINNET PRICE UPDATE");
        console.log("========================================");
        console.log("Chain ID:", chainId);
        console.log("Operator (PROD_WALLET index 0):", operator);
        console.log("NanoMusicStore Proxy:", MUSIC_STORE_PROXY);
        console.log("========================================");

        // Get contract instance
        NanoMusicStore musicStore = NanoMusicStore(MUSIC_STORE_PROXY);

        // Get current price before update
        uint256 oldPrice = musicStore.giftcardPrice();
        console.log("\nCurrent Price:", oldPrice);
        console.log("New Price:", NEW_PRICE);

        // Confirm the change
        require(NEW_PRICE != oldPrice, "New price is the same as current price");

        console.log("\n=== WARNING: YOU ARE UPDATING THE PRICE ON MAINNET! ===");
        console.log("Old Price:", oldPrice);
        console.log("New Price: 7990000 (7.99 USDC)");
        console.log("Press Ctrl+C to cancel, or continue to proceed...\n");

        vm.startBroadcast(operatorPrivateKey);

        console.log("\nUpdating price...");
        musicStore.updatePrice(NEW_PRICE);

        vm.stopBroadcast();

        // Verify the update
        uint256 updatedPrice = musicStore.giftcardPrice();
        console.log("\n========================================");
        console.log("PRICE UPDATE COMPLETE!");
        console.log("========================================");
        console.log("Old Price:", oldPrice);
        console.log("New Price:", updatedPrice);
        console.log("========================================");

        require(updatedPrice == NEW_PRICE, "Price update verification failed!");
        console.log("\nPrice verified successfully!");
    }
}
