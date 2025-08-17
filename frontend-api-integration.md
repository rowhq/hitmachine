# API Integration Guide

Base URL: `https://hitmachine-nano.vercel.app/api`

## 1. Generate Account
Creates a wallet and funds it with USDC.

**Request:**
```
POST /api/generate-account
Content-Type: application/json

{}
```

**Response:**
```json
{
  "address": "0x1234...",
  "index": 123,
  "payTx": "0xabc123...",
  "approveTx": "0xdef456..."
}
```

## 2. Purchase Gift Card
Buys a gift card using the wallet address.

**Request:**
```
POST /api/purchase-giftcard
Content-Type: application/json

{
  "address": "0x1234..."  // from step 1
}
```

**Response:**
```json
{
  "txHash": "0xdef...",
  "transactions": [
    { "type": "purchase", "hash": "0xdef..." }
  ]
}
```

## 3. Complete Flow (Optional)
Track analytics after purchase.

**Request:**
```
POST /api/complete-flow
Content-Type: application/json

{
  "walletAddress": "0x1234...",
  "giftCardPurchased": true
}
```

**Response:**
```json
{
  "success": true
}
```

## Quick Example

```javascript
// 1. Generate wallet
const wallet = await fetch('https://hitmachine-nano.vercel.app/api/generate-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
}).then(r => r.json());

// 2. Purchase gift card
const purchase = await fetch('https://hitmachine-nano.vercel.app/api/purchase-giftcard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: wallet.address })
}).then(r => r.json());

console.log('Transaction:', purchase.txHash);
```