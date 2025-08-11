# HitMachine Admin Dashboard

A Next.js admin dashboard for managing Store and Jobs smart contracts on the Sophon network.

## Features

- 🔐 Wallet connection via RainbowKit
- 📊 Real-time contract stats monitoring
- 💰 Generate and fund test wallets
- 🏪 Store contract management (withdraw, pause/unpause)
- 💼 Jobs contract management (claim, pay users, emergency controls)
- 🔄 Integrated API routes for blockchain interactions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your values:
- Contract addresses (after deployment)
- WalletConnect Project ID
- Private keys and mnemonic
- Vercel KV credentials

4. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel:
```bash
vercel
```

The app includes API routes that handle:
- `/api/generate-account` - Create and fund new wallets
- `/api/purchase-album` - Execute album purchases
- `/api/check-balances` - Monitor contract balances

## API Routes

All API routes are integrated into the Next.js app using App Router:
- Serverless functions run alongside the frontend
- Single deployment for both UI and API
- Shared environment variables

## Contract Interaction

The dashboard allows admin users to:

### Store Contract
- Withdraw all funds to a specified address
- Withdraw specific amounts
- Pause/unpause contract operations

### Jobs Contract  
- Claim funds from Store contract
- Pay users (USDC and/or native token)
- Emergency withdraw
- Pause/unpause operations

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```