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
import bandAbi from "../../../abi/nanoBand.json";
import { CONTRACTS, CURRENT_NETWORK, NETWORK } from "../../../config/environment";

const PROD_WALLET = process.env.PROD_WALLET!;
const CLAWBACK_THRESHOLD = BigInt(10000 * 1e6); // 10,000 USDC - trigger clawback
const TARGET_THRESHOLD = BigInt(15000 * 1e6); // 15,000 USDC - target to reach
const MIN_WALLET_AGE_MS = 5 * 60 * 1000; // Minimum 5 minutes before clawback (safety buffer)

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  // Check for force parameter
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  try {
    console.log(`[CRON] Starting clawback check on ${NETWORK}${force ? ' (FORCE MODE)' : ''}`);

    // Initialize clients
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    });

    // Derive nano wallet (index 0) from prod wallet mnemonic
    const nanoWallet = mnemonicToAccount(PROD_WALLET, {
      path: `m/44'/60'/0'/0/0`,
    });

    // Check store balance
    const storeBalance = await publicClient.readContract({
      address: CONTRACTS.storeContract,
      abi: storeAbi,
      functionName: 'getContractBalance',
    }) as bigint;

    // Check band balance
    const bandBalance = await publicClient.readContract({
      address: CONTRACTS.bandContract,
      abi: bandAbi,
      functionName: 'getUSDCBalance',
    }) as bigint;

    // Check nano wallet balance
    const nanoWalletBalance = await publicClient.readContract({
      address: CONTRACTS.usdcAddress,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [nanoWallet.address],
    }) as bigint;

    const totalBalance = storeBalance + bandBalance + nanoWalletBalance;
    
    console.log(`[CRON] Store balance: ${formatUnits(storeBalance, 6)} USDC`);
    console.log(`[CRON] Band balance: ${formatUnits(bandBalance, 6)} USDC`);
    console.log(`[CRON] Nano wallet balance: ${formatUnits(nanoWalletBalance, 6)} USDC`);
    console.log(`[CRON] Total balance: ${formatUnits(totalBalance, 6)} USDC`);
    console.log(`[CRON] Threshold: ${formatUnits(CLAWBACK_THRESHOLD, 6)} USDC`);

    // Check if we need to clawback (skip check if force mode)
    if (!force && totalBalance >= CLAWBACK_THRESHOLD) {
      return NextResponse.json({
        message: 'Balance sufficient, no clawback needed',
        balances: {
          store: formatUnits(storeBalance, 6),
          band: formatUnits(bandBalance, 6),
          nanoWallet: formatUnits(nanoWalletBalance, 6),
          total: formatUnits(totalBalance, 6),
        }
      });
    }

    console.log(`[CRON] ${force ? 'Force mode: ' : 'Balance below threshold, '}initiating clawback`);
    console.log(`[CRON] Will clawback from ${force ? 'last 10,000 wallets' : `oldest wallets until reaching ${formatUnits(TARGET_THRESHOLD, 6)} USDC`}`);

    // Get current wallet index to know how many user wallets exist
    const indexKey = `wallet_index_${NETWORK}`;
    const currentIndex = await kv.get(indexKey) as number;
    const totalWallets = currentIndex ? Number(currentIndex) : 0;

    // In force mode: check last 10,000 wallets
    // In normal mode: check all wallets
    const startIndex = force
      ? Math.max(200, 200 + totalWallets - 10000) // Last 10k wallets
      : 200; // All user wallets
    const maxUserIndex = 200 + totalWallets;

    console.log(`[CRON] Checking user wallets from index ${startIndex} to ${maxUserIndex} (${maxUserIndex - startIndex} wallets)`);

    const eligibleWallets: any[] = [];

    // Check user wallets by iterating through them
    for (let i = startIndex; i < maxUserIndex; i++) {
      eligibleWallets.push({
        address: null, // Will derive from index
        index: i,
        timestamp_ms: 0, // Will clawback oldest indices first
      });
    }

    console.log(`[CRON] Found ${eligibleWallets.length} potential user wallets to check`);

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

    // Process clawbacks from oldest first until we reach target
    const clawbacks = [];
    let totalReclaimed = BigInt(0);
    let currentBalance = totalBalance;

    for (const walletData of eligibleWallets) {
      // Stop if we've reached the target threshold
      if (currentBalance >= TARGET_THRESHOLD) {
        console.log(`[CRON] Reached target threshold of ${formatUnits(TARGET_THRESHOLD, 6)} USDC, stopping clawback`);
        break;
      }
      try {
        // Derive wallet address from index
        const account = mnemonicToAccount(PROD_WALLET, {
          path: `m/44'/60'/0'/0/${walletData.index}`,
        });
        const walletAddress = account.address.toLowerCase();
        
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

        const walletClient = createWalletClient({
          account,
          chain: currentChain,
          transport: http(CURRENT_NETWORK.rpcUrl),
        }).extend(eip712WalletActions());

        const paymasterInput: Hex = getGeneralPaymasterInput({
          innerInput: "0x",
        });

        // Check if wallet has approved Band
        const allowance = await publicClient.readContract({
          address: CONTRACTS.usdcAddress,
          abi: usdcAbi,
          functionName: 'allowance',
          args: [walletAddress, CONTRACTS.bandContract],
        }) as bigint;

        let approveTx;
        if (allowance < balance) {
          console.log(`[CRON] Approving Band for ${walletAddress}`);

          // First approve Band to spend USDC
          approveTx = await walletClient.writeContract({
            address: CONTRACTS.usdcAddress,
            abi: usdcAbi,
            functionName: 'approve',
            args: [CONTRACTS.bandContract, BigInt(2) ** BigInt(256) - BigInt(1)],
            chain: currentChain,
            paymaster: CONTRACTS.paymasterAddress,
            paymasterInput: paymasterInput,
          });

          console.log(`[CRON] Approval tx: ${approveTx}`);
        }

        // Call revoke function
        const revokeTx = await walletClient.writeContract({
          address: CONTRACTS.bandContract,
          abi: bandAbi,
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
          approveTx: approveTx,
          index: walletData.index,
        });

        totalReclaimed += balance;
        currentBalance += balance; // Update running balance

        // Log to Supabase
        await supabase.from('wallet_events').insert({
          event_type: 'usdc_clawback',
          metadata: {
            wallet_address: walletAddress,
            amount: balance.toString(),
            tx_hash: revokeTx,
            approve_tx: approveTx,
            index: walletData.index,
            reason: 'low_system_balance',
            network: NETWORK,
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
        total_eligible_wallets: eligibleWallets.length,
        total_clawbacks: clawbacks.length,
        total_amount_reclaimed: totalReclaimed.toString(),
        balance_before: totalBalance.toString(),
        balance_after: currentBalance.toString(),
        clawback_trigger_threshold: CLAWBACK_THRESHOLD.toString(),
        target_threshold: TARGET_THRESHOLD.toString(),
        reached_target: currentBalance >= TARGET_THRESHOLD,
        balances: {
          store: storeBalance.toString(),
          band: bandBalance.toString(),
          nanoWallet: nanoWalletBalance.toString(),
        },
        network: NETWORK,
      },
    });

    return NextResponse.json({
      message: 'Clawback completed',
      balances: {
        store: formatUnits(storeBalance, 6),
        band: formatUnits(bandBalance, 6),
        nanoWallet: formatUnits(nanoWalletBalance, 6),
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
        network: NETWORK,
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