#!/bin/bash

# Deployment script for Sophon Mainnet with PAYMASTER (gasless)

set -e

echo "========================================"
echo "⚠️  MAINNET DEPLOYMENT (GASLESS with Paymaster)"
echo "========================================"
echo ""
read -p "Are you sure you want to deploy to MAINNET? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 1
fi

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

PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
RPC_URL="${SOPHON_MAINNET_RPC_URL:-https://rpc.sophon.xyz}"
VERIFIER_URL="https://explorer.sophon.xyz/api"
MAINNET_USDC="0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F"

echo "Using Paymaster: $PAYMASTER_ADDRESS (gasless deployment)"
echo "Using USDC: $MAINNET_USDC"
echo "Using RPC: $RPC_URL"
echo ""

# Get deployer address
DEPLOYER=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)
echo "Deployer: $DEPLOYER"
echo ""

# Deploy Store implementation
echo "Deploying Store implementation..."
STORE_IMPL_OUTPUT=$(forge create src/StoreV2.sol:StoreV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

STORE_IMPL=$(echo "$STORE_IMPL_OUTPUT" | grep -oE 'Deployed to: 0x[a-fA-F0-9]{40}' | cut -d' ' -f3)
if [ -z "$STORE_IMPL" ]; then
    echo "Failed to deploy Store implementation"
    echo "Output: $STORE_IMPL_OUTPUT"
    exit 1
fi
echo "Store implementation deployed to: $STORE_IMPL"

# Deploy Jobs implementation
echo ""
echo "Deploying Jobs implementation..."
JOBS_IMPL_OUTPUT=$(forge create src/JobsV2.sol:JobsV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

JOBS_IMPL=$(echo "$JOBS_IMPL_OUTPUT" | grep -oE 'Deployed to: 0x[a-fA-F0-9]{40}' | cut -d' ' -f3)
if [ -z "$JOBS_IMPL" ]; then
    echo "Failed to deploy Jobs implementation"
    echo "Output: $JOBS_IMPL_OUTPUT"
    exit 1
fi
echo "Jobs implementation deployed to: $JOBS_IMPL"

# Prepare initialization data for Store proxy
echo ""
echo "Preparing Store proxy initialization..."
STORE_INIT_DATA=$(cast calldata "initialize(address,address,uint256)" $MAINNET_USDC $DEPLOYER 32000000)

# Deploy Store proxy
echo "Deploying Store proxy..."
STORE_PROXY_OUTPUT=$(forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args $STORE_IMPL $STORE_INIT_DATA \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

STORE_PROXY=$(echo "$STORE_PROXY_OUTPUT" | grep -oE 'Deployed to: 0x[a-fA-F0-9]{40}' | cut -d' ' -f3)
if [ -z "$STORE_PROXY" ]; then
    echo "Failed to deploy Store proxy"
    echo "Output: $STORE_PROXY_OUTPUT"
    exit 1
fi
echo "Store proxy deployed to: $STORE_PROXY"

# Prepare initialization data for Jobs proxy
echo ""
echo "Preparing Jobs proxy initialization..."
JOBS_INIT_DATA=$(cast calldata "initialize(address,address)" $MAINNET_USDC $DEPLOYER)

# Deploy Jobs proxy
echo "Deploying Jobs proxy..."
JOBS_PROXY_OUTPUT=$(forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args $JOBS_IMPL $JOBS_INIT_DATA \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    2>&1)

JOBS_PROXY=$(echo "$JOBS_PROXY_OUTPUT" | grep -oE 'Deployed to: 0x[a-fA-F0-9]{40}' | cut -d' ' -f3)
if [ -z "$JOBS_PROXY" ]; then
    echo "Failed to deploy Jobs proxy"
    echo "Output: $JOBS_PROXY_OUTPUT"
    exit 1
fi
echo "Jobs proxy deployed to: $JOBS_PROXY"

# Save deployment info
cat > deployed-addresses-mainnet.txt << EOF
# Sophon Mainnet Deployment
STORE_PROXY=$STORE_PROXY
STORE_IMPL=$STORE_IMPL
JOBS_PROXY=$JOBS_PROXY
JOBS_IMPL=$JOBS_IMPL
USDC_ADDRESS=$MAINNET_USDC
ADMIN=$DEPLOYER
EOF

# Update frontend env
cat > frontend/.env.local << EOF
# Auto-generated from deploy-mainnet.sh
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY
NEXT_PUBLIC_USDC_ADDRESS=$MAINNET_USDC
NEXT_PUBLIC_NETWORK=mainnet
EOF

echo ""
echo "========================================"
echo "✅ MAINNET Deployment Complete (Gasless with Paymaster)!"
echo "========================================"
echo ""
echo "Deployed Contracts:"
echo "  USDC: $MAINNET_USDC (official)"
echo "  Store Proxy: $STORE_PROXY"
echo "  Store Implementation: $STORE_IMPL"
echo "  Jobs Proxy: $JOBS_PROXY"
echo "  Jobs Implementation: $JOBS_IMPL"
echo ""
echo "Files updated:"
echo "  - deployed-addresses-mainnet.txt"
echo "  - frontend/.env.local"
echo ""
echo "⚠️  IMPORTANT POST-DEPLOYMENT STEPS:"
echo "1. Grant marketing role to nano wallet:"
echo "   cast send $STORE_PROXY \"grantRole(bytes32,address)\" \\"
echo "     \$(cast keccak \"MARKETING_BUDGET_ROLE\") \\"
echo "     YOUR_NANO_WALLET_ADDRESS \\"
echo "     --private-key \$WALLET_PRIVATE_KEY"
echo ""
echo "2. Fund the Jobs contract with USDC for cat feeder payments"
echo "3. Update frontend environment variables in production"