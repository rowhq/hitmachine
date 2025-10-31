import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  type Hex,
} from "viem";
import { getGeneralPaymasterInput, eip712WalletActions } from "viem/zksync";
import { currentChain } from "../../../config/chains";
import { createClient } from "@supabase/supabase-js";
import usdcAbi from "../../../abi/mockUsdc.json";
import storeAbi from "../../../abi/nanoMusicStore.json";
import bandAbi from "../../../abi/nanoBand.json";
import { CONTRACTS, CURRENT_NETWORK, NETWORK } from "../../../config/environment";

const PROD_WALLET = process.env.PROD_WALLET!;
const STORE_WITHDRAWAL_THRESHOLD = BigInt(1000 * 1e6); // 1,000 USDC
const NANO_DEPOSIT_THRESHOLD = BigInt(3000 * 1e6); // 3,000 USDC - nano deposits to Band when above this

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  // Check for force parameter
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  try {
    console.log(`[CRON] Starting fund management on ${NETWORK}${force ? ' (FORCE MODE)' : ''}`);

    // Initialize clients
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    });

    // Derive nano wallet (index 0) - receives funds from Store
    const nanoWallet = mnemonicToAccount(PROD_WALLET, {
      path: `m/44'/60'/0'/0/0`,
    });

    // Derive marketing admin wallet (index 4) - has MARKETING_BUDGET_ROLE on Store
    const marketingWallet = mnemonicToAccount(PROD_WALLET, {
      path: `m/44'/60'/0'/0/4`,
    });

    console.log(`[CRON] Nano wallet address (index 0): ${nanoWallet.address}`);
    console.log(`[CRON] Marketing wallet address (index 4): ${marketingWallet.address}`);

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

    console.log(`[CRON] Store balance: ${formatUnits(storeBalance, 6)} USDC`);
    console.log(`[CRON] Band balance: ${formatUnits(bandBalance, 6)} USDC`);
    console.log(`[CRON] Nano wallet balance: ${formatUnits(nanoWalletBalance, 6)} USDC`);

    const transactions = [];

    // Initialize marketing wallet client (index 4 with MARKETING_BUDGET_ROLE)
    const marketingWalletClient = createWalletClient({
      account: marketingWallet,
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    }).extend(eip712WalletActions());

    // Initialize nano wallet client for Band refills
    const nanoWalletClient = createWalletClient({
      account: nanoWallet,
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    }).extend(eip712WalletActions());

    const paymasterInput: Hex = getGeneralPaymasterInput({
      innerInput: "0x",
    });

    // Check if store has > 1k USDC (or force mode to move everything)
    if (force || storeBalance > STORE_WITHDRAWAL_THRESHOLD) {
      const withdrawAmount = force
        ? storeBalance // Force: take everything
        : storeBalance - BigInt(100 * 1e6); // Normal: leave 100 USDC in store
      console.log(`[CRON] Paying ${formatUnits(withdrawAmount, 6)} USDC from Store to nano wallet via marketing budget${force ? ' (FORCED)' : ''}`);

      try {
        // Call payMarketing using marketing wallet (index 4 with MARKETING_BUDGET_ROLE)
        // This pays from Store contract to nano wallet (index 0)
        const paymentTx = await marketingWalletClient.writeContract({
          address: CONTRACTS.storeContract,
          abi: storeAbi,
          functionName: 'payMarketing',
          args: [nanoWallet.address, withdrawAmount],
          chain: currentChain,
          paymaster: CONTRACTS.paymasterAddress,
          paymasterInput: paymasterInput,
        });

        transactions.push({
          type: 'store_marketing_payment',
          amount: formatUnits(withdrawAmount, 6),
          txHash: paymentTx,
          from: 'marketing_wallet_index_4',
          to: nanoWallet.address,
        });

        console.log(`[CRON] Store marketing payment tx: ${paymentTx}`);

        // Log to Supabase
        await supabase.from('wallet_events').insert({
          event_type: 'store_marketing_payment',
          metadata: {
            amount: withdrawAmount.toString(),
            tx_hash: paymentTx,
            from: 'store_contract',
            via: marketingWallet.address,
            to: nanoWallet.address,
            balance_before: storeBalance.toString(),
            network: NETWORK,
          },
        });
      } catch (error) {
        console.error('[CRON] Store marketing payment error:', error);
      }
    }

    // Check if nano wallet has > 3k USDC (or force mode to send everything)
    if (force || nanoWalletBalance > NANO_DEPOSIT_THRESHOLD) {
      const depositAmount = nanoWalletBalance; // Send ALL nano balance to Band

      // Check if nano wallet has any balance
      if (depositAmount > 0) {
        console.log(`[CRON] Sending ${formatUnits(depositAmount, 6)} USDC from nano wallet to Band${force ? ' (FORCED - all balance)' : ' (> 3k threshold - all balance)'}`);

        try {
          // Transfer USDC from nano wallet to Band
          const transferTx = await nanoWalletClient.writeContract({
            address: CONTRACTS.usdcAddress,
            abi: usdcAbi,
            functionName: 'transfer',
            args: [CONTRACTS.bandContract, depositAmount],
            chain: currentChain,
            paymaster: CONTRACTS.paymasterAddress,
            paymasterInput: paymasterInput,
          });

          transactions.push({
            type: 'band_deposit',
            amount: formatUnits(depositAmount, 6),
            txHash: transferTx,
            from: nanoWallet.address,
            to: CONTRACTS.bandContract,
          });

          console.log(`[CRON] Band deposit tx: ${transferTx}`);

          // Log to Supabase
          await supabase.from('wallet_events').insert({
            event_type: 'band_deposit',
            metadata: {
              amount: depositAmount.toString(),
              tx_hash: transferTx,
              from: nanoWallet.address,
              to: 'band_contract',
              band_balance_before: bandBalance.toString(),
              nano_wallet_balance_before: nanoWalletBalance.toString(),
              network: NETWORK,
            },
          });
        } catch (error) {
          console.error('[CRON] Band deposit error:', error);
        }
      }
    }

    // Log summary
    await supabase.from('wallet_events').insert({
      event_type: 'fund_management_summary',
      metadata: {
        store_balance: storeBalance.toString(),
        band_balance: bandBalance.toString(),
        nano_wallet_balance: nanoWalletBalance.toString(),
        transactions: transactions,
        thresholds: {
          store_withdrawal: STORE_WITHDRAWAL_THRESHOLD.toString(),
          nano_deposit: NANO_DEPOSIT_THRESHOLD.toString(),
        },
        network: NETWORK,
      },
    });

    return NextResponse.json({
      message: 'Fund management completed',
      balances: {
        store: formatUnits(storeBalance, 6),
        band: formatUnits(bandBalance, 6),
        nanoWallet: formatUnits(nanoWalletBalance, 6),
      },
      thresholds: {
        storeWithdrawal: formatUnits(STORE_WITHDRAWAL_THRESHOLD, 6),
        nanoDeposit: formatUnits(NANO_DEPOSIT_THRESHOLD, 6),
      },
      transactions: transactions,
      network: NETWORK,
    });

  } catch (error: any) {
    console.error('[CRON] Fund management error:', error);
    
    // Log error
    await supabase.from('wallet_events').insert({
      event_type: 'fund_management_error',
      metadata: {
        error: error.message,
        stack: error.stack,
        network: NETWORK,
      },
    });

    return NextResponse.json({
      error: 'Fund management failed',
      details: error.message,
    }, { status: 500 });
  }
}

// Also support POST for manual triggering (with auth)
export async function POST(request: NextRequest) {
  return GET(request);
}