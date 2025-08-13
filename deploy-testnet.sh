#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying to Sophon Testnet${NC}"
echo "========================================"

# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    echo -e "${YELLOW}📋 Loading from .env.local file...${NC}"
    export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    echo -e "${YELLOW}📋 Loading from .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if WALLET_PRIVATE_KEY is set
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo -e "${RED}❌ Error: WALLET_PRIVATE_KEY environment variable not set${NC}"
    echo -e "${YELLOW}Please either:${NC}"
    echo "  1. Set in .env.local file: WALLET_PRIVATE_KEY=0x..."
    echo "  2. Export directly: export WALLET_PRIVATE_KEY=0x..."
    exit 1
fi

# Use WALLET_PRIVATE_KEY for deployment
export PRIVATE_KEY=$WALLET_PRIVATE_KEY

# Set RPC URL for Sophon Testnet
export RPC_URL="https://rpc.testnet.sophon.xyz"

echo -e "${YELLOW}📦 Building contracts...${NC}"
forge build

echo -e "${YELLOW}🔗 Deploying to Sophon Testnet...${NC}"
forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy \
    -vvv

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Check the console output above for contract addresses"
    echo "2. Update your .env file with the new addresses"
    echo "3. Users can mint test USDC from the MockUSDC contract"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi