import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicClient, http, formatUnits } from 'viem';
import { sophon } from 'viem/chains';
import jobsAbi from './abi/jobsV2.json';
import storeAbi from './abi/storeV2.json';

const JOBS_CONTRACT = process.env.JOBS_CONTRACT as `0x${string}`;
const STORE_CONTRACT = process.env.STORE_CONTRACT as `0x${string}`;
const MIN_BALANCE = 1000; // $1000 USDC

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const publicClient = createPublicClient({
      chain: sophon,
      transport: http(process.env.RPC_URL)
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

    return res.json({
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
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to check balances',
      details: error.message
    });
  }
}