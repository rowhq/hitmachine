#!/bin/bash

# Simple direct deployment without proxies - just to get it working

set -e

echo "========================================"
echo "Simple Sophon Testnet Deployment"
echo "========================================"

# Load environment variables
source .env

PAYMASTER="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
RPC=${SOPHON_TESTNET_RPC_URL:-"https://rpc.testnet.sophon.xyz"}

echo "Using Paymaster for gasless deployment"
echo ""

# Deploy each contract directly
echo "Deploying MockUSDC..."
forge create src/MockUSDC.sol:MockUSDC \
    --rpc-url $RPC \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x")

echo ""
echo "Deploy complete. Check the output above for contract addresses."
echo "Note: This is a simplified deployment without proxies."
echo ""
echo "To continue with Store and Jobs deployment, use the addresses from above."