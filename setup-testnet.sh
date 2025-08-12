#!/bin/bash

# Complete setup script for Sophon Testnet deployment

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     HitMachine - Sophon Testnet Setup Script${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Foundry not installed. Install from: https://getfoundry.sh${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq not installed. Install with: brew install jq${NC}"
    exit 1
fi

# Step 2: Load environment variables
echo -e "${YELLOW}📋 Loading environment variables...${NC}"
source ./scripts/load-env.sh

# Check if WALLET_PRIVATE_KEY is set
if [ -z "$WALLET_PRIVATE_KEY" ]; then
    echo -e "${RED}❌ WALLET_PRIVATE_KEY not set${NC}"
    echo -e "${YELLOW}Please either:${NC}"
    echo -e "  1. Set in .env.local file: WALLET_PRIVATE_KEY=0x..."
    echo -e "  2. Export directly: export WALLET_PRIVATE_KEY=0x..."
    exit 1
fi

# Use WALLET_PRIVATE_KEY for deployment
export PRIVATE_KEY=$WALLET_PRIVATE_KEY

echo -e "${GREEN}✅ Prerequisites checked${NC}"
echo ""

# Step 3: Build contracts
echo -e "${YELLOW}🔨 Building contracts...${NC}"
forge build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Contracts built${NC}"
echo ""

# Step 4: Deploy to testnet
echo -e "${YELLOW}🚀 Deploying to Sophon Testnet...${NC}"
echo -e "${YELLOW}   Chain ID: 531050104${NC}"
echo -e "${YELLOW}   RPC: https://rpc.testnet.sophon.xyz${NC}"
echo ""

# Deploy and capture output
OUTPUT=$(forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url https://rpc.testnet.sophon.xyz \
    --broadcast \
    --legacy \
    -vvv 2>&1)

echo "$OUTPUT"

# Extract addresses from output
MOCK_USDC=$(echo "$OUTPUT" | grep "Mock USDC:" | awk '{print $NF}')
STORE_PROXY=$(echo "$OUTPUT" | grep "Store Proxy:" | awk '{print $NF}')
JOBS_PROXY=$(echo "$OUTPUT" | grep "Jobs Proxy:" | awk '{print $NF}')

if [ -z "$MOCK_USDC" ] || [ -z "$STORE_PROXY" ] || [ -z "$JOBS_PROXY" ]; then
    echo -e "${RED}❌ Failed to extract contract addresses${NC}"
    echo "Please check the output above and manually update your .env file"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Contracts deployed!${NC}"
echo ""

# Step 5: Extract ABIs
echo -e "${YELLOW}📦 Extracting ABIs...${NC}"
./scripts/extract-abis.sh
echo -e "${GREEN}✅ ABIs extracted${NC}"
echo ""

# Step 6: Create .env file for frontend
ENV_FILE="frontend/.env.local"
echo -e "${YELLOW}📝 Creating $ENV_FILE...${NC}"

cat > $ENV_FILE << EOF
# Contract addresses (Sophon Testnet)
NEXT_PUBLIC_STORE_CONTRACT=$STORE_PROXY
NEXT_PUBLIC_JOBS_CONTRACT=$JOBS_PROXY
NEXT_PUBLIC_USDC_ADDRESS=$MOCK_USDC

# Network configuration
RPC_URL=https://rpc.testnet.sophon.xyz

# Wallet configuration (update these!)
WALLET_PRIVATE_KEY=$WALLET_PRIVATE_KEY
MNEMONIC=your_twelve_word_mnemonic_phrase_here

# Vercel KV (get from vercel.com/storage)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# API Security (optional)
MASS_BUY_API_KEY=
ANALYTICS_API_KEY=
CRON_SECRET=

# WalletConnect (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
EOF

echo -e "${GREEN}✅ Environment file created${NC}"
echo ""

# Step 7: Display summary
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📋 Deployed Contracts:${NC}"
echo -e "   Mock USDC:    ${GREEN}$MOCK_USDC${NC}"
echo -e "   Store Proxy:  ${GREEN}$STORE_PROXY${NC}"
echo -e "   Jobs Proxy:   ${GREEN}$JOBS_PROXY${NC}"
echo ""
echo -e "${YELLOW}🔧 Next Steps:${NC}"
echo -e "   1. Update ${BLUE}frontend/.env.local${NC} with:"
echo -e "      - Your MNEMONIC for wallet generation"
echo -e "      - Vercel KV credentials (from vercel.com/storage)"
echo -e "      - WalletConnect Project ID (from cloud.walletconnect.com)"
echo ""
echo -e "   2. Start the frontend:"
echo -e "      ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "   3. To mint test USDC:"
echo -e "      Visit the frontend and call mint() on:"
echo -e "      ${GREEN}$MOCK_USDC${NC}"
echo ""
echo -e "   4. For production deployment to Vercel:"
echo -e "      - Push to GitHub"
echo -e "      - Import to Vercel"
echo -e "      - Add environment variables from .env.local"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"