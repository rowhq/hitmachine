#!/bin/bash
set -e

# Load environment variables
source .env

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying to Sophon Testnet with Paymaster (gasless)...${NC}"

# Check required environment variables
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo -e "${RED}ERROR: WALLET_PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

# Configuration
PAYMASTER_ADDRESS="0x98546B226dbbA8230cf620635a1e4ab01F6A99B2"
INITIAL_ALBUM_PRICE="32000000" # 32 USDC with 6 decimals
DEPLOYER_ADDRESS=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

echo "Deployer: $DEPLOYER_ADDRESS"
echo "Paymaster: $PAYMASTER_ADDRESS"
echo ""

# Deploy MockUSDC
echo -e "${GREEN}1. Deploying MockUSDC...${NC}"
USDC_OUTPUT=$(forge create src/MockUSDC.sol:MockUSDC \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --legacy 2>&1)

# Extract deployed address from output
USDC_ADDRESS=$(echo "$USDC_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
if [ -z "$USDC_ADDRESS" ]; then
    echo -e "${RED}Failed to deploy MockUSDC${NC}"
    echo "$USDC_OUTPUT"
    exit 1
fi
echo "MockUSDC deployed at: $USDC_ADDRESS"

# Deploy Store implementation
echo -e "${GREEN}2. Deploying Store implementation...${NC}"
STORE_IMPL_OUTPUT=$(forge create src/StoreV2.sol:StoreV2 \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --legacy 2>&1)

STORE_IMPL=$(echo "$STORE_IMPL_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
if [ -z "$STORE_IMPL" ]; then
    echo -e "${RED}Failed to deploy Store implementation${NC}"
    echo "$STORE_IMPL_OUTPUT"
    exit 1
fi
echo "Store implementation deployed at: $STORE_IMPL"

# Encode initialization data for Store proxy
echo -e "${GREEN}3. Preparing Store proxy initialization...${NC}"
STORE_INIT_DATA=$(cast calldata "initialize(address,address,uint256)" $USDC_ADDRESS $DEPLOYER_ADDRESS $INITIAL_ALBUM_PRICE)

# Deploy Store proxy
echo -e "${GREEN}4. Deploying Store proxy...${NC}"
STORE_PROXY_OUTPUT=$(forge create lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --constructor-args $STORE_IMPL $STORE_INIT_DATA \
    --legacy 2>&1)

STORE_PROXY=$(echo "$STORE_PROXY_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
if [ -z "$STORE_PROXY" ]; then
    echo -e "${RED}Failed to deploy Store proxy${NC}"
    echo "$STORE_PROXY_OUTPUT"
    exit 1
fi
echo "Store proxy deployed at: $STORE_PROXY"

# Mint initial USDC to deployer and Store
echo -e "${GREEN}5. Minting initial USDC...${NC}"
echo "Minting 10,000 USDC to deployer..."
cast send $USDC_ADDRESS "mintTo(address,uint256)" $DEPLOYER_ADDRESS 10000000000 \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --legacy > /dev/null

echo "Minting 1,000 USDC to Store contract..."
cast send $USDC_ADDRESS "mintTo(address,uint256)" $STORE_PROXY 1000000000 \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --legacy > /dev/null

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}TESTNET DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo "MockUSDC: $USDC_ADDRESS"
echo "Store Proxy: $STORE_PROXY"
echo "Store Implementation: $STORE_IMPL"
echo "Admin: $DEPLOYER_ADDRESS"
echo "Initial Album Price: 32 USDC"
echo "Store funded with: 1,000 USDC"
echo "Deployer funded with: 10,000 USDC"
echo -e "${GREEN}========================================${NC}"

# Update frontend/.env.local
echo -e "${YELLOW}Updating frontend/.env.local...${NC}"
cat > frontend/.env.local << EOF
# Auto-generated from deploy-testnet-paymaster.sh
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_USDC_ADDRESS=$USDC_ADDRESS
NEXT_PUBLIC_NETWORK=testnet
EOF

echo -e "${GREEN}✅ frontend/.env.local updated!${NC}"

# Save deployment info
cat > deployed-addresses-testnet.txt << EOF
# Sophon Testnet Deployment
STORE_PROXY=$STORE_PROXY
STORE_IMPL=$STORE_IMPL
USDC_ADDRESS=$USDC_ADDRESS
ADMIN=$DEPLOYER_ADDRESS
EOF

echo -e "${GREEN}✅ Deployment addresses saved to deployed-addresses-testnet.txt${NC}"