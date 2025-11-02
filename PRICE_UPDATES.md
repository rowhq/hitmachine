# Gift Card Price Updates - Summary

## Overview
Updated the NanoMusicStore gift card price from **31.96 USDC to 7.99 USDC** on both testnet and mainnet. Additionally, refactored the frontend to **read the price dynamically from the smart contracts** instead of using hardcoded values.

## Contract Price Updates ✅

### Testnet (Sophon Testnet)
- **Contract**: `0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674`
- **Transaction**: `0x043f77b3c3f7221872bce715436d760e3ff301d7d6bd812a7c7925bb3f1be715`
- **Block**: 1,468,430
- **Gas Used**: 111,112
- **Old Price**: 31.96 USDC (31,960,000)
- **New Price**: 7.99 USDC (7,990,000) ✅

### Mainnet (Sophon Mainnet)
- **Contract**: `0x963842e934594072B0996366c568e37B1Ad5F3f2`
- **Transaction**: `0x8cb25fe380227b44e79533a61cec37202bb924f802f243ae1b24c10dd70724f6`
- **Block**: 23,656,181
- **Gas Used**: 110,558
- **Old Price**: 31.96 USDC (31,960,000)
- **New Price**: 7.99 USDC (7,990,000) ✅

## Frontend Refactoring ✅

### New Files Created

#### 1. `frontend/app/utils/price-service.ts`
- **Purpose**: Fetches gift card price dynamically from the NanoMusicStore contract
- **Features**:
  - `getGiftCardPrice()`: Fetches current price with 1-minute caching
  - `formatGiftCardPrice()`: Formats price for display
  - `getGiftCardPriceDisplay()`: Combined fetch + format
  - `clearPriceCache()`: Manual cache clearing
  - Fallback to 7.99 USDC if contract read fails

#### 2. `frontend/app/api/price/route.ts`
- **Purpose**: API endpoint to fetch current price
- **Endpoint**: `GET /api/price`
- **Response**:
  ```json
  {
    "price": "7990000",
    "priceDisplay": "7.99",
    "priceUSDC": 7.99,
    "network": "mainnet",
    "timestamp": "2025-11-02T14:45:00.000Z"
  }
  ```

### Updated Files

#### 1. `frontend/app/config/environment.ts`
**Changed:**
- Deprecated `GIFT_CARD_PRICE` and `GIFT_CARD_PRICE_DISPLAY` constants
- Updated values from 31.96 to 7.99 USDC as fallback
- Added JSDoc `@deprecated` tags directing to `price-service.ts`

**Before:**
```typescript
export const GIFT_CARD_PRICE = BigInt(31.96e6); // 31.96 USDC
export const GIFT_CARD_PRICE_DISPLAY = "31.96";
```

**After:**
```typescript
/** @deprecated Use getGiftCardPrice() from utils/price-service.ts instead */
export const GIFT_CARD_PRICE = BigInt(7.99e6); // Fallback only
/** @deprecated Use getGiftCardPriceDisplay() from utils/price-service.ts instead */
export const GIFT_CARD_PRICE_DISPLAY = "7.99"; // Fallback only
```

#### 2. `frontend/app/api/generate-account/route.ts`
**Changed:**
- Imports `getGiftCardPrice()` and `formatGiftCardPrice()` from `price-service`
- Fetches price at runtime instead of using hardcoded constant
- Uses dynamic price for funding wallets via Band contract

**Impact**: New wallets are funded with the correct current price from the contract

#### 3. `frontend/app/api/purchase-giftcard/route.ts`
**Changed:**
- Imports `getGiftCardPrice()` from `price-service`
- Fetches price at runtime before executing purchase

**Impact**: Purchase transactions use the current price from the contract

## Scripts Created

### Solidity Scripts (Foundry)
1. `script/UpdatePriceTestnet.s.sol` - Updates testnet price
2. `script/UpdatePriceMainnet.s.sol` - Updates mainnet price

### Shell Scripts
1. `scripts/update-price-testnet.sh` - Bash wrapper for testnet
2. `scripts/update-price-mainnet.sh` - Bash wrapper for mainnet (with confirmation)

### Node.js Script (Recommended)
**`scripts/update-price.js`** - Universal price updater using viem

**Usage:**
```bash
# Update testnet price
cd frontend && node ../scripts/update-price.js testnet

# Update mainnet price
cd frontend && node ../scripts/update-price.js mainnet
```

**Features:**
- Uses viem for zkSync compatibility
- Reads from PROD_WALLET mnemonic (index 0)
- Verifies OPERATOR_ROLE before updating
- 5-second safety delay for mainnet
- Verifies price after update
- Works with both testnet and mainnet

## Benefits of Dynamic Price Reading

### 1. **Single Source of Truth**
- Contract is the only source for pricing
- No risk of frontend/contract price mismatch
- Eliminates manual frontend updates when price changes

### 2. **Automatic Updates**
- Price changes on contract automatically reflect in frontend
- No need to redeploy frontend after price updates
- API responses always show current price

### 3. **Caching for Performance**
- 1-minute cache reduces RPC calls
- Minimal latency for users
- Cache can be cleared manually if needed

### 4. **Fallback Safety**
- If contract read fails, falls back to 7.99 USDC
- Prevents total system failure
- Logs errors for debugging

## Testing

### Verify Price on Contract
```bash
# Mainnet
cast call 0x963842e934594072B0996366c568e37B1Ad5F3f2 "giftcardPrice()(uint256)" \
  --rpc-url https://rpc.sophon.xyz

# Testnet
cast call 0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674 "giftcardPrice()(uint256)" \
  --rpc-url https://rpc.testnet.sophon.xyz
```

**Expected Result**: `7990000` (7.99e6)

### Test Price API Endpoint
```bash
curl https://your-frontend.vercel.app/api/price
```

**Expected Response**:
```json
{
  "price": "7990000",
  "priceDisplay": "7.99",
  "priceUSDC": 7.99,
  "network": "mainnet",
  "timestamp": "2025-11-02T..."
}
```

## Next Steps

1. **Deploy Frontend**: Deploy the updated frontend to Vercel
2. **Monitor**: Watch for any errors in price fetching
3. **Remove Deprecated Constants**: After confirming everything works, remove the deprecated `GIFT_CARD_PRICE` constants from `environment.ts`
4. **Update Documentation**: Update any user-facing documentation that mentions the 31.96 price

## Rollback Plan

If needed, you can revert the price change:

```bash
# Update the NEW_PRICE constant in the scripts to 31.96
# Then run the update script again
cd frontend && node ../scripts/update-price.js mainnet
```

## Important Notes

- ✅ Price updates are permanent on-chain
- ✅ Frontend build succeeds with no TypeScript errors
- ✅ Both API routes updated to use dynamic pricing
- ✅ Price service includes caching and fallback logic
- ⚠️ Make sure to deploy the updated frontend for changes to take effect
