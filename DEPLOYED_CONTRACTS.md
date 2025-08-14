# Deployed Contracts

## Deployment Instructions

Deploy contracts with paymaster and automatic verification:

```bash
# For Sophon Testnet
source .env && forge script ./script/Deploy.s.sol \
  --rpc-url $SOPHON_TESTNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify

# For Sophon Mainnet  
source .env && forge script ./script/Deploy.s.sol \
  --rpc-url $SOPHON_MAINNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify
```

The deployment script:
- Automatically detects the network (testnet/mainnet) based on chain ID
- Uses the appropriate paymaster for gasless deployment
- Deploys upgradeable contracts using UUPS pattern
- Deploys MockUSDC only on testnet for testing
- Verifies contracts automatically on Sophscan

## Contract Addresses

### Sophon Testnet (Chain ID: 531050104)
- **Paymaster**: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2`
- **USDC**: `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`

#### Latest Deployment (2025-08-14)
- **MockUSDC**: `0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f`
- **NanoMusicStore Implementation**: `0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6`
- **NanoMusicStore Proxy**: `0x86E1D788FFCd8232D85dD7eB02c508e7021EB474`
- **NanoAnimalCare Implementation**: `0xDBc508c96aC737C9a856B0C98f5281E16C9c8F35`
- **NanoAnimalCare Proxy**: `0xAAfD6b707770BC9F60A773405dE194348B6C4392`

### Sophon Mainnet (Chain ID: 50104)
- **Paymaster**: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2`
- **USDC**: `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
- **NanoMusicStore**: (Check broadcast logs after deployment)
- **NanoAnimalCare**: (Check broadcast logs after deployment)

## Features

### NanoMusicStore
- Gift card purchases for 32 USDC
- Admin can withdraw funds
- Marketing payment functionality
- Fully upgradeable (UUPS pattern)

### NanoAnimalCare  
- Animal care service payments
- Pay cat feeders with USDC
- Emergency withdrawal functions
- Fully upgradeable (UUPS pattern)

## Post-Deployment Steps

1. **Verify Contracts**: Contracts are automatically verified during deployment with the `--verify` flag
2. **Grant Roles**: Use the deployed proxy contracts to grant necessary roles to operators
3. **Update Frontend**: Update the frontend configuration with the new contract addresses
4. **Test Transactions**: Verify the paymaster is working correctly for gasless transactions