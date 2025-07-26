# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a blockchain-based album purchase system built on the Sophon network using Hardhat and zkSync. The project consists of:
- Smart contracts for album purchases using USDC
- Vercel serverless API endpoints for wallet generation and album purchases
- Deployment infrastructure for the Sophon zkSync network

## Key Commands

### Development & Build
```bash
# Install dependencies
npm install

# Compile contracts (zkSync compilation)
npx hardhat compile

# Deploy contracts to Sophon testnet (default)
npx hardhat run scripts/deploy.ts

# Deploy to Sophon mainnet
npx hardhat run scripts/deploy.ts --network sophonMainnet
```

### Environment Setup
Required environment variables:
- `WALLET_PRIVATE_KEY` - Deployer/admin wallet private key
- `MNEMONIC` - Seed phrase for HD wallet derivation
- `RPC_URL` - Sophon RPC endpoint
- `ETHERSCAN_SOPHON_API_KEY` - For contract verification

## Architecture Overview

### Smart Contract Layer
- **Storage.sol**: Main contract handling album purchases at 0.01 USDC per album
  - Uses USDC token at `0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F`
  - Deployed to `0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5` on Sophon mainnet
  - Tracks purchases via `hasPurchased` mapping
  - Admin can claim referral rewards

### API Endpoints (Vercel Functions)
1. **generate-account.ts**: Creates new wallets and funds them
   - Derives HD wallets from mnemonic using incremental index
   - Funds with 0.01 USDC and ~$0.02 worth of SOPH for gas
   - Pre-approves USDC spending for the Store contract
   - Stores wallet address-to-index mapping in Vercel KV

2. **purchase-album.ts**: Executes album purchases
   - Retrieves wallet index from address via KV store
   - Checks if album already purchased
   - Executes buyAlbum() transaction

### Key Dependencies
- **viem**: Ethereum interactions and wallet management
- **@vercel/kv**: Redis-like key-value storage for wallet indexing
- **@matterlabs/hardhat-zksync**: zkSync integration for Hardhat
- **zksync-ethers**: zkSync-specific ethers.js implementation

### Network Configuration
The project supports two Sophon networks:
- **sophonTestnet** (default): Chain ID 531050104
- **sophonMainnet**: Chain ID 50104

Both networks use zkSync technology with custom zksolc compiler settings.