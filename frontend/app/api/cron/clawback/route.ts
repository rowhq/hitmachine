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
import { withRetry, RateLimiter } from "../../../utils/rpc-retry";

const PROD_WALLET = process.env.PROD_WALLET!;
const CLAWBACK_THRESHOLD = BigInt(10000 * 1e6); // 10,000 USDC - trigger clawback
const TARGET_THRESHOLD = BigInt(0); // Clawback ALL funds (no stopping point)
const MIN_WALLET_AGE_MS = 5 * 60 * 1000; // Minimum 5 minutes before clawback (safety buffer)
const BATCH_SIZE = 100; // Process 100 wallets in parallel for balance checks
const PARALLEL_TX_LIMIT = 10; // Max 10 parallel transactions to avoid rate limits

// Rate limiter: ~50 requests per second with burst capacity of 100
const rateLimiter = new RateLimiter(50, 100);

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  // Check for force parameter, lastAddress, and lastIndex
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const lastAddress = searchParams.get('lastAddress');
  const lastIndexParam = searchParams.get('lastIndex');

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

    // Check store balance with retry
    const storeBalance = await withRetry(() =>
      publicClient.readContract({
        address: CONTRACTS.storeContract,
        abi: storeAbi,
        functionName: 'getContractBalance',
      })
    ) as bigint;

    // Check band balance with retry
    const bandBalance = await withRetry(() =>
      publicClient.readContract({
        address: CONTRACTS.bandContract,
        abi: bandAbi,
        functionName: 'getUSDCBalance',
      })
    ) as bigint;

    // Check nano wallet balance with retry
    const nanoWalletBalance = await withRetry(() =>
      publicClient.readContract({
        address: CONTRACTS.usdcAddress,
        abi: usdcAbi,
        functionName: 'balanceOf',
        args: [nanoWallet.address],
      })
    ) as bigint;

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
    console.log(`[CRON] Will clawback ALL unused funds to 0`);

    // Get current wallet index to know how many user wallets exist
    const indexKey = `wallet_index_${NETWORK}`;
    const currentIndex = await kv.get(indexKey) as number;
    const totalWallets = currentIndex ? Number(currentIndex) : 0;

    // Determine the ending index
    let maxUserIndex: number;

    // Priority: lastIndex > lastAddress > default (all wallets)
    if (lastIndexParam) {
      maxUserIndex = parseInt(lastIndexParam, 10);
      if (isNaN(maxUserIndex) || maxUserIndex < 200) {
        return NextResponse.json({
          error: 'Invalid lastIndex - must be >= 200',
          lastIndex: lastIndexParam,
        }, { status: 400 });
      }
      console.log(`[CRON] Using lastIndex: ${maxUserIndex}`);
    } else if (lastAddress) {
      // If lastAddress provided, look it up in KV store
      console.log(`[CRON] Looking up lastAddress: ${lastAddress}`);
      const targetAddress = lastAddress.toLowerCase();

      // Try to get index from KV store (address -> index mapping)
      const addressKey = `address_to_index_${NETWORK}_${targetAddress}`;
      const storedIndex = await kv.get(addressKey) as number;

      if (storedIndex) {
        maxUserIndex = storedIndex;
        console.log(`[CRON] Found lastAddress at index ${maxUserIndex} (from KV store)`);
      } else {
        // Fallback: derive the wallet and check if it matches
        console.log(`[CRON] Address not in KV, searching by derivation...`);
        let foundIndex = -1;

        // Search in batches for performance
        for (let i = 200 + totalWallets; i >= 200; i--) {
          const account = mnemonicToAccount(PROD_WALLET, {
            path: `m/44'/60'/0'/0/${i}`,
          });
          if (account.address.toLowerCase() === targetAddress) {
            foundIndex = i;
            break;
          }

          // Log progress every 1000 wallets
          if ((200 + totalWallets - i) % 1000 === 0) {
            console.log(`[CRON] Searched ${200 + totalWallets - i} wallets...`);
          }
        }

        if (foundIndex === -1) {
          return NextResponse.json({
            error: 'lastAddress not found in wallet range',
            lastAddress: lastAddress,
            searchedRange: `200 to ${200 + totalWallets}`,
          }, { status: 400 });
        }

        maxUserIndex = foundIndex;
        console.log(`[CRON] Found lastAddress at index ${foundIndex}`);
      }
    } else {
      maxUserIndex = 200 + totalWallets;
    }

    // In force mode: check last 10,000 wallets
    // In normal mode: check all wallets from 200 to maxUserIndex
    const startIndex = force
      ? Math.max(200, maxUserIndex - 10000) // Last 10k wallets up to maxUserIndex
      : 200; // All user wallets from 200

    console.log(`[CRON] Checking user wallets from index ${startIndex} to ${maxUserIndex} (${maxUserIndex - startIndex} wallets)`);

    // Build list of indices to check
    const indicesToCheck: number[] = [];
    for (let i = startIndex; i < maxUserIndex; i++) {
      indicesToCheck.push(i);
    }

    console.log(`[CRON] Found ${indicesToCheck.length} potential user wallets to check`);

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

    // Helper to process batches in parallel
    const processBatch = async <T, R>(items: T[], batchSize: number, processor: (item: T) => Promise<R>): Promise<R[]> => {
      const results: R[] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch.map(processor));
        results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<R>).value));
        console.log(`[CRON] Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)}`);
      }
      return results;
    };

    // Step 1: Check balances in parallel batches (500 at a time)
    console.log(`[CRON] Step 1: Checking balances for ${indicesToCheck.length} wallets in batches of ${BATCH_SIZE}`);

    interface WalletWithBalance {
      index: number;
      address: string;
      balance: bigint;
      account: ReturnType<typeof mnemonicToAccount>;
    }

    const walletsWithBalance = await processBatch(
      indicesToCheck,
      BATCH_SIZE,
      async (index: number): Promise<WalletWithBalance | null> => {
        try {
          const account = mnemonicToAccount(PROD_WALLET, {
            path: `m/44'/60'/0'/0/${index}`,
          });
          const walletAddress = account.address.toLowerCase();

          // Skip if already purchased
          if (purchasedWallets.has(walletAddress)) {
            return null;
          }

          // Check balance with rate limiting and retry
          const balance = await rateLimiter.execute(() =>
            withRetry(() =>
              publicClient.readContract({
                address: CONTRACTS.usdcAddress,
                abi: usdcAbi,
                functionName: 'balanceOf',
                args: [walletAddress],
              })
            )
          ) as bigint;

          if (balance === BigInt(0)) {
            return null;
          }

          return { index, address: walletAddress, balance, account };
        } catch (error) {
          console.error(`[CRON] Error checking wallet ${index}:`, error);
          return null;
        }
      }
    );

    const validWallets = walletsWithBalance.filter((w): w is WalletWithBalance => w !== null);
    console.log(`[CRON] Found ${validWallets.length} wallets with USDC to clawback`);

    if (validWallets.length === 0) {
      return NextResponse.json({
        message: 'No wallets with funds to clawback',
        walletsChecked: indicesToCheck.length,
      });
    }

    // Step 2: Process clawbacks in parallel (50 at a time to avoid overwhelming the network)
    console.log(`[CRON] Step 2: Processing ${validWallets.length} clawbacks in batches of ${PARALLEL_TX_LIMIT}`);

    const clawbacks = await processBatch(
      validWallets,
      PARALLEL_TX_LIMIT,
      async (wallet: WalletWithBalance) => {
        try {
          console.log(`[CRON] Clawing back ${formatUnits(wallet.balance, 6)} USDC from ${wallet.address}`);

          const walletClient = createWalletClient({
            account: wallet.account,
            chain: currentChain,
            transport: http(CURRENT_NETWORK.rpcUrl),
          }).extend(eip712WalletActions());

          const paymasterInput: Hex = getGeneralPaymasterInput({
            innerInput: "0x",
          });

          // Check allowance with rate limiting and retry
          const allowance = await rateLimiter.execute(() =>
            withRetry(() =>
              publicClient.readContract({
                address: CONTRACTS.usdcAddress,
                abi: usdcAbi,
                functionName: 'allowance',
                args: [wallet.address, CONTRACTS.bandContract],
              })
            )
          ) as bigint;

          let approveTx;
          if (allowance < wallet.balance) {
            console.log(`[CRON] Approving Band for ${wallet.address}`);
            approveTx = await rateLimiter.execute(() =>
              withRetry(() =>
                walletClient.writeContract({
                  address: CONTRACTS.usdcAddress,
                  abi: usdcAbi,
                  functionName: 'approve',
                  args: [CONTRACTS.bandContract, BigInt(2) ** BigInt(256) - BigInt(1)],
                  chain: currentChain,
                  paymaster: CONTRACTS.paymasterAddress,
                  paymasterInput: paymasterInput,
                })
              )
            );
          }

          // Call revoke function with rate limiting and retry
          const revokeTx = await rateLimiter.execute(() =>
            withRetry(() =>
              walletClient.writeContract({
                address: CONTRACTS.bandContract,
                abi: bandAbi,
                functionName: 'revoke',
                args: [],
                chain: currentChain,
                paymaster: CONTRACTS.paymasterAddress,
                paymasterInput: paymasterInput,
              })
            )
          );

          // Log to Supabase
          await supabase.from('wallet_events').insert({
            event_type: 'usdc_clawback',
            metadata: {
              wallet_address: wallet.address,
              amount: wallet.balance.toString(),
              tx_hash: revokeTx,
              approve_tx: approveTx,
              index: wallet.index,
              reason: 'low_system_balance',
              network: NETWORK,
            },
          });

          return {
            wallet: wallet.address,
            amount: formatUnits(wallet.balance, 6),
            txHash: revokeTx,
            approveTx: approveTx,
            index: wallet.index,
            balance: wallet.balance,
          };
        } catch (error) {
          console.error(`[CRON] Error clawing back from ${wallet.address}:`, error);
          return null;
        }
      }
    );

    const successfulClawbacks = clawbacks.filter(c => c !== null);
    const totalReclaimed = successfulClawbacks.reduce((sum, c) => sum + (c?.balance || BigInt(0)), BigInt(0));

    // Log summary
    await supabase.from('wallet_events').insert({
      event_type: 'clawback_summary',
      metadata: {
        total_wallets_checked: indicesToCheck.length,
        wallets_with_balance: validWallets.length,
        successful_clawbacks: successfulClawbacks.length,
        failed_clawbacks: clawbacks.length - successfulClawbacks.length,
        total_amount_reclaimed: totalReclaimed.toString(),
        balance_before: totalBalance.toString(),
        clawback_trigger_threshold: CLAWBACK_THRESHOLD.toString(),
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
        walletsChecked: indicesToCheck.length,
        walletsWithBalance: validWallets.length,
        successfulClawbacks: successfulClawbacks.length,
        failedClawbacks: clawbacks.length - successfulClawbacks.length,
        totalReclaimed: formatUnits(totalReclaimed, 6),
        details: successfulClawbacks,
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