// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

// Send funds from .w2 private key to PROD_WALLET mnemonic index 0
// Usage:
// TESTNET:
// source .env && forge script ./script/FundWallet2Index0.s.sol --rpc-url https://rpc.testnet.sophon.xyz --broadcast
// MAINNET:
// source .env && forge script ./script/FundWallet2Index0.s.sol --rpc-url https://rpc.sophon.xyz --broadcast

contract FundWallet2Index0Script is Script {
    function run() external {
        // Get .w2 private key (sender)
        uint256 senderPrivateKey = vm.envUint("WALLET_PRIVATE_KEY");
        address sender = vm.addr(senderPrivateKey);

        // Get PROD_WALLET mnemonic and derive index 0 (recipient)
        string memory PROD_WALLETMnemonic = vm.envString("PROD_WALLET");
        uint256 recipientPrivateKey = vm.deriveKey(PROD_WALLETMnemonic, uint32(0));
        address recipient = vm.addr(recipientPrivateKey);

        // Determine network
        uint256 chainId = block.chainid;
        string memory network = chainId == 50104
            ? "MAINNET"
            : chainId == 531050104
                ? "TESTNET"
                : "UNKNOWN";

        console.log("========================================");
        console.log("FUND WALLET2 INDEX 0");
        console.log("========================================");
        console.log("Network:", network);
        console.log("Chain ID:", chainId);
        console.log("Sender (.w2):", sender);
        console.log("Sender Balance:", sender.balance, "wei");
        console.log("Recipient (PROD_WALLET index 0):", recipient);
        console.log("Recipient Balance:", recipient.balance, "wei");
        console.log("========================================");

        // Calculate amount to send (leave 0.1 SOPH for sender as buffer)
        uint256 bufferAmount = 5 ether;
        require(
            sender.balance > bufferAmount,
            "Insufficient balance - need more than 0.1 SOPH"
        );
        uint256 amountToSend = sender.balance - bufferAmount;

        console.log("\nAmount to send:", amountToSend, "wei");
        console.log("Amount to send (SOPH):", amountToSend / 1e18);
        console.log("Buffer remaining:", bufferAmount / 1e18, "SOPH");

        vm.startBroadcast(senderPrivateKey);

        // Send funds
        (bool success, ) = payable(recipient).call{value: amountToSend}("");
        require(success, "Transfer failed");

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("TRANSFER COMPLETE!");
        console.log("========================================");
        console.log("Sender new balance:", sender.balance, "wei");
        console.log("Recipient new balance:", recipient.balance, "wei");
        console.log("========================================");
    }
}
