// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/NanoMusicStore.sol";

contract UpdatePriceScript is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        
        // Contract addresses
        address musicStoreProxy = 0x86E1D788FFCd8232D85dD7eB02c508e7021EB474;
        
        // New price: 31.96 USDC (with 6 decimals)
        uint256 newPrice = 31_960_000; // 31.96 * 10^6
        
        console.log("Starting price update...");
        console.log("Music Store Proxy:", musicStoreProxy);
        console.log("New price:", newPrice);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Get the contract instance
        NanoMusicStore musicStore = NanoMusicStore(musicStoreProxy);
        
        // Get current price for comparison
        uint256 currentPrice = musicStore.giftcardPrice();
        console.log("Current price:", currentPrice);
        
        // Update the price
        musicStore.updatePrice(newPrice);
        
        // Verify the update
        uint256 updatedPrice = musicStore.giftcardPrice();
        console.log("Updated price:", updatedPrice);
        
        require(updatedPrice == newPrice, "Price update failed");
        
        vm.stopBroadcast();
        
        console.log("Price update successful!");
    }
}