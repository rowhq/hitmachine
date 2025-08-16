// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/NanoMusicStore.sol";

contract UpdatePriceSimpleScript is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        
        // Contract addresses
        address musicStoreProxy = 0x86E1D788FFCd8232D85dD7eB02c508e7021EB474;
        
        // New price: 31.96 USDC (with 6 decimals)
        uint256 newPrice = 31_960_000; // 31.96 * 10^6
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Get the contract instance
        NanoMusicStore musicStore = NanoMusicStore(musicStoreProxy);
        
        // Update the price
        musicStore.updatePrice(newPrice);
        
        vm.stopBroadcast();
    }
}