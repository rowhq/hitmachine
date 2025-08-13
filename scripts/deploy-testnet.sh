#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Sophon Testnet Deployment Script${NC}"
echo -e "${GREEN}================================${NC}"

# Configuration
DEPLOYER_ADDRESS="0x4f2CBdDe7dc571e31b2BFE013ba0e2DB50f22ead"
SOPHON_TESTNET_RPC="https://rpc.testnet.sophon.xyz"
CHAIN_ID=531050104

echo -e "\n${YELLOW}Configuration:${NC}"
echo "Deployer Address: $DEPLOYER_ADDRESS"
echo "Network: Sophon Testnet"
echo "RPC URL: $SOPHON_TESTNET_RPC"
echo "Chain ID: $CHAIN_ID"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "\n${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file with:"
    echo "PRIVATE_KEY=your_private_key_without_0x"
    echo "SOPHON_TESTNET_RPC_URL=$SOPHON_TESTNET_RPC"
    exit 1
fi

# Source environment variables
source .env

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "\n${RED}Error: PRIVATE_KEY not set in .env!${NC}"
    exit 1
fi

# Build contracts
echo -e "\n${YELLOW}Building contracts...${NC}"
forge build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

# Deploy contracts
echo -e "\n${YELLOW}Deploying contracts to Sophon Testnet...${NC}"
forge script script/DeployUpgradeable.s.sol:DeployUpgradeableScript \
    --rpc-url $SOPHON_TESTNET_RPC \
    --broadcast \
    --verify \
    --etherscan-api-key ${ETHERSCAN_SOPHON_API_KEY:-"no-api-key"} \
    -vvvv

if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi

# Extract deployed addresses from broadcast file
BROADCAST_FILE="broadcast/DeployUpgradeable.s.sol/$CHAIN_ID/run-latest.json"

if [ -f "$BROADCAST_FILE" ]; then
    echo -e "\n${YELLOW}Extracting deployed addresses...${NC}"
    
    # Use jq to extract addresses (install with: brew install jq)
    if command -v jq &> /dev/null; then
        STORE_PROXY=$(jq -r '.transactions[] | select(.contractName == "ERC1967Proxy") | .contractAddress' $BROADCAST_FILE | head -n 1)
        JOBS_PROXY=$(jq -r '.transactions[] | select(.contractName == "ERC1967Proxy") | .contractAddress' $BROADCAST_FILE | tail -n 1)
        
        echo -e "\n${GREEN}Deployment Successful!${NC}"
        echo -e "${GREEN}=====================${NC}"
        echo "Store Contract: $STORE_PROXY"
        echo "Jobs Contract: $JOBS_PROXY"
        
        # Create deployment info file
        cat > deployment-testnet.json << EOF
{
  "network": "sophon-testnet",
  "chainId": $CHAIN_ID,
  "deployer": "$DEPLOYER_ADDRESS",
  "contracts": {
    "store": "$STORE_PROXY",
    "jobs": "$JOBS_PROXY"
  },
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
        
        echo -e "\n${YELLOW}Deployment info saved to deployment-testnet.json${NC}"
        
        # Update frontend .env
        echo -e "\n${YELLOW}Creating frontend .env.local...${NC}"
        cat > frontend/.env.local << EOF
# Contract addresses (Sophon Testnet)
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID_HERE

# Wallet configuration
WALLET_PRIVATE_KEY=$PRIVATE_KEY
MNEMONIC=$MNEMONIC
RPC_URL=$SOPHON_TESTNET_RPC

# Vercel KV Configuration
KV_REST_API_URL=$KV_REST_API_URL
KV_REST_API_TOKEN=$KV_REST_API_TOKEN
EOF
        
        echo -e "${GREEN}Frontend .env.local created!${NC}"
        
        echo -e "\n${GREEN}Next Steps:${NC}"
        echo "1. Update WalletConnect Project ID in frontend/.env.local"
        echo "2. Deploy frontend: cd frontend && vercel"
        echo "3. Test the deployment at http://localhost:3000"
        
    else
        echo -e "${YELLOW}Install jq for automatic address extraction: brew install jq${NC}"
        echo "Check $BROADCAST_FILE for deployed addresses"
    fi
else
    echo -e "${YELLOW}Broadcast file not found. Check forge output for deployed addresses.${NC}"
fi

echo -e "\n${GREEN}Deployment complete!${NC}"