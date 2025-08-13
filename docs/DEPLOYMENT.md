# Production Deployment Guide

## Overview

This guide covers deploying the HitMachine contracts to Sophon mainnet and configuring the frontend for production use.

## Prerequisites

- [ ] Foundry installed (`curl -L https://foundry.paradigm.xyz | bash`)
- [ ] Node.js 18+ and npm
- [ ] Hardware wallet or secure key management solution
- [ ] Sufficient SOPH for gas fees
- [ ] Access to production USDC contract address

## Environment Setup

### 1. Create Production Environment File

Create `.env.production` with the following:

```bash
# Deployer wallet - USE HARDWARE WALLET IN PRODUCTION
WALLET_PRIVATE_KEY=0x...

# Sophon Mainnet Configuration
RPC_URL=https://rpc.sophon.xyz
CHAIN_ID=50104

# Token Addresses (Sophon Mainnet)
USDC_ADDRESS=0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4
SOPH_ADDRESS=0x... # Native SOPH or wrapped SOPH address

# Etherscan API (for verification)
ETHERSCAN_API_KEY=...

# Frontend Configuration
NEXT_PUBLIC_NETWORK=mainnet
```

### 2. Security Checklist

Before deployment:

- [ ] Audit smart contracts
- [ ] Test on testnet thoroughly  
- [ ] Set up multi-sig wallet for admin roles
- [ ] Configure monitoring and alerts
- [ ] Document emergency procedures
- [ ] Set up secure key management

## Deployment Steps

### Step 1: Deploy Contracts

```bash
# Load production environment
source .env.production

# Deploy Store and Jobs contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --slow \
  -vvv

# Save the output addresses!
```

### Step 2: Verify Contracts

Contracts should auto-verify if Etherscan API key is set. If not:

```bash
forge verify-contract \
  --chain-id 50104 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  <STORE_PROXY_ADDRESS> \
  src/StoreV2.sol:StoreV2
```

### Step 3: Configure Roles

After deployment, configure access control:

```bash
# Grant roles via multi-sig or admin wallet
cast send <STORE_ADDRESS> "grantRole(bytes32,address)" \
  <ROLE_HASH> <ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $WALLET_PRIVATE_KEY
```

### Step 4: Transfer Ownership

Transfer admin roles to multi-sig:

```bash
# Transfer DEFAULT_ADMIN_ROLE to multi-sig
cast send <CONTRACT> "grantRole(bytes32,address)" \
  0x00 <MULTISIG_ADDRESS> \
  --rpc-url $RPC_URL
  
# Renounce admin role from deployer
cast send <CONTRACT> "renounceRole(bytes32,address)" \
  0x00 <DEPLOYER_ADDRESS> \
  --rpc-url $RPC_URL
```

### Step 5: Fund Contracts

```bash
# Fund Jobs contract with USDC for user rewards
cast send <USDC_ADDRESS> "transfer(address,uint256)" \
  <JOBS_CONTRACT> <AMOUNT> \
  --rpc-url $RPC_URL

# Send native SOPH to Jobs for gas distribution
cast send <JOBS_CONTRACT> --value <AMOUNT> \
  --rpc-url $RPC_URL
```

### Step 6: Configure Frontend

Update `frontend/.env.production`:

```env
# API Configuration
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_CHAIN_ID=50104
NEXT_PUBLIC_RPC_URL=https://rpc.sophon.xyz

# Contract Addresses
NEXT_PUBLIC_STORE_CONTRACT=0x...
NEXT_PUBLIC_JOBS_CONTRACT=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4

# Paymaster (if available on mainnet)
NEXT_PUBLIC_PAYMASTER_ADDRESS=0x...
```

### Step 7: Deploy Frontend

```bash
cd frontend

# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

## Post-Deployment

### Verification Checklist

- [ ] Contracts verified on block explorer
- [ ] Admin roles transferred to multi-sig
- [ ] Contracts funded appropriately
- [ ] Frontend connected to correct contracts
- [ ] Test transactions working
- [ ] Monitoring active
- [ ] Alerts configured

### Monitoring

Set up monitoring for:

- Contract balances
- Transaction success rates
- Gas prices
- User activity
- Error rates

### Emergency Procedures

#### Pause Contracts

```bash
cast send <CONTRACT> "pause()" \
  --rpc-url $RPC_URL \
  --private-key $ADMIN_KEY
```

#### Emergency Withdrawal

```bash
cast send <CONTRACT> "emergencyWithdraw(address,address,uint256)" \
  <TOKEN> <RECIPIENT> <AMOUNT> \
  --rpc-url $RPC_URL
```

## Rollback Procedure

If deployment fails:

1. **Do NOT panic** - contracts are upgradeable
2. Document the issue
3. If critical, pause contracts
4. Deploy fix to testnet first
5. Test thoroughly
6. Upgrade via proxy pattern

```bash
# Upgrade contract implementation
forge script script/Upgrade.s.sol:UpgradeScript \
  --rpc-url $RPC_URL \
  --broadcast
```

## Network Information

### Sophon Mainnet

- **Chain ID**: 50104
- **RPC**: https://rpc.sophon.xyz
- **Explorer**: https://explorer.sophon.xyz
- **USDC**: 0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4

### Sophon Testnet

- **Chain ID**: 531050104  
- **RPC**: https://rpc.testnet.sophon.xyz
- **Explorer**: https://explorer.testnet.sophon.xyz
- **Mock USDC**: Deploy using `DeployMocks.s.sol`

## Troubleshooting

### Common Issues

1. **Insufficient gas**: Increase gas price or gas limit
2. **Verification fails**: Check Etherscan API key and contract arguments
3. **Role assignment fails**: Ensure sender has DEFAULT_ADMIN_ROLE
4. **Frontend connection issues**: Verify RPC URL and chain ID

### Support

- Sophon Discord: [Link]
- GitHub Issues: https://github.com/rowhq/hitmachine/issues
- Team Contact: [Email]

## Security Contacts

- **Security Email**: security@[domain]
- **Bug Bounty**: [Program Link]
- **Multi-sig Address**: 0x...