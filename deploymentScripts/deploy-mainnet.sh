#!/bin/bash

# Deployment script for Sophon Mainnet with paymaster and verification

set -e

echo "========================================"
echo "⚠️  MAINNET DEPLOYMENT"
echo "========================================"
echo ""
read -p "Are you sure you want to deploy to MAINNET? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 1
fi

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
forge script script/DeployMainnet.s.sol:DeployMainnetScript \
    --rpc-url sophonMainnet \
    --broadcast \
    --zksync \
    --verify \
    --verifier-url https://explorer.sophon.xyz/api \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    --slow \
    -vvv

echo "========================================"
echo "✅ MAINNET Deployment Complete!"
echo "========================================"
echo ""
echo "Contract addresses saved to:"
echo "  - deployed-addresses-mainnet.txt"
echo "  - frontend/.env.local (auto-updated)"
echo ""
echo "IMPORTANT POST-DEPLOYMENT STEPS:"
echo "1. Grant marketing role to nano wallet:"
echo "   source deployed-addresses-mainnet.txt"
echo "   cast send \$STORE_PROXY \"grantRole(bytes32,address)\" \\"
echo "     \$(cast keccak \"MARKETING_BUDGET_ROLE\") \\"
echo "     YOUR_NANO_WALLET_ADDRESS \\"
echo "     --private-key \$WALLET_PRIVATE_KEY"
echo ""
echo "2. Fund the Jobs contract with USDC for cat feeder payments"
echo "3. Update frontend environment variables in production"