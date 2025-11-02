#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Update Album Price - Sophon Testnet${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
SOPHON_TESTNET_RPC="https://rpc.testnet.sophon.xyz"
CHAIN_ID=531050104
NEW_PRICE="7.99 USDC"

echo -e "\n${YELLOW}Configuration:${NC}"
echo "Network: Sophon Testnet"
echo "RPC URL: $SOPHON_TESTNET_RPC"
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
echo -e "\n${YELLOW}Updating price on Sophon Testnet...${NC}"
forge script ./script/UpdatePriceTestnet.s.sol \
    --rpc-url $SOPHON_TESTNET_RPC \
    --zksync \
    --broadcast \
    -vvv

if [ $? -ne 0 ]; then
    echo -e "${RED}Price update failed!${NC}"
    exit 1
fi

echo -e "\n${GREEN}Price update complete!${NC}"
echo -e "${GREEN}New album price: $NEW_PRICE${NC}"
