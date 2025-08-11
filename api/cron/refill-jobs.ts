import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sophon } from 'viem/chains';
import jobsAbi from '../abi/jobsV2.json';
import storeAbi from '../abi/storeV2.json';

const JOBS_CONTRACT = process.env.JOBS_CONTRACT as `0x${string}`;
const STORE_CONTRACT = process.env.STORE_CONTRACT as `0x${string}`;
const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
const MIN_BALANCE = parseUnits('1000', 6); // $1000 USDC

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const publicClient = createPublicClient({
      chain: sophon,
      transport: http(process.env.RPC_URL)
    });

    // Check Jobs contract balance
    const jobsBalance = await publicClient.readContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'getBalances'
    }) as [bigint, bigint];

    const usdcBalance = jobsBalance[0]; // First element is USDC

    if (usdcBalance >= MIN_BALANCE) {
      return res.json({ 
        message: 'Balance sufficient',
        balance: formatUnits(usdcBalance, 6)
      });
    }

    // Check Store balance
    const storeBalance = await publicClient.readContract({
      address: STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'getContractBalance'
    }) as bigint;

    if (storeBalance === 0n) {
      return res.json({
        message: 'Store empty, cannot refill',
        jobsBalance: formatUnits(usdcBalance, 6)
      });
    }

    // Create wallet for operator
    const operator = privateKeyToAccount(`0x${OPERATOR_KEY}`);
    const walletClient = createWalletClient({
      account: operator,
      chain: sophon,
      transport: http(process.env.RPC_URL)
    });

    // Simulate first
    const { request } = await publicClient.simulateContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'claimFromStore',
      args: [],
      account: operator.address
    });

    // Claim from store
    const txHash = await walletClient.writeContract(request);

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Get new balance
    const newBalance = await publicClient.readContract({
      address: JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'getBalances'
    }) as [bigint, bigint];

    return res.json({
      success: true,
      message: 'Refilled Jobs contract',
      previousBalance: formatUnits(usdcBalance, 6),
      claimed: formatUnits(storeBalance, 6),
      newBalance: formatUnits(newBalance[0], 6),
      txHash
    });

  } catch (error: any) {
    console.error('Refill error:', error);
    
    return res.status(500).json({
      error: 'Refill failed',
      details: error.message
    });
  }
}