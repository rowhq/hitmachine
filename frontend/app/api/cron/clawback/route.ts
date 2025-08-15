import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  type Hex,
} from "viem";
import { getGeneralPaymasterInput, eip712WalletActions } from "viem/zksync";
import { currentChain } from "../../../config/chains";
import { kv } from "@vercel/kv";
import { createClient } from "@supabase/supabase-js";
import usdcAbi from "../../../abi/mockUsdc.json";
import storeAbi from "../../../abi/nanoMusicStore.json";
import animalCareAbi from "../../../abi/nanoAnimalCare.json";
import { CONTRACTS, CURRENT_NETWORK, NETWORK } from "../../../config/environment";

const MNEMONIC = process.env.MNEMONIC!;
const CLAWBACK_THRESHOLD = BigInt(15000 * 1e6); // 15,000 USDC
const CLAWBACK_AGE_MS = 60 * 60 * 1000; // 1 hour

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[CRON] Starting clawback check on ${NETWORK}`);

    // Initialize clients
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    });

    // Check store balance
    const storeBalance = await publicClient.readContract({
      address: CONTRACTS.storeContract,
      abi: storeAbi,
      functionName: 'getUSDCBalance',
    }) as bigint;

    // Check animal care balance
    const animalCareBalance = await publicClient.readContract({
      address: CONTRACTS.animalCareContract,
      abi: animalCareAbi,
      functionName: 'getUSDCBalance',
    }) as bigint;

    const totalBalance = storeBalance + animalCareBalance;
    
    console.log(`[CRON] Store balance: ${formatUnits(storeBalance, 6)} USDC`);
    console.log(`[CRON] AnimalCare balance: ${formatUnits(animalCareBalance, 6)} USDC`);
    console.log(`[CRON] Total balance: ${formatUnits(totalBalance, 6)} USDC`);
    console.log(`[CRON] Threshold: ${formatUnits(CLAWBACK_THRESHOLD, 6)} USDC`);

    // Check if we need to clawback
    if (totalBalance >= CLAWBACK_THRESHOLD) {
      return NextResponse.json({
        message: 'Balance sufficient, no clawback needed',
        balances: {
          store: formatUnits(storeBalance, 6),
          animalCare: formatUnits(animalCareBalance, 6),
          total: formatUnits(totalBalance, 6),
        }
      });
    }

    console.log(`[CRON] Balance below threshold, initiating clawback`);

    // Get all recent wallets from KV
    const recentWallets = await kv.lrange("recent_wallets", 0, -1);
    const oneHourAgo = Date.now() - CLAWBACK_AGE_MS;
    const walletsToCheck: any[] = [];
    
    // Parse and filter wallets
    for (const wallet of recentWallets) {
      try {
        const parsed = typeof wallet === 'string' ? JSON.parse(wallet) : wallet;
        const walletTime = new Date(parsed.timestamp).getTime();
        
        if (walletTime < oneHourAgo) {
          walletsToCheck.push(parsed);
        }
      } catch (e) {
        console.error('[CRON] Error parsing wallet:', e);
      }
    }

    console.log(`[CRON] Found ${walletsToCheck.length} wallets funded over 1 hour ago`);

    // Check which wallets have already made purchases
    const purchasedWallets = new Set<string>();
    try {
      const { data: purchases } = await supabase
        .from('wallet_events')
        .select('metadata')
        .eq('event_type', 'giftcard_purchase');
      
      if (purchases) {
        purchases.forEach((p: any) => {
          const addr = p.metadata?.wallet_address;
          if (addr) purchasedWallets.add(addr.toLowerCase());
        });
      }
    } catch (e) {
      console.error('[CRON] Error fetching purchases:', e);
    }

    // Process clawbacks
    const clawbacks = [];
    let totalReclaimed = BigInt(0);
    
    for (const walletData of walletsToCheck) {
      try {
        const walletAddress = walletData.address.toLowerCase();
        
        // Skip if already purchased
        if (purchasedWallets.has(walletAddress)) {
          console.log(`[CRON] Skipping ${walletAddress} - already made purchase`);
          continue;
        }

        // Check wallet's USDC balance
        const balance = await publicClient.readContract({
          address: CONTRACTS.usdcAddress,
          abi: usdcAbi,
          functionName: 'balanceOf',
          args: [walletAddress],
        }) as bigint;

        if (balance === BigInt(0)) {
          console.log(`[CRON] Skipping ${walletAddress} - zero balance`);
          continue;
        }

        console.log(`[CRON] Clawing back ${formatUnits(balance, 6)} USDC from ${walletAddress}`);

        // Derive wallet from mnemonic
        const account = mnemonicToAccount(MNEMONIC, {
          path: `m/44'/60'/0'/0/${walletData.index}`,
        });

        const walletClient = createWalletClient({
          account,
          chain: currentChain,
          transport: http(CURRENT_NETWORK.rpcUrl),
        }).extend(eip712WalletActions());

        // Call revoke function
        const paymasterInput: Hex = getGeneralPaymasterInput({
          innerInput: "0x",
        });

        const revokeTx = await walletClient.writeContract({
          address: CONTRACTS.animalCareContract,
          abi: animalCareAbi,
          functionName: 'revoke',
          args: [],
          chain: currentChain,
          paymaster: CONTRACTS.paymasterAddress,
          paymasterInput: paymasterInput,
        });

        clawbacks.push({
          wallet: walletAddress,
          amount: formatUnits(balance, 6),
          txHash: revokeTx,
          index: walletData.index,
        });

        totalReclaimed += balance;

        // Log to Supabase
        await supabase.from('wallet_events').insert({
          event_type: 'usdc_clawback',
          metadata: {
            wallet_address: walletAddress,
            amount: balance.toString(),
            tx_hash: revokeTx,
            index: walletData.index,
            reason: 'low_system_balance',
          },
        });

      } catch (error) {
        console.error(`[CRON] Error clawing back from ${walletData.address}:`, error);
      }
    }

    // Log summary
    await supabase.from('wallet_events').insert({
      event_type: 'clawback_summary',
      metadata: {
        total_wallets_checked: walletsToCheck.length,
        total_clawbacks: clawbacks.length,
        total_amount_reclaimed: totalReclaimed.toString(),
        balance_before: totalBalance.toString(),
        threshold: CLAWBACK_THRESHOLD.toString(),
      },
    });

    return NextResponse.json({
      message: 'Clawback completed',
      balances: {
        store: formatUnits(storeBalance, 6),
        animalCare: formatUnits(animalCareBalance, 6),
        total: formatUnits(totalBalance, 6),
      },
      clawbacks: {
        count: clawbacks.length,
        totalReclaimed: formatUnits(totalReclaimed, 6),
        details: clawbacks,
      },
    });

  } catch (error: any) {
    console.error('[CRON] Clawback error:', error);
    
    // Log error
    await supabase.from('wallet_events').insert({
      event_type: 'clawback_error',
      metadata: {
        error: error.message,
        stack: error.stack,
      },
    });

    return NextResponse.json({
      error: 'Clawback failed',
      details: error.message,
    }, { status: 500 });
  }
}

// Also support POST for manual triggering (with auth)
export async function POST(request: NextRequest) {
  return GET(request);
}