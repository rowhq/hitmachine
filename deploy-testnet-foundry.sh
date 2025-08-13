#!/bin/bash

# Deployment using Foundry with zkSync paymaster

set -e

echo "========================================"
echo "Deploying to Sophon Testnet"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo "Error: WALLET_PRIVATE_KEY not set in .env"
    exit 1
fi

# Set paymaster for the transaction
export PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"

# First compile with zkSync
echo "Compiling contracts..."
forge build --zksync

# Deploy using forge script with paymaster params
echo "Deploying contracts..."
forge script script/DeployWithPaymaster.s.sol:DeployWithPaymasterScript \
    --rpc-url ${SOPHON_TESTNET_RPC_URL:-https://rpc.testnet.sophon.xyz} \
    --broadcast \
    --zksync \
    --slow \
    --legacy \
    --with-gas-price 1000000000 \
    -vvv

echo ""
echo "✅ Deployment Complete!"
echo "Check deployed-addresses-testnet.txt for addresses"