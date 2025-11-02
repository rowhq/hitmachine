// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {NanoMusicStore} from "../src/NanoMusicStore.sol";

// Update price on Sophon Testnet with:
// source .env && forge script ./script/UpdatePriceTestnet.s.sol --rpc-url https://rpc.testnet.sophon.xyz --zksync --broadcast
contract UpdatePriceTestnetScript is Script {
    // Configuration
    uint256 constant NEW_PRICE = 7.99e6; // $7.99 with 6 decimals (7,990,000)
    uint256 constant SOPHON_TESTNET_CHAIN_ID = 531050104;

    // NanoMusicStore proxy address on testnet (from frontend/app/config/environment.ts)
    address constant MUSIC_STORE_PROXY = 0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674;

    function run() external {
        // Get PROD_WALLET mnemonic
        string memory PROD_WALLETMnemonic = vm.envString("PROD_WALLET");

        // Derive operator private key from PROD_WALLET at index 0 (deployer has OPERATOR_ROLE)
        uint256 operatorPrivateKey = vm.deriveKey(PROD_WALLETMnemonic, uint32(0));
        address operator = vm.addr(operatorPrivateKey);

        // Verify we're on testnet
        uint256 chainId = block.chainid;
        require(
            chainId == SOPHON_TESTNET_CHAIN_ID,
            "ERROR: This script is for TESTNET only! Use UpdatePriceMainnet.s.sol for mainnet."
        );

        console.log("========================================");
        console.log("TESTNET PRICE UPDATE");
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
