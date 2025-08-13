#!/bin/bash

# Simple deployment script using Foundry script with paymaster

set -e

echo "========================================"
echo "Deploying to Sophon Testnet with Foundry Script"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Check required environment variables
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo "Error: WALLET_PRIVATE_KEY not set in .env"
    exit 1
fi

echo "Running deployment script..."
forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url sophonTestnet \
    --broadcast \
    --zksync \
    -vvv

echo ""
echo "========================================"
echo "✅ Deployment Complete!"
echo "========================================"
echo ""
echo "Check deployed-addresses-testnet.txt for contract addresses"