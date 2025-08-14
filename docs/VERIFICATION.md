# Contract Verification on Sophon

This document explains how to verify smart contracts on the Sophon network (zkSync-based).

## Prerequisites

1. **Sophscan API Key**: Get your API key from [Sophon Explorer](https://explorer.testnet.sophon.xyz) or [Sophon Mainnet Explorer](https://explorer.sophon.xyz)
2. **Set Environment Variable**: Add your API key to `.env`:
   ```bash
   ETHERSCAN_SOPHON_API_KEY=your_api_key_here
   ```

## Automated Verification

Run the deployment script with verification flags:

### Testnet
```bash
source .env && forge script ./script/Deploy.s.sol \
  --rpc-url $SOPHON_TESTNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify \
  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \
  --verifier-url https://explorer.testnet.sophon.xyz/api
```

### Mainnet
```bash
source .env && forge script ./script/Deploy.s.sol \
  --rpc-url $SOPHON_MAINNET_RPC_URL \
  --private-key $WALLET_PRIVATE_KEY \
  --zksync \
  --broadcast \
  --verify \
  --verifier-api-key $ETHERSCAN_SOPHON_API_KEY \
  --verifier-url https://explorer.sophon.xyz/api
```

## Manual Verification (Fallback)

If automated verification fails, use manual verification:

1. **Flatten the Contract**:
   ```bash
   forge flatten src/NanoMusicStore.sol > NanoMusicStore_flattened.sol
   forge flatten src/NanoAnimalCare.sol > NanoAnimalCare_flattened.sol
   forge flatten src/MockUSDC.sol > MockUSDC_flattened.sol
   ```

2. **Get Constructor Arguments**:
   Check the deployment transaction on Sophscan to find the constructor arguments in the input data.

3. **Verify on Sophscan**:
   - Go to the contract address on Sophscan
   - Click "Verify and Publish"
   - Select compiler version: `0.8.24`
   - Select zksolc version: `1.5.15`
   - Enable optimization: Yes, 200 runs
   - Paste the flattened source code
   - Add constructor arguments (if any)
   - Submit for verification

## Common Issues

### "Target artifact does not have an ABI"
This occurs when zkSync compilation artifacts are incompatible with standard verification. Solutions:
- Use manual verification
- Ensure `zkfoundry.toml` is properly configured
- Check that zksolc version matches deployment

### "API key not provided"
- Ensure `ETHERSCAN_SOPHON_API_KEY` is set in `.env`
- Source the `.env` file before running commands

### Proxy Verification
For upgradeable contracts (ERC1967Proxy):
1. Verify the implementation contract first
2. Verify the proxy contract
3. Use "Proxy Contract Verification" on Sophscan to link them

## Deployed Contracts (Latest)

### Testnet (Chain ID: 531050104)
- MockUSDC: `0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f`
- NanoMusicStore Implementation: `0x46dF1b6AAFC71cf6Cb231b57B4A51996DDb11Bb6`
- NanoMusicStore Proxy: `0x86E1D788FFCd8232D85dD7eB02c508e7021EB474`
- NanoAnimalCare Implementation: `0xDBc508c96aC737C9a856B0C98f5281E16C9c8F35`
- NanoAnimalCare Proxy: `0xAAfD6b707770BC9F60A773405dE194348B6C4392`

### Mainnet (Chain ID: 50104)
- USDC: `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F` (Official)
- Contracts not yet deployed to mainnet