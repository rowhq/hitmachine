'use client';

import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../config/environment';
import storeAbi from '../abi/nanoMusicStore.json';

export function useGiftCardPrice() {
  // Read price from store contract
  const { data: storeStats, isError, isLoading } = useReadContract({
    address: CONTRACTS.storeContract,
    abi: storeAbi,
    functionName: 'getStats',
  }) as { data: [bigint, bigint, bigint, bigint] | undefined; isError: boolean; isLoading: boolean };
  
  // storeStats returns: [giftcardPrice, totalPurchases, totalRevenue, balance]
  const priceInWei = storeStats?.[0];
  const priceInUSDC = priceInWei ? formatUnits(priceInWei, 6) : null;
  
  return {
    priceInWei,
    priceInUSDC,
    displayPrice: priceInUSDC || '...', // Show loading indicator
    isLoading,
    isError,
  };
}