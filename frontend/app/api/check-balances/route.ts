import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { sophon } from 'viem/chains';
import jobsAbi from '../../abi/jobsV2.json';
import storeAbi from '../../abi/storeV2.json';
import { corsHeaders } from '../cors';

const JOBS_CONTRACT = process.env.NEXT_PUBLIC_JOBS_CONTRACT as `0x${string}`;
const STORE_CONTRACT = process.env.NEXT_PUBLIC_STORE_CONTRACT as `0x${string}`;
const MIN_BALANCE = 1000; // $1000 USDC
const RPC_URL = process.env.RPC_URL || 'https://rpc.sophon.xyz';

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders();
  
  try {
    const publicClient = createPublicClient({
      chain: sophon,
      transport: http(RPC_URL)
    });

    const [jobsBalance, storeBalance] = await Promise.all([
      publicClient.readContract({
        address: JOBS_CONTRACT,
        abi: jobsAbi,
        functionName: 'getBalances'
      }) as Promise<[bigint, bigint]>,
      publicClient.readContract({
        address: STORE_CONTRACT,
        abi: storeAbi,
        functionName: 'getContractBalance'
      }) as Promise<bigint>
    ]);

    const jobsUsdcFormatted = parseFloat(formatUnits(jobsBalance[0], 6));
    const jobsNativeFormatted = formatUnits(jobsBalance[1], 18);
    const storeFormatted = formatUnits(storeBalance, 6);

    return NextResponse.json({
      jobs: {
        usdc: jobsUsdcFormatted,
        native: jobsNativeFormatted,
        raw: {
          usdc: jobsBalance[0].toString(),
          native: jobsBalance[1].toString()
        }
      },
      store: {
        usdc: storeFormatted,
        raw: storeBalance.toString()
      },
      shouldRefill: jobsUsdcFormatted < MIN_BALANCE,
      timestamp: new Date().toISOString()
    }, { headers });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to check balances',
        details: error.message
      },
      { status: 500, headers }
    );
  }
}