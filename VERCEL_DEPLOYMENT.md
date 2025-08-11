# Vercel Deployment Guide

## Required Environment Variables

### Critical (Must be set before deployment works):
1. **MNEMONIC** - Your wallet seed phrase for generating user wallets
2. **KV_REST_API_URL** - Vercel KV database URL (create at vercel.com/storage)
3. **KV_REST_API_TOKEN** - Vercel KV database token

### Optional (Have defaults but should be updated after contract deployment):
1. **NEXT_PUBLIC_STORE_CONTRACT** - Defaults to `0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5`
2. **NEXT_PUBLIC_JOBS_CONTRACT** - Not used in current API routes
3. **RPC_URL** - Defaults to `https://rpc.sophon.xyz`
4. **WALLET_PRIVATE_KEY** - Only needed if you want to fund wallets from the API

## Setup Steps

1. **Create Vercel KV Database**:
   - Go to https://vercel.com/dashboard/stores
   - Click "Create Database" → Select "KV"
   - Copy the environment variables provided

2. **Set Environment Variables in Vercel**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add the required variables listed above

3. **Deploy**:
   - The build should now succeed with the vercel.json configuration
   - API routes will be available at:
     - `/api/generate-account` - Creates new wallets
     - `/api/purchase-album` - Processes album purchases
     - `/api/check-balances` - Checks contract balances

## Current Status
- ✅ vercel.json configured to build from frontend directory
- ✅ API routes migrated to Next.js App Router
- ✅ CORS headers configured to allow all origins
- ⏳ Waiting for environment variables to be set in Vercel
- ⏳ Contracts need to be deployed to get final addresses