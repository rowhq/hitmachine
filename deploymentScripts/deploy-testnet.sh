#!/bin/bash

# Deployment script for Sophon Testnet with paymaster and verification

set -e

echo "========================================"
echo "Deploying to Sophon Testnet"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required environment variables
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo "Error: WALLET_PRIVATE_KEY not set in .env"
    exit 1
fi

# Deploy using Foundry script with zkSync, paymaster, and verification
echo "Running deployment script..."
forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url sophonTestnet \
    --broadcast \
    --zksync \
    --verify \
    --verifier-url https://explorer.testnet.sophon.xyz/api \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    --slow \
    -vvv

echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Contract addresses saved to:"
echo "  - deployed-addresses-testnet.txt"
echo "  - frontend/.env.local (auto-updated)"
echo ""
echo "To grant marketing role to nano wallet:"
echo "  source deployed-addresses-testnet.txt"
echo "  cast send \$STORE_PROXY \"grantRole(bytes32,address)\" \\"
echo "    \$(cast keccak \"MARKETING_BUDGET_ROLE\") \\"
echo "    YOUR_NANO_WALLET_ADDRESS \\"
echo "    --private-key \$WALLET_PRIVATE_KEY"