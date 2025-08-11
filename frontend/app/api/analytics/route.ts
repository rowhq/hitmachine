import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { sophonTestnet } from '../../config/chains';
import storeAbi from '../../abi/storeV2.json';
import jobsAbi from '../../abi/jobsV2.json';
import { corsHeaders } from '../cors';

const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
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

    // Get Store stats
    const [storeStats, storeBalance] = await Promise.all([
      publicClient.readContract({
        address: STORE_CONTRACT,
        abi: storeAbi,
        functionName: 'getStats'
      }) as Promise<[bigint, bigint, bigint, bigint]>,
      publicClient.readContract({
        address: STORE_CONTRACT,
        abi: storeAbi,
        functionName: 'getContractBalance'
      }) as Promise<bigint>
    ]);

    // Get Jobs stats
    const jobsStats = await publicClient.readContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'getStats'
    }) as [bigint, bigint, bigint, bigint, bigint, bigint];

    // Format the data
    const analytics = {
      store: {
        albumPrice: formatUnits(storeStats[0], 6),
        totalPurchases: storeStats[1].toString(),
        totalRevenue: formatUnits(storeStats[2], 6),
        currentBalance: formatUnits(storeBalance, 6),
        contractAddress: STORE_CONTRACT
      },
      jobs: {
        usersPaid: jobsStats[0].toString(),
        usdcDistributed: formatUnits(jobsStats[1], 6),
        nativeDistributed: formatUnits(jobsStats[2], 18),
        claimedFromStore: formatUnits(jobsStats[3], 6),
        currentUsdcBalance: formatUnits(jobsStats[4], 6),
        currentNativeBalance: formatUnits(jobsStats[5], 18),
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
          albumPrice: '0.01',
          totalPurchases: '0',
          totalRevenue: '0',
          currentBalance: '0',
          contractAddress: STORE_CONTRACT
        },
        jobs: {
          usersPaid: '0',
          usdcDistributed: '0',
          nativeDistributed: '0',
          claimedFromStore: '0',
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