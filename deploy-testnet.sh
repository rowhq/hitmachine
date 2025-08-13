#!/bin/bash
set -e

# Load environment variables
source .env

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Deploying to Sophon Testnet with Paymaster...${NC}"

# Check required environment variables
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo -e "${RED}ERROR: WALLET_PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

if [ -z "$USDC_ADDRESS" ]; then
    echo -e "${YELLOW}Using default testnet USDC address${NC}"
    export USDC_ADDRESS="0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F"
fi

if [ -z "$SOPH_ADDRESS" ]; then
    echo -e "${YELLOW}Using default testnet SOPH address${NC}"
    export SOPH_ADDRESS="0x5021c14Ff6001E9b889E788a9136f14200fCa364"
fi

# Testnet paymaster address from Sophon docs
export PAYMASTER_ADDRESS="0xd4240987D05E0F04A0e8Dfb5140A6936c4F78025"

echo -e "${GREEN}Configuration:${NC}"
echo "  USDC: $USDC_ADDRESS"
echo "  SOPH: $SOPH_ADDRESS"
echo "  Paymaster: $PAYMASTER_ADDRESS"

# Deploy Store implementation
echo -e "${GREEN}Deploying Store implementation...${NC}"
STORE_IMPL=$(forge create ./src/StoreV2.sol:StoreV2 \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --json | jq -r '.deployedTo')

echo "Store implementation deployed at: $STORE_IMPL"

# Deploy Store proxy with initialization
echo -e "${GREEN}Deploying Store proxy...${NC}"
INITIAL_ALBUM_PRICE=10000 # 0.01 USDC with 6 decimals
DEPLOYER_ADDRESS=$(cast wallet address --private-key $WALLET_PRIVATE_KEY)

# Encode initialization data
STORE_INIT_DATA=$(cast calldata "initialize(address,address,uint256)" $USDC_ADDRESS $DEPLOYER_ADDRESS $INITIAL_ALBUM_PRICE)

STORE_PROXY=$(forge create ./lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --constructor-args $STORE_IMPL $STORE_INIT_DATA \
    --json | jq -r '.deployedTo')

echo "Store proxy deployed at: $STORE_PROXY"

# Deploy Jobs implementation
echo -e "${GREEN}Deploying Jobs implementation...${NC}"
JOBS_IMPL=$(forge create ./src/JobsV2.sol:JobsV2 \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --json | jq -r '.deployedTo')

echo "Jobs implementation deployed at: $JOBS_IMPL"

# Deploy Jobs proxy with initialization
echo -e "${GREEN}Deploying Jobs proxy...${NC}"
JOBS_INIT_DATA=$(cast calldata "initialize(address,address,address,address)" $USDC_ADDRESS $SOPH_ADDRESS $DEPLOYER_ADDRESS $STORE_PROXY)

JOBS_PROXY=$(forge create ./lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    --constructor-args $JOBS_IMPL $JOBS_INIT_DATA \
    --json | jq -r '.deployedTo')

echo "Jobs proxy deployed at: $JOBS_PROXY"

# Grant WITHDRAWER_ROLE to Jobs contract
echo -e "${GREEN}Granting WITHDRAWER_ROLE to Jobs contract...${NC}"
WITHDRAWER_ROLE=$(cast keccak "WITHDRAWER_ROLE")
cast send $STORE_PROXY "grantRole(bytes32,address)" $WITHDRAWER_ROLE $JOBS_PROXY \
    --rpc-url sophonTestnet \
    --private-key $WALLET_PRIVATE_KEY

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}TESTNET DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo "USDC Address: $USDC_ADDRESS"
echo "SOPH Address: $SOPH_ADDRESS"
echo "Store Proxy: $STORE_PROXY"
echo "Store Implementation: $STORE_IMPL"
echo "Jobs Proxy: $JOBS_PROXY"
echo "Jobs Implementation: $JOBS_IMPL"
echo "Admin: $DEPLOYER_ADDRESS"
echo "Initial Album Price: 0.01 USDC"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Update your frontend/.env with:${NC}"
echo "NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY"
echo "NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY"
echo -e "${GREEN}========================================${NC}"

# Save deployment addresses
echo "# Sophon Testnet Deployment" > deployed-addresses-testnet.txt
echo "Deployed at: $(date)" >> deployed-addresses-testnet.txt
echo "USDC_ADDRESS=$USDC_ADDRESS" >> deployed-addresses-testnet.txt
echo "SOPH_ADDRESS=$SOPH_ADDRESS" >> deployed-addresses-testnet.txt
echo "STORE_PROXY=$STORE_PROXY" >> deployed-addresses-testnet.txt
echo "STORE_IMPL=$STORE_IMPL" >> deployed-addresses-testnet.txt
echo "JOBS_PROXY=$JOBS_PROXY" >> deployed-addresses-testnet.txt
echo "JOBS_IMPL=$JOBS_IMPL" >> deployed-addresses-testnet.txt
echo "ADMIN=$DEPLOYER_ADDRESS" >> deployed-addresses-testnet.txt