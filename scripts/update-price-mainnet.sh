#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}========================================${NC}"
echo -e "${RED}⚠️  MAINNET PRICE UPDATE WARNING ⚠️${NC}"
echo -e "${RED}========================================${NC}"
echo -e "${YELLOW}This will update the album price on${NC}"
echo -e "${YELLOW}PRODUCTION MAINNET from 31.96 to 7.99 USDC${NC}"
echo -e "${RED}========================================${NC}"

# Prompt for confirmation
read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Update cancelled.${NC}"
    exit 0
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Update Album Price - Sophon Mainnet${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
SOPHON_MAINNET_RPC="https://rpc.sophon.xyz"
CHAIN_ID=50104
NEW_PRICE="7.99 USDC"

echo -e "\n${YELLOW}Configuration:${NC}"
echo "Network: Sophon Mainnet"
echo "RPC URL: $SOPHON_MAINNET_RPC"
echo "Chain ID: $CHAIN_ID"
echo "New Price: $NEW_PRICE"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "\n${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with:"
    echo "PROD_WALLET=your_12_word_mnemonic_here"
    exit 1
fi

# Source environment variables
source .env

# Check if PROD_WALLET is set
if [ -z "$PROD_WALLET" ]; then
    echo -e "\n${RED}Error: PROD_WALLET not set in .env!${NC}"
    echo "Please add: PROD_WALLET=your_12_word_mnemonic_here"
    exit 1
fi

# Build contracts
echo -e "\n${YELLOW}Building contracts...${NC}"
forge build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

# Run the price update script
echo -e "\n${YELLOW}Updating price on Sophon Mainnet...${NC}"
forge script ./script/UpdatePriceMainnet.s.sol \
    --rpc-url $SOPHON_MAINNET_RPC \
    --zksync \
    --broadcast \
    -vvv

if [ $? -ne 0 ]; then
    echo -e "${RED}Price update failed!${NC}"
    exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}MAINNET PRICE UPDATE COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}New album price: $NEW_PRICE${NC}"
echo -e "${GREEN}========================================${NC}"
