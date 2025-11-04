/**
 * Album Count API Endpoint
 * Returns 90% of the total album purchases from the contract (rounded)
 * Uses Vercel KV for 1-second caching across all serverless instances
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from '@vercel/kv';
import { createPublicClient, http } from 'viem';
import { CURRENT_NETWORK, CONTRACTS } from "../../config/environment";
import { currentChain } from "../../config/chains";
import storeAbi from '../../abi/nanoMusicStore.json';
import { corsHeaders } from "../cors";

const CACHE_KEY = 'album-purchase-count';
const CACHE_TTL = 1; // 1 second

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders();

  try {
    // Check KV cache first
    const cachedCount = await kv.get<number>(CACHE_KEY);

    if (cachedCount !== null) {
      return NextResponse.json(
        {
          totalPurchases: cachedCount,
          cached: true,
          network: CURRENT_NETWORK.name,
          timestamp: new Date().toISOString()
        },
        { status: 200, headers }
      );
    }

    // Cache miss - fetch from contract
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl)
    });

    // Read total purchases from contract
    const totalPurchases = await publicClient.readContract({
      address: CONTRACTS.storeContract,
      abi: storeAbi,
      functionName: 'totalPurchases'
    }) as bigint;

    const actualCount = Number(totalPurchases);
    // Return 90% of the actual count, rounded
    const displayCount = Math.round(actualCount * 0.9);

    // Store in KV cache with 1-second TTL
    await kv.set(CACHE_KEY, displayCount, { ex: CACHE_TTL });

    return NextResponse.json(
      {
        totalPurchases: displayCount,
        cached: false,
        network: CURRENT_NETWORK.name,
        timestamp: new Date().toISOString()
      },
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('Error fetching album count:', error);
    return NextResponse.json(
      {
        error: "Failed to fetch album count from contract",
        details: error.message
      },
      { status: 500, headers }
    );
  }
}
