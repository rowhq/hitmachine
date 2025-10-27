// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

// Send most of SOPH balance to wallet2's deployer wallet
// Usage:
// source .env && forge script ./script/SendSOPH.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --broadcast
// OR
// source .env && forge script ./script/SendSOPH.s.sol --rpc-url $SOPHON_MAINNET_RPC_URL --broadcast

contract SendSOPHScript is Script {
    address constant RECIPIENT = 0x5962FFffB1198D8e7aa0E3bFCE7f2b059c94f8cE;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("w2");
        address deployer = vm.addr(deployerPrivateKey);

        uint256 amountToSend = 1;

        console.log("========================================");
        console.log("SOPH Transfer Script");
        console.log("========================================");
        console.log("Sender (WALLET_PRIVATE_KEY):", deployer);
        console.log("Recipient (wallet2 deployer):", RECIPIENT);
        console.log("Amount to Send:", amountToSend, "wei");
        console.log("========================================");

        require(amountToSend > 0, "Not enough balance to send");

        vm.startBroadcast(deployerPrivateKey);

        // Send most of SOPH
        (bool success,) = RECIPIENT.call{value: amountToSend}("");
        require(success, "Transfer failed");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("Transfer Complete!");
        console.log("========================================");
        console.log("Sent:", amountToSend, "wei to", RECIPIENT);
        console.log("========================================");
    }
}
