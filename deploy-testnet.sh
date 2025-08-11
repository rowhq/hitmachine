#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying to Sophon Testnet${NC}"
echo "========================================"

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ Error: PRIVATE_KEY environment variable not set${NC}"
    echo "Please set your private key: export PRIVATE_KEY=0x..."
    exit 1
fi

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