import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sophonTestnet } from '../../../config/chains';
import jobsAbi from '../../../abi/jobsV2.json';
import { corsHeaders } from '../../cors';

// This endpoint should be called by Vercel Cron to check and refill Jobs contract
// Configure in vercel.json with schedule

const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const MIN_BALANCE = 1000; // $1000 USDC minimum
const REFILL_AMOUNT = 5000; // $5000 USDC to refill
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';

export async function GET(request: NextRequest) {
  const headers = corsHeaders();
  
  // Verify this is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    // Check Jobs contract USDC balance
    const [usdcBalance] = await publicClient.readContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'getBalances'
    }) as [bigint, bigint];

    const usdcFormatted = parseFloat(formatUnits(usdcBalance, 6));

    if (usdcFormatted >= MIN_BALANCE) {
      return NextResponse.json({
        message: 'No refill needed',
        balance: usdcFormatted,
        minBalance: MIN_BALANCE
      }, { headers });
    }

    // Refill needed - in production, this would transfer from treasury
    // For now, just log and notify
    console.log(`Jobs contract needs refill: ${usdcFormatted} USDC`);

    // In production, you would:
    // 1. Transfer USDC from treasury wallet to Jobs contract
    // 2. Send notification to admin
    // 3. Log the refill transaction

    return NextResponse.json({
      message: 'Refill needed',
      currentBalance: usdcFormatted,
      minBalance: MIN_BALANCE,
      refillAmount: REFILL_AMOUNT,
      action: 'Manual refill required'
    }, { headers });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check balance',
        details: error.message
      },
      { status: 500, headers }
    );
  }
}