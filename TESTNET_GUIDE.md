# Sophon Testnet Deployment Guide

## Quick Start

```bash
# 1. Set your private key
export PRIVATE_KEY=0x...

# 2. Run the automated setup
./setup-testnet.sh

# 3. Start the frontend
cd frontend && npm run dev
```

## Detailed Steps

### 1. Prerequisites

- **Node.js** 18+ and npm
- **Foundry** - Install from https://getfoundry.sh
- **jq** - Install with `brew install jq`
- **Testnet SOPH** - Get from Sophon faucet

### 2. Get Testnet Funds

1. Visit Sophon Testnet Faucet (if available)
2. Or request in their Discord
3. Network details:
   - Chain ID: `531050104`
   - RPC: `https://rpc.testnet.sophon.xyz`
   - Explorer: `https://explorer.testnet.sophon.xyz`

### 3. Deploy Contracts

```bash
# Set your deployer private key
export PRIVATE_KEY=0x...

# Option A: Automated setup (recommended)
./setup-testnet.sh

# Option B: Manual deployment
./deploy-testnet.sh
```

The script will:
- Deploy MockUSDC (test token)
- Deploy StoreV2 (album purchase contract)
- Deploy JobsV2 (distribution contract)
- Extract ABIs to frontend
- Create .env.local file

### 4. Configure Frontend

Edit `frontend/.env.local`:

```env
# These are set automatically by setup script
NEXT_PUBLIC_STORE_CONTRACT=0x...
NEXT_PUBLIC_JOBS_CONTRACT=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...

# Add these manually:
MNEMONIC=your twelve word seed phrase here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=get_from_cloud.walletconnect.com

# For Vercel KV (optional for local dev):
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

### 5. Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000

### 6. Test the System

1. **Connect Wallet**: Click "Connect" button in top right
2. **Mint Test USDC**: Use the yellow "Testnet Tools" box
3. **Buy Album**: Use StoreContract component
4. **Check Analytics**: Visit `/api/analytics`

### 7. API Endpoints

All endpoints work on testnet:

- `POST /api/generate-account` - Create funded wallet
- `POST /api/purchase-album?address=0x...` - Buy album
- `GET /api/check-balances` - Check contract balances
- `GET /api/analytics` - View stats
- `POST /api/mass-buy` - Bulk purchases (needs API key)

### 8. Deploy to Vercel

1. Push to GitHub:
```bash
git add -A
git commit -m "Deploy to testnet"
git push
```

2. Import to Vercel:
- Go to vercel.com
- Import repository
- Set environment variables from `.env.local`

3. Configure Vercel KV:
- Go to Storage tab
- Create KV database
- Copy credentials to environment variables

## Contract Addresses (After Deployment)

Your deployment will create:
- **MockUSDC**: Test token with public mint function
- **StoreV2**: Album purchase contract (0.01 USDC per album)
- **JobsV2**: Fund distribution contract

## Roles and Permissions

The deployer address gets all roles:
- `DEFAULT_ADMIN_ROLE` - Can upgrade contracts
- `ADMIN_ROLE` - Full control
- `OPERATOR_ROLE` - Can pause/unpause
- `WITHDRAWER_ROLE` - Can withdraw funds

## Testing Workflow

1. **Mint USDC**: Call `mint()` on MockUSDC (1000 USDC per hour limit)
2. **Generate Wallets**: Use `/api/generate-account` to create funded wallets
3. **Buy Albums**: Each wallet can buy once for 0.01 USDC
4. **Monitor**: Check `/api/analytics` for stats
5. **Auto-refill**: Cron job claims from Store when Jobs < $1000

## Troubleshooting

### "No tests found"
```bash
forge test
```

### Frontend build errors
```bash
cd frontend
npm install
./scripts/extract-abis.sh
```

### Contract not verified
Sophon testnet explorer may not support verification yet.

### Transaction failing
- Check wallet has SOPH for gas
- Check USDC approval for Store contract
- Ensure contracts are deployed (not 0x0000...)

## Mainnet Migration

1. Update `frontend/.env.local`:
```env
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_USDC_ADDRESS=0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F  # Real USDC
```

2. Deploy with mainnet script:
```bash
forge script script/DeployUpgradeable.s.sol:DeployUpgradeableScript \
  --rpc-url https://rpc.sophon.xyz \
  --broadcast
```

3. Remove testnet tools from UI

## Support

- GitHub Issues: https://github.com/rowhq/hitmachine/issues
- Sophon Discord: For testnet SOPH and support