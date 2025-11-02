# Album Price Update Scripts

This directory contains scripts to update the album/gift card price on the NanoMusicStore contract.

## Overview

The current price is **31.96 USDC**. These scripts will update it to **7.99 USDC**.

## Prerequisites

1. Ensure you have the `PROD_WALLET` mnemonic set in your `.env` file:
   ```bash
   PROD_WALLET=your_twelve_word_mnemonic_here
   ```

2. The deployer wallet (index 0 of PROD_WALLET) must have the `OPERATOR_ROLE` on the NanoMusicStore contract.

3. Ensure Foundry is installed and configured for zkSync.

## Contract Addresses

### Testnet (Sophon Testnet - Chain ID: 531050104)
- **NanoMusicStore Proxy**: `0x86E1D788FFCd8232D85dD7eB02c508e7021EB474`
- **RPC URL**: `https://rpc.testnet.sophon.xyz`

### Mainnet (Sophon Mainnet - Chain ID: 50104)
- **NanoMusicStore Proxy**: `0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5`
- **RPC URL**: `https://rpc.sophon.xyz`

## Usage

### Update Price on Testnet

```bash
# Using the shell script (recommended)
./scripts/update-price-testnet.sh

# Or directly with forge
source .env && forge script ./script/UpdatePriceTestnet.s.sol \
    --rpc-url https://rpc.testnet.sophon.xyz \
    --zksync \
    --broadcast
```

### Update Price on Mainnet

```bash
# Using the shell script (recommended - includes safety prompt)
./scripts/update-price-mainnet.sh

# Or directly with forge
source .env && forge script ./script/UpdatePriceMainnet.s.sol \
    --rpc-url https://rpc.sophon.xyz \
    --zksync \
    --broadcast
```

## What These Scripts Do

1. **Verify Network**: Ensure you're connected to the correct network (testnet/mainnet)
2. **Load Credentials**: Derive the operator wallet from the PROD_WALLET mnemonic (index 0)
3. **Check Current Price**: Display the current price before updating
4. **Update Price**: Call the `updatePrice(uint256)` function with the new price (7.99 USDC = 7,990,000 in 6 decimals)
5. **Verify Update**: Confirm the price was successfully updated

## Safety Features

- **Network Verification**: Scripts will abort if run on the wrong network
- **Mainnet Warning**: The mainnet script includes an interactive confirmation prompt
- **Price Verification**: After updating, the script verifies the new price matches the expected value

## Files

- `script/UpdatePriceTestnet.s.sol` - Solidity script for testnet
- `script/UpdatePriceMainnet.s.sol` - Solidity script for mainnet
- `scripts/update-price-testnet.sh` - Bash wrapper for testnet
- `scripts/update-price-mainnet.sh` - Bash wrapper for mainnet (with safety prompt)

## Troubleshooting

### "Price must be greater than 0" Error
The price value is invalid. Check that the NEW_PRICE constant is correctly set.

### "Missing role: OPERATOR_ROLE" Error
The wallet doesn't have permission. Ensure you're using the correct PROD_WALLET mnemonic and that the deployer (index 0) has the OPERATOR_ROLE.

### "Wrong network" Error
You're connected to the wrong RPC endpoint. Check your RPC URL matches the target network.

## Technical Details

- **New Price**: 7.99 USDC
- **Price Format**: 7,990,000 (6 decimal places, matching USDC decimals)
- **Function Called**: `updatePrice(uint256 newPrice)`
- **Required Role**: `OPERATOR_ROLE`
- **Operator Wallet**: Derived from PROD_WALLET at index 0

## Note

After updating the price, you may need to update any frontend configurations or API endpoints that reference the album price.
