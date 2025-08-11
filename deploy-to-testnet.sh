#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}   Sophon Testnet Full Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"

# Configuration
DEPLOYER_ADDRESS="0x4f2CBdDe7dc571e31b2BFE013ba0e2DB50f22ead"
SOPHON_TESTNET_RPC="https://rpc.testnet.sophon.xyz"
CHAIN_ID=531050104

echo -e "\n${YELLOW}📋 Configuration:${NC}"
echo "   Deployer: $DEPLOYER_ADDRESS"
echo "   Network: Sophon Testnet"
echo "   RPC URL: $SOPHON_TESTNET_RPC"
echo "   Chain ID: $CHAIN_ID"

# Step 1: Check prerequisites
echo -e "\n${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo -e "\n${YELLOW}Creating .env template...${NC}"
    cat > .env << EOF
# Deployment configuration
PRIVATE_KEY=your_private_key_without_0x_prefix
SOPHON_TESTNET_RPC_URL=$SOPHON_TESTNET_RPC
SOPHON_MAINNET_RPC_URL=https://rpc.sophon.xyz
ETHERSCAN_SOPHON_API_KEY=your_etherscan_api_key_if_available

# Wallet configuration
WALLET_PRIVATE_KEY=your_private_key_without_0x_prefix
MNEMONIC=your twelve word mnemonic phrase here for wallet generation

# Vercel KV (for rate limiting)
KV_REST_API_URL=your_vercel_kv_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_rest_api_token
EOF
    echo -e "${GREEN}✅ .env template created. Please fill in your values and run again.${NC}"
    exit 1
fi

# Source environment variables
source .env

# Check required variables
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ PRIVATE_KEY not set in .env!${NC}"
    exit 1
fi

if [ -z "$MNEMONIC" ]; then
    echo -e "${RED}❌ MNEMONIC not set in .env!${NC}"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq not installed. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        echo -e "${RED}Please install jq manually: sudo apt-get install jq${NC}"
        exit 1
    fi
fi

# Step 2: Build contracts
echo -e "\n${YELLOW}🔨 Building contracts...${NC}"
forge build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Contracts built successfully${NC}"

# Step 3: Extract and update ABIs
echo -e "\n${YELLOW}📄 Extracting ABIs...${NC}"
cat out/StoreV2.sol/StoreV2.json | jq '.abi' > frontend/app/abi/storeV2.json
cat out/JobsV2.sol/JobsV2.json | jq '.abi' > frontend/app/abi/jobsV2.json
echo -e "${GREEN}✅ ABIs updated in frontend${NC}"

# Step 4: Deploy contracts
echo -e "\n${YELLOW}🚀 Deploying contracts to Sophon Testnet...${NC}"
forge script script/DeployUpgradeable.s.sol:DeployUpgradeableScript \
    --rpc-url $SOPHON_TESTNET_RPC \
    --broadcast \
    --verify \
    --etherscan-api-key ${ETHERSCAN_SOPHON_API_KEY:-"no-api-key"} \
    -vvvv

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

# Step 5: Extract deployed addresses
echo -e "\n${YELLOW}📍 Extracting deployed addresses...${NC}"
BROADCAST_FILE="broadcast/DeployUpgradeable.s.sol/$CHAIN_ID/run-latest.json"

if [ -f "$BROADCAST_FILE" ]; then
    # Extract proxy addresses (they're deployed as ERC1967Proxy)
    PROXIES=$(jq -r '.transactions[] | select(.contractName == "ERC1967Proxy") | .contractAddress' $BROADCAST_FILE)
    STORE_PROXY=$(echo "$PROXIES" | head -n 1)
    JOBS_PROXY=$(echo "$PROXIES" | tail -n 1)
    
    echo -e "${GREEN}✅ Contracts deployed:${NC}"
    echo "   Store: $STORE_PROXY"
    echo "   Jobs: $JOBS_PROXY"
    
    # Step 6: Create deployment record
    echo -e "\n${YELLOW}💾 Saving deployment info...${NC}"
    cat > deployment-testnet.json << EOF
{
  "network": "sophon-testnet",
  "chainId": $CHAIN_ID,
  "deployer": "$DEPLOYER_ADDRESS",
  "contracts": {
    "store": "$STORE_PROXY",
    "jobs": "$JOBS_PROXY",
    "usdc": "0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F"
  },
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "explorerUrl": "https://explorer.testnet.sophon.xyz"
}
EOF
    echo -e "${GREEN}✅ deployment-testnet.json created${NC}"
    
    # Step 7: Update frontend environment
    echo -e "\n${YELLOW}⚙️  Configuring frontend...${NC}"
    cat > frontend/.env.local << EOF
# Contract addresses (Sophon Testnet)
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY

# WalletConnect Project ID (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-YOUR_PROJECT_ID}

# Wallet configuration
WALLET_PRIVATE_KEY=$PRIVATE_KEY
MNEMONIC=$MNEMONIC
RPC_URL=$SOPHON_TESTNET_RPC

# Vercel KV Configuration
KV_REST_API_URL=$KV_REST_API_URL
KV_REST_API_TOKEN=$KV_REST_API_TOKEN

# CORS (allow all origins)
ALLOWED_ORIGIN=*
EOF
    echo -e "${GREEN}✅ frontend/.env.local created${NC}"
    
    # Step 8: Display summary
    echo -e "\n${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}   🎉 Deployment Successful!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo
    echo -e "${BLUE}📝 Contract Addresses:${NC}"
    echo "   Store Contract: $STORE_PROXY"
    echo "   Jobs Contract: $JOBS_PROXY"
    echo
    echo -e "${BLUE}🔗 Explorer Links:${NC}"
    echo "   Store: https://explorer.testnet.sophon.xyz/address/$STORE_PROXY"
    echo "   Jobs: https://explorer.testnet.sophon.xyz/address/$JOBS_PROXY"
    echo
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "   1. Test locally:"
    echo "      ${YELLOW}cd frontend && npm install && npm run dev${NC}"
    echo
    echo "   2. Deploy to Vercel:"
    echo "      ${YELLOW}cd frontend && vercel${NC}"
    echo
    echo "   3. Set Vercel environment variables:"
    echo "      - Copy contents of frontend/.env.local"
    echo "      - Add to Vercel project settings"
    echo
    echo "   4. Test the contracts:"
    echo "      - Connect wallet at http://localhost:3000"
    echo "      - Use the admin dashboard to interact"
    echo
    echo -e "${GREEN}✨ All done! Your contracts are live on Sophon Testnet.${NC}"
    
else
    echo -e "${RED}❌ Could not find broadcast file${NC}"
    echo "Please check the forge output above for deployed addresses"
fi