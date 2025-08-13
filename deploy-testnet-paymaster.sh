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

# Testnet paymaster address from Sophon docs
export PAYMASTER_ADDRESS="0xd4240987D05E0F04A0e8Dfb5140A6936c4F78025"

echo -e "${GREEN}Using Paymaster for gasless deployment: $PAYMASTER_ADDRESS${NC}"

# Run the deployment script with paymaster flags
forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url sophonTestnet \
    --broadcast \
    --zksync \
    --zk-paymaster-address $PAYMASTER_ADDRESS \
    --zk-paymaster-input $(cast calldata "general(bytes)" "0x") \
    --verify \
    -vvv

echo -e "${GREEN}Deployment complete! Check the output above for contract addresses.${NC}"