#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Sophon Testnet Deployment${NC}"
echo -e "${GREEN}=====================================${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with WALLET_PRIVATE_KEY"
    exit 1
fi

# Load environment variables
source .env

# Check if tokens are already deployed
if [ -z "$USDC_ADDRESS" ] || [ -z "$SOPH_ADDRESS" ]; then
    echo -e "${YELLOW}Mock tokens not found. Deploying...${NC}"
    
    # Deploy mock tokens
    forge script script/DeployMocks.s.sol:DeployMocksScript \
        --rpc-url https://rpc.testnet.sophon.xyz \
        --broadcast \
        --slow \
        -vvv
    
    echo -e "${YELLOW}Please update your .env file with the deployed token addresses and run this script again${NC}"
    exit 0
fi

echo -e "${GREEN}Using existing tokens:${NC}"
echo "  USDC: $USDC_ADDRESS"
echo "  SOPH: $SOPH_ADDRESS"

# Deploy main contracts
echo -e "${GREEN}Deploying Store and Jobs contracts...${NC}"
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url https://rpc.testnet.sophon.xyz \
    --broadcast \
    --slow \
    --verify \
    -vvv

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"