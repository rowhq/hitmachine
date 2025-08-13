#!/bin/bash

# Deployment script for Sophon Testnet with PAYMASTER (gasless)

set -e

echo "========================================"
echo "Deploying to Sophon Testnet (GASLESS with Paymaster)"
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

PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
RPC_URL="https://rpc.testnet.sophon.xyz"
VERIFIER_URL="https://explorer.testnet.sophon.xyz/api"

echo "Using Paymaster: $PAYMASTER_ADDRESS (gasless deployment)"
echo ""

# Deploy MockUSDC
echo "Deploying MockUSDC..."
MOCK_USDC=$(forge create src/MockUSDC.sol:MockUSDC \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --verifier-url $VERIFIER_URL \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    2>&1 | grep "Deployed to:" | awk '{print $3}')

echo "MockUSDC deployed to: $MOCK_USDC"

# Deploy Store implementation
echo "Deploying Store implementation..."
STORE_IMPL=$(forge create src/StoreV2.sol:StoreV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --verifier-url $VERIFIER_URL \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    2>&1 | grep "Deployed to:" | awk '{print $3}')

echo "Store implementation deployed to: $STORE_IMPL"

# Deploy Jobs implementation
echo "Deploying Jobs implementation..."
JOBS_IMPL=$(forge create src/JobsV2.sol:JobsV2 \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --verifier-url $VERIFIER_URL \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    2>&1 | grep "Deployed to:" | awk '{print $3}')

echo "Jobs implementation deployed to: $JOBS_IMPL"

# Get deployer address
DEPLOYER=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

# Prepare initialization data for Store proxy
STORE_INIT_DATA=$(cast calldata "initialize(address,address,uint256)" $MOCK_USDC $DEPLOYER 32000000)

# Deploy Store proxy
echo "Deploying Store proxy..."
STORE_PROXY=$(forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args $STORE_IMPL $STORE_INIT_DATA \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --verifier-url $VERIFIER_URL \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    2>&1 | grep "Deployed to:" | awk '{print $3}')

echo "Store proxy deployed to: $STORE_PROXY"

# Prepare initialization data for Jobs proxy
JOBS_INIT_DATA=$(cast calldata "initialize(address,address)" $MOCK_USDC $DEPLOYER)

# Deploy Jobs proxy
echo "Deploying Jobs proxy..."
JOBS_PROXY=$(forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --constructor-args $JOBS_IMPL $JOBS_INIT_DATA \
    --rpc-url $RPC_URL \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --verifier-url $VERIFIER_URL \
    --etherscan-api-key $ETHERSCAN_SOPHON_API_KEY \
    2>&1 | grep "Deployed to:" | awk '{print $3}')

echo "Jobs proxy deployed to: $JOBS_PROXY"

# Mint test USDC
echo "Minting test USDC..."
cast send $MOCK_USDC "mintTo(address,uint256)" $DEPLOYER 10000000000 \
    --private-key $WALLET_PRIVATE_KEY \
    --rpc-url $RPC_URL

cast send $MOCK_USDC "mintTo(address,uint256)" $JOBS_PROXY 10000000000 \
    --private-key $WALLET_PRIVATE_KEY \
    --rpc-url $RPC_URL

# Save deployment info
cat > deployed-addresses-testnet.txt << EOF
# Sophon Testnet Deployment
STORE_PROXY=$STORE_PROXY
STORE_IMPL=$STORE_IMPL
JOBS_PROXY=$JOBS_PROXY
JOBS_IMPL=$JOBS_IMPL
USDC_ADDRESS=$MOCK_USDC
ADMIN=$DEPLOYER
EOF

# Update frontend env
cat > frontend/.env.local << EOF
# Auto-generated from deploy-testnet.sh
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY
NEXT_PUBLIC_USDC_ADDRESS=$MOCK_USDC
NEXT_PUBLIC_NETWORK=testnet
EOF

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