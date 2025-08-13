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
- Deploy Store contract with 32 USDC album price
- Mint 10,000 test USDC to deployer
- Auto-update `frontend/.env.local` with contract addresses
- Use paymaster for gasless deployment

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
- Deploy Store contract with 32 USDC album price
- Use official USDC at `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
- Auto-update `frontend/.env.local` with contract addresses
- Use paymaster for gasless deployment

## Contract Details

- **Album Price**: 32 USDC per album
- **Standard Purchase**: 32 USDC (matches EXPECTED_PURCHASE_AMOUNT in contract)
- **Paymaster Address**: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2` (both networks)

## Post-Deployment

After deployment, the scripts automatically:
1. Save contract addresses to `deployed-addresses-[network].txt`
2. Update `frontend/.env.local` with:
   - `NEXT_PUBLIC_STORE_CONTRACT`
   - `NEXT_PUBLIC_USDC_ADDRESS`
   - `NEXT_PUBLIC_NETWORK`

No manual configuration needed!

## Verification

Contracts are automatically verified on Sophscan during deployment with the `--verify` flag.