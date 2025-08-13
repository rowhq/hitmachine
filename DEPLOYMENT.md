# Deployment Guide

## Prerequisites

1. Set up your environment variables in `.env`:
```bash
cp .env.example .env
# Edit .env with your values:
# - WALLET_PRIVATE_KEY (deployer wallet)
# - SOPHON_TESTNET_RPC_URL (https://rpc.testnet.sophon.xyz)
# - SOPHON_MAINNET_RPC_URL (https://rpc.sophon.xyz)
# - ETHERSCAN_SOPHON_API_KEY (for contract verification)
```

## Deployment Commands

### Testnet Deployment
```bash
forge script script/DeployTestnet.s.sol:DeployTestnetScript \
    --rpc-url sophonTestnet \
    --broadcast \
    --zksync \
    --verify \
    -vvv
```

This will:
- Deploy MockUSDC token for testing
- Deploy StoreV2 contract with 32 USDC gift card price
- Deploy JobsV2 contract for cat feeder payments
- Mint 10,000 test USDC to deployer and Jobs contract
- Auto-update `frontend/.env.local` with contract addresses
- Use paymaster for gasless deployment (optional)

### Mainnet Deployment
```bash
forge script script/DeployMainnet.s.sol:DeployMainnetScript \
    --rpc-url sophonMainnet \
    --broadcast \
    --zksync \
    --verify \
    -vvv
```

This will:
- Deploy StoreV2 contract with 32 USDC gift card price
- Deploy JobsV2 contract for cat feeder payments
- Use official USDC at `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
- Auto-update `frontend/.env.local` with contract addresses
- Use paymaster for gasless deployment

## Contract Details

- **Gift Card Price**: 32 USDC per gift card (32e6 with 6 decimals)
- **Paymaster Address**: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2` (both networks)
- **StoreV2**: Handles gift card purchases with simplified single-purchase flow
- **JobsV2**: Manages cat feeder payments with USDC distribution

## Post-Deployment

After deployment, the scripts automatically:
1. Save contract addresses to `deployed-addresses-[network].txt`
2. Update `frontend/.env.local` with:
   - `NEXT_PUBLIC_STORE_CONTRACT`
   - `NEXT_PUBLIC_JOBS_CONTRACT`
   - `NEXT_PUBLIC_USDC_ADDRESS`
   - `NEXT_PUBLIC_NETWORK`

### Grant Roles
After deployment, grant the MARKETING_BUDGET_ROLE to the nano wallet:
```bash
cast send $STORE_PROXY "grantRole(bytes32,address)" \
    $(cast keccak "MARKETING_BUDGET_ROLE") \
    $NANO_WALLET_ADDRESS \
    --private-key $WALLET_PRIVATE_KEY
```

## Verification

Contracts are automatically verified on Sophscan during deployment with the `--verify` flag.