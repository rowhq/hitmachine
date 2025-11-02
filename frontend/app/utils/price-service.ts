/**
 * Price Service
 * Fetches the gift card price dynamically from the NanoMusicStore contract
 */

import { createPublicClient, http } from 'viem';
import { CURRENT_NETWORK, CONTRACTS } from '../config/environment';
import { currentChain } from '../config/chains';
import storeAbi from '../abi/nanoMusicStore.json';

// Cache for the price with a TTL
interface PriceCache {
  price: bigint;
  timestamp: number;
}

let priceCache: PriceCache | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Fetches the current gift card price from the contract
 * Uses a 1-minute cache to reduce RPC calls
 */
export async function getGiftCardPrice(): Promise<bigint> {
  // Check cache first
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return priceCache.price;
  }

  try {
    // Create public client
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl)
    });

    // Read price from contract
    const price = await publicClient.readContract({
      address: CONTRACTS.storeContract,
      abi: storeAbi,
      functionName: 'giftcardPrice'
    }) as bigint;

    // Update cache
    priceCache = {
      price,
      timestamp: Date.now()
    };

    return price;
  } catch (error) {
    console.error('Error fetching gift card price from contract:', error);

    // Fallback to a default price if contract read fails
    // This should rarely happen, but prevents total failure
    const fallbackPrice = BigInt(7.99e6); // 7.99 USDC with 6 decimals
    console.warn(`Using fallback price: ${fallbackPrice}`);
    return fallbackPrice;
  }
}

/**
 * Formats the price for display (converts from 6 decimals to human-readable)
 */
export function formatGiftCardPrice(price: bigint): string {
  const priceNumber = Number(price) / 1e6;
  return priceNumber.toFixed(2);
}

/**
 * Gets the gift card price and formats it for display
 */
export async function getGiftCardPriceDisplay(): Promise<string> {
  const price = await getGiftCardPrice();
  return formatGiftCardPrice(price);
}

/**
 * Clears the price cache (useful for testing or when you know the price changed)
 */
export function clearPriceCache(): void {
  priceCache = null;
}
