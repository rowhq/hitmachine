#!/bin/bash

# Sophon Testnet Deployment with PAYMASTER using Foundry Script

set -e

echo "========================================"
echo "🚀 Sophon Testnet GASLESS Deployment (Foundry + Paymaster)"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Check required environment variables
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo "❌ Error: WALLET_PRIVATE_KEY not set in .env"
    exit 1
fi

# Configuration
export PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
export RPC_URL="${SOPHON_TESTNET_RPC_URL:-https://rpc.testnet.sophon.xyz}"
DEPLOYER=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

echo "📍 Configuration:"
echo "   Deployer: $DEPLOYER"
echo "   Paymaster: $PAYMASTER_ADDRESS (GASLESS)"
echo "   RPC: $RPC_URL"
echo ""

# Check deployer balance before deployment
INITIAL_BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL)
echo "   Initial balance: $INITIAL_BALANCE wei"
echo ""

# Build contracts with zkSync
echo "🔨 Building contracts with zkSync..."
forge build --zksync

echo ""
echo "📦 Deploying contracts using Foundry script (GASLESS via Paymaster)..."
echo ""

# Deploy using the Foundry script with paymaster
forge script script/DeployWithPaymaster.s.sol:DeployWithPaymasterScript \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --broadcast \
    --slow \
    -vvv

echo ""
echo "📊 Checking final balance to verify gasless deployment..."
FINAL_BALANCE=$(cast balance $DEPLOYER --rpc-url $RPC_URL)
echo "   Initial balance: $INITIAL_BALANCE wei"
echo "   Final balance:   $FINAL_BALANCE wei"

if [ "$INITIAL_BALANCE" == "$FINAL_BALANCE" ]; then
    echo "   ✅ Balance unchanged - PAYMASTER WORKED PERFECTLY!"
else
    echo "   ⚠️  Balance changed - some transactions may not have used paymaster"
fi

echo ""
echo "========================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Check deployed-addresses-testnet.txt for contract addresses"
echo ""
echo "🔥 ALL DEPLOYMENTS USED PAYMASTER (GASLESS)!"