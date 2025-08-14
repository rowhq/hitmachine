import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { sophonTestnet } from '../../config/chains';
import storeAbi from '../../abi/nanoMusicStore.json';
import jobsAbi from '../../abi/nanoAnimalCare.json';
import { corsHeaders } from '../cors';

const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x86E1D788FFCd8232D85dD7eB02c508e7021EB474') as `0x${string}`; // NanoMusicStore Proxy
const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0xAAfD6b707770BC9F60A773405dE194348B6C4392') as `0x${string}`; // NanoAnimalCare Proxy
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders();
  
  // Optional API key protection
  const apiKey = request.headers.get('x-api-key');
  if (process.env.ANALYTICS_API_KEY && apiKey !== process.env.ANALYTICS_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers }
    );
  }

  try {
    const publicClient = createPublicClient({
      chain: sophonTestnet,
      transport: http(RPC_URL)
    });

    // Get Store stats using getStats function which returns all info
    const storeStats = await publicClient.readContract({
      address: STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'getStats'
    }) as [bigint, bigint, bigint, bigint];
    // getStats returns: (giftcardPrice, totalPurchases, totalRevenue, balance)

    // Get Jobs/AnimalCare balance - NanoAnimalCare doesn't have getStats
    const jobsBalance = await publicClient.readContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'getUSDCBalance'
    }) as bigint;

    // Format the data
    const analytics = {
      store: {
        giftcardPrice: formatUnits(storeStats[0], 6),
        totalPurchases: storeStats[1].toString(),
        totalRevenue: formatUnits(storeStats[2], 6),
        currentBalance: formatUnits(storeStats[3], 6), // balance is the 4th value from getStats
        contractAddress: STORE_CONTRACT
      },
      jobs: {
        // NanoAnimalCare has limited stats - just balance
        currentUsdcBalance: formatUnits(jobsBalance, 6),
        contractAddress: JOBS_CONTRACT
      },
      network: {
        chain: 'Sophon Testnet',
        chainId: sophonTestnet.id,
        rpcUrl: RPC_URL
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(analytics, { headers });

  } catch (error: any) {
    // If contracts aren't deployed yet, return mock data
    if (error.message?.includes('0x00000000')) {
      return NextResponse.json({
        message: 'Contracts not deployed yet',
        mockData: true,
        store: {
          giftcardPrice: '32',
          totalPurchases: '0',
          totalRevenue: '0',
          currentBalance: '0',
          contractAddress: STORE_CONTRACT
        },
        jobs: {
          currentUsdcBalance: '0',
          currentNativeBalance: '0',
          contractAddress: JOBS_CONTRACT
        },
        network: {
          chain: 'Sophon Testnet',
          chainId: sophonTestnet.id,
          rpcUrl: RPC_URL
        },
        timestamp: new Date().toISOString()
      }, { headers });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        details: error.message
      },
      { status: 500, headers }
    );
  }
}