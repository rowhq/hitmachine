# Environment Configuration

This project uses a unified environment configuration system that controls whether the application runs on testnet or mainnet.

## Setting the Environment

Set the `NEXT_PUBLIC_NETWORK` environment variable:

```bash
# For testnet (default)
NEXT_PUBLIC_NETWORK=testnet

# For mainnet
NEXT_PUBLIC_NETWORK=mainnet
```

## Configuration Files

### Frontend Configuration
- `frontend/app/config/environment.ts` - Main environment configuration
- `frontend/app/config/contracts.ts` - Re-exports environment config for backwards compatibility
- `frontend/app/config.ts` - Legacy config that uses environment config

### Key Features
1. **Single Source of Truth**: All contract addresses and network settings are defined in one place
2. **Type Safety**: TypeScript ensures correct usage of network configurations
3. **No Query Parameters**: The network is determined by environment variable, not URL parameters
4. **Automatic Chain Selection**: The correct chain (testnet/mainnet) is selected based on environment

## Contract Addresses

### Testnet
- Store Contract: `0x86E1D788FFCd8232D85dD7eB02c508e7021EB474`
- Animal Care Contract: `0xAAfD6b707770BC9F60A773405dE194348B6C4392`
- USDC: `0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f` (MockUSDC)
- Paymaster: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2`

### Mainnet
- Store Contract: `0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5`
- Animal Care Contract: (Not deployed yet)
- USDC: `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
- Paymaster: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2`

## Deployment

Use the new deployment script that respects the environment:

```bash
# Deploy to testnet (default)
forge script ./script/DeployWithConfig.s.sol --rpc-url $SOPHON_TESTNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast

# Deploy to mainnet
NETWORK=mainnet forge script ./script/DeployWithConfig.s.sol --rpc-url $SOPHON_MAINNET_RPC_URL --private-key $WALLET_PRIVATE_KEY --zksync --broadcast
```

## API Endpoints

All API endpoints automatically use the correct network based on `NEXT_PUBLIC_NETWORK`:
- `/api/generate-account` - No need for `?testnet=true` anymore
- `/api/purchase-giftcard` - No need for `?testnet=true` anymore

## Gift Card Price

The gift card price is centrally defined:
- Price: 31.96 USDC
- Constant: `GIFT_CARD_PRICE` (BigInt for calculations)
- Display: `GIFT_CARD_PRICE_DISPLAY` (string for UI)