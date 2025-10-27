# Deployed Contracts

## Deployment Instructions

Use separate deployment scripts for testnet and mainnet to prevent accidental mainnet deployments.

### For Sophon Testnet

```bash
source .env && forge script ./script/DeployTestnet.s.sol \
  --rpc-url $SOPHON_TESTNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify \
  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \
  --verifier-url https://explorer.testnet.sophon.xyz/api
```

**Testnet deployment:**
- Automatically detects if on testnet (chain ID: 531050104)
- Deploys MockUSDC for testing
- Uses testnet paymaster for gasless deployment
- Verifies contracts automatically on testnet explorer

### For Sophon Mainnet (PRODUCTION)

```bash
source .env && forge script ./script/DeployMainnet.s.sol \
  --rpc-url $SOPHON_MAINNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify \
  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \
  --verifier-url https://explorer.sophon.xyz/api
```

**Mainnet deployment:**
- Automatically detects if on mainnet (chain ID: 50104)
- Uses real USDC at `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
- Uses mainnet paymaster for gasless deployment
- Verifies contracts automatically on mainnet explorer
- Will **FAIL** if you accidentally run this on testnet or wrong RPC

### Security Features

Both scripts:
- Include chain ID verification to prevent accidental cross-chain deployment
- Will fail with clear error message if run on wrong network
- Use upgradeable UUPS pattern for future contract upgrades
- Deploy with paymaster for gasless transactions
- **Automatically grant all necessary roles during deployment** (no separate step needed)

### Roles Granted Automatically

After deployment, the following roles are automatically granted:
- **Index 0** (Deployer/Nano Wallet): DEFAULT_ADMIN_ROLE + ADMIN_ROLE on both contracts
- **Index 2** (derived from ADMIN_MNEMONIC): ADMIN_ROLE on NanoBand
- **Index 3** (derived from ADMIN_MNEMONIC): ADMIN_ROLE on NanoMusicStore
- **Index 4** (derived from ADMIN_MNEMONIC): MARKETING_BUDGET_ROLE on NanoMusicStore
- **Indices 100-200** (derived from ADMIN_MNEMONIC): DISTRIBUTOR_ROLE on NanoBand (for wallet funding)

**Note:** Index 1 is reserved/unused

## Contract Addresses

### Sophon Testnet (Chain ID: 531050104)
- **Paymaster**: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2`
- **USDC**: `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`

#### Latest Deployment (2025-08-14)
- **MockUSDC**: `0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f`
- **NanoMusicStore Implementation**: `0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6`
- **NanoMusicStore Proxy**: `0x86E1D788FFCd8232D85dD7eB02c508e7021EB474`
- **NanoBand Implementation**: `0xDBc508c96aC737C9a856B0C98f5281E16C9c8F35`
- **NanoBand Proxy**: `0xAAfD6b707770BC9F60A773405dE194348B6C4392`

### Sophon Mainnet (Chain ID: 50104)
- **Paymaster**: `0x98546B226dbbA8230cf620635a1e4ab01F6A99B2`
- **USDC**: `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
- **NanoMusicStore**: (Check broadcast logs after deployment)
- **NanoBand**: (Check broadcast logs after deployment)

## Features

### NanoMusicStore
- Gift card purchases for 31.96 USDC
- Admin can withdraw funds
- Marketing payment functionality
- Fully upgradeable (UUPS pattern)

### NanoBand
- Wallet funding for gift card purchases
- Song submission payments with USDC
- Emergency withdrawal functions
- Fully upgradeable (UUPS pattern)

## Post-Deployment Steps

1. **Verify Contracts**: Contracts are automatically verified during deployment with the `--verify` flag
2. **Grant Roles**: Use the deployed proxy contracts to grant necessary roles to operators
3. **Update Frontend**: Update the frontend configuration with the new contract addresses
4. **Test Transactions**: Verify the paymaster is working correctly for gasless transactions