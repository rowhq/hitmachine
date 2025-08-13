import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sophonTestnet } from '../../../config/chains';
import jobsAbi from '../../../abi/jobsV2.json';
import storeAbi from '../../../abi/storeV2.json';
import { corsHeaders } from '../../cors';

// This endpoint runs every minute to check and refill Jobs contract
// It claims from Store contract when Jobs balance is below threshold

const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const MIN_BALANCE = 1000; // $1000 USDC minimum
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

    // Check Store contract balance
    const storeBalance = await publicClient.readContract({
      address: STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'getContractBalance'
    }) as bigint;

    const storeBalanceFormatted = parseFloat(formatUnits(storeBalance, 6));

    if (storeBalanceFormatted === 0) {
      return NextResponse.json({
        message: 'Store has no funds to claim',
        jobsBalance: usdcFormatted,
        storeBalance: storeBalanceFormatted,
        minBalance: MIN_BALANCE
      }, { headers });
    }

    // Need to claim from Store - use operator wallet
    if (!process.env.WALLET_PRIVATE_KEY) {
      return NextResponse.json({
        message: 'Operator wallet not configured',
        jobsBalance: usdcFormatted,
        storeBalance: storeBalanceFormatted,
        action: 'Set WALLET_PRIVATE_KEY to enable auto-claiming'
      }, { headers });
    }

    const operator = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
    const walletClient = createWalletClient({
      account: operator,
      chain: sophonTestnet,
      transport: http(RPC_URL)
    });

    // Execute claimFromStore on Jobs contract
    const hash = await walletClient.writeContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'claimFromStore'
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash,
      confirmations: 1 
    });

    // Check new balance
    const [newUsdcBalance] = await publicClient.readContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'getBalances'
    }) as [bigint, bigint];

    const newUsdcFormatted = parseFloat(formatUnits(newUsdcBalance, 6));
    const claimed = newUsdcFormatted - usdcFormatted;

    return NextResponse.json({
      message: 'Successfully claimed from Store',
      previousBalance: usdcFormatted,
      newBalance: newUsdcFormatted,
      claimed: claimed,
      txHash: hash,
      blockNumber: receipt.blockNumber.toString()
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