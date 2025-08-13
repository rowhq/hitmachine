#!/bin/bash

# Test Paymaster Deployment - Simple Test

set -e

echo "========================================"
echo "🧪 Testing Paymaster Deployment"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Configuration
export PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
export RPC_URL="${SOPHON_TESTNET_RPC_URL:-https://rpc.testnet.sophon.xyz}"
DEPLOYER=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

echo "📍 Configuration:"
echo "   Deployer: $DEPLOYER"
echo "   Paymaster: $PAYMASTER_ADDRESS"
echo ""

# Check initial balance
INITIAL_BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL)
echo "   Initial balance: $INITIAL_BALANCE wei"
echo ""

# Build
echo "🔨 Building contracts..."
forge build --zksync

# Deploy using simple script
echo "📦 Deploying MockUSDC only (test)..."
forge script script/DeployPaymasterSimple.s.sol:DeployPaymasterSimpleScript \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --broadcast \
    -vvv

# Check final balance
echo ""
FINAL_BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL)
echo "📊 Balance check:"
echo "   Initial: $INITIAL_BALANCE wei"
echo "   Final:   $FINAL_BALANCE wei"

if [ "$INITIAL_BALANCE" == "$FINAL_BALANCE" ]; then
    echo "   ✅ PAYMASTER WORKED - No gas spent!"
else
    DIFF=$((INITIAL_BALANCE - FINAL_BALANCE))
    echo "   ⚠️  Gas spent: $DIFF wei"
fi