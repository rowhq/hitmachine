#!/bin/bash

# Simple deployment script that works

echo "🚀 Deploying to Sophon Testnet"
echo "=============================="

# Check for .env.local file
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "Please create .env.local with:"
    echo "  WALLET_PRIVATE_KEY=0x..."
    exit 1
fi

# Load environment variables (handle quotes and spaces properly)
set -a
source .env.local
set +a

# Remove quotes from WALLET_PRIVATE_KEY if present
WALLET_PRIVATE_KEY="${WALLET_PRIVATE_KEY%\"}"
WALLET_PRIVATE_KEY="${WALLET_PRIVATE_KEY#\"}"

# Check if WALLET_PRIVATE_KEY is set
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo "❌ WALLET_PRIVATE_KEY not found in .env.local"
    exit 1
fi

echo "✅ Environment loaded"
echo "   Using wallet: ${WALLET_PRIVATE_KEY:0:10}..."

# Set PRIVATE_KEY for Forge
export PRIVATE_KEY=$WALLET_PRIVATE_KEY

# Build contracts
echo ""
echo "📦 Building contracts..."
forge build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Deploy to testnet (skip verification)
echo ""
echo "🔗 Deploying contracts..."
forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url https://rpc.testnet.sophon.xyz \
    --private-key $WALLET_PRIVATE_KEY \
    --broadcast \
    --legacy \
    --slow \
    --skip-simulation \
    -vvv

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Next steps:"
    echo "1. Check the output above for contract addresses"
    echo "2. Run: ./scripts/extract-abis.sh"
    echo "3. Update frontend/.env.local with the addresses"
else
    echo "❌ Deployment failed"
    echo "Check error messages above"
fi