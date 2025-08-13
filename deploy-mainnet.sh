#!/bin/bash
set -e

# Load environment variables
source .env

echo "🚀 Deploying to Sophon Mainnet with paymaster (gasless)..."

# Run the Foundry script with zkSync and verification
forge script script/DeployMainnet.s.sol:DeployMainnetScript \
    --rpc-url sophonMainnet \
    --broadcast \
    --zksync \
    --verify \
    -vvv

echo "✅ Deployment complete! Check the output above for contract addresses."