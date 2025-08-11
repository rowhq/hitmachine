# Project Structure

## Smart Contracts (Upgradeable UUPS)
```
src/
├── StoreV2.sol         # Album purchase contract with AccessControl
├── JobsV2.sol          # Fund distribution with Store integration  
└── RateLimiter.sol     # On-chain rate limiting contract
```

## API Endpoints
```
api/
├── generate-account.ts  # Create & fund new wallets (protected)
├── purchase-album.ts    # Execute album purchase
├── mass-buy.ts         # Batch purchases with refunds (API key protected)
└── middleware/
    ├── domainCheck.ts  # Domain whitelist & rate limiting
    ├── rateLimit.ts    # IP-based rate limiting
    └── antibot.ts      # Advanced anti-bot measures
```

## Deployment & Scripts
```
script/
└── DeployUpgradeable.s.sol  # Deploy upgradeable contracts

scripts/
├── generate-api-key.js      # Generate secure API keys
└── mass-buy-cli.js         # CLI for mass purchases
```

## Configuration
```
.env.example            # Environment variables template
foundry.toml           # Foundry configuration
remappings.txt         # Solidity import mappings
Makefile              # Common commands
```

## Key Features

### 1. Upgradeable Contracts (UUPS)
- Both Store and Jobs contracts are upgradeable
- Role-based access control (ADMIN, OPERATOR, DISTRIBUTOR, WITHDRAWER)
- Jobs can claim funds from Store

### 2. Rate Limiting
- IP-based rate limiting via Vercel KV
- Domain whitelist for API access
- Configurable limits per endpoint

### 3. Security
- Protected endpoints with domain checking
- API key protection for admin endpoints
- Anti-bot measures available

### 4. Mass Operations
- Batch purchase from multiple wallets
- Automatic refund to admin wallet
- Protected by API key

## Environment Variables

```env
# Blockchain
PRIVATE_KEY=                 # Deployer private key
SOPHON_TESTNET_RPC_URL=     # Testnet RPC
SOPHON_MAINNET_RPC_URL=     # Mainnet RPC
ETHERSCAN_SOPHON_API_KEY=   # For verification

# Contracts (after deployment)
STORE_CONTRACT=             # Store proxy address
JOBS_CONTRACT=              # Jobs proxy address

# API
WALLET_PRIVATE_KEY=         # Funder wallet
MNEMONIC=                   # For HD wallet derivation
RPC_URL=                    # API RPC endpoint
MASS_BUY_API_KEY=          # For mass-buy endpoint

# Vercel KV
KV_REST_API_URL=           # Redis for rate limiting
KV_REST_API_TOKEN=         # KV auth token
```

## Deployment

1. Deploy contracts:
```bash
make deploy-mainnet
```

2. Set environment variables in Vercel

3. Deploy API:
```bash
vercel --prod
```

## Usage

### Generate wallet:
```javascript
POST /api/generate-account
// Protected by domain whitelist & rate limiting
```

### Purchase album:
```javascript
POST /api/purchase-album?address=0x...
```

### Mass buy (admin):
```javascript
POST /api/mass-buy
Headers: { "x-api-key": "your-api-key" }
Body: { "startIndex": 0, "endIndex": 10 }
```