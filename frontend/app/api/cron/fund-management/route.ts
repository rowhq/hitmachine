import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
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
const STORE_WITHDRAWAL_THRESHOLD = BigInt(3000 * 1e6); // 3,000 USDC
const BAND_REFILL_THRESHOLD = BigInt(10000 * 1e6); // 10,000 USDC

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
    console.log(`[CRON] Starting fund management on ${NETWORK}`);

    // Initialize clients
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    });

    // Derive nano wallet (index 0) from prod wallet mnemonic
    const nanoWallet = mnemonicToAccount(PROD_WALLET, {
      path: `m/44'/60'/0'/0/0`,
    });
    
    console.log(`[CRON] Nano wallet address: ${nanoWallet.address}`);

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
    
    // Initialize wallet clients
    const nanoWalletClient = createWalletClient({
      account: nanoWallet,
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    }).extend(eip712WalletActions());

    // Use admin wallet for contract withdrawals
    const adminWallet = privateKeyToAccount(
      `0x${process.env.WALLET_PRIVATE_KEY!}`
    );
    
    const adminWalletClient = createWalletClient({
      account: adminWallet,
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    }).extend(eip712WalletActions());

    const paymasterInput: Hex = getGeneralPaymasterInput({
      innerInput: "0x",
    });

    // Check if store has > 3k USDC
    if (storeBalance > STORE_WITHDRAWAL_THRESHOLD) {
      const withdrawAmount = storeBalance - BigInt(100 * 1e6); // Leave 100 USDC in store
      console.log(`[CRON] Withdrawing ${formatUnits(withdrawAmount, 6)} USDC from Store to nano wallet`);

      try {
        // Call claimOwnerCommissionMarketing to withdraw to nano wallet
        const withdrawTx = await adminWalletClient.writeContract({
          address: CONTRACTS.storeContract,
          abi: storeAbi,
          functionName: 'claimOwnerCommissionMarketing',
          args: [nanoWallet.address],
          chain: currentChain,
          paymaster: CONTRACTS.paymasterAddress,
          paymasterInput: paymasterInput,
        });

        transactions.push({
          type: 'store_withdrawal',
          amount: formatUnits(withdrawAmount, 6),
          txHash: withdrawTx,
          to: nanoWallet.address,
        });

        console.log(`[CRON] Store withdrawal tx: ${withdrawTx}`);

        // Log to Supabase
        await supabase.from('wallet_events').insert({
          event_type: 'store_withdrawal',
          metadata: {
            amount: withdrawAmount.toString(),
            tx_hash: withdrawTx,
            from: 'store_contract',
            to: nanoWallet.address,
            balance_before: storeBalance.toString(),
            network: NETWORK,
          },
        });
      } catch (error) {
        console.error('[CRON] Store withdrawal error:', error);
      }
    }

    // Check if Band has < 10k USDC
    if (bandBalance < BAND_REFILL_THRESHOLD) {
      const refillAmount = BAND_REFILL_THRESHOLD - bandBalance;

      // Check if nano wallet has enough to refill
      if (nanoWalletBalance >= refillAmount) {
        console.log(`[CRON] Sending ${formatUnits(refillAmount, 6)} USDC from nano wallet to Band`);

        try {
          // Transfer USDC from nano wallet to Band
          const transferTx = await nanoWalletClient.writeContract({
            address: CONTRACTS.usdcAddress,
            abi: usdcAbi,
            functionName: 'transfer',
            args: [CONTRACTS.bandContract, refillAmount],
            chain: currentChain,
            paymaster: CONTRACTS.paymasterAddress,
            paymasterInput: paymasterInput,
          });

          transactions.push({
            type: 'band_refill',
            amount: formatUnits(refillAmount, 6),
            txHash: transferTx,
            from: nanoWallet.address,
            to: CONTRACTS.bandContract,
          });

          console.log(`[CRON] Band refill tx: ${transferTx}`);

          // Log to Supabase
          await supabase.from('wallet_events').insert({
            event_type: 'band_refill',
            metadata: {
              amount: refillAmount.toString(),
              tx_hash: transferTx,
              from: nanoWallet.address,
              to: 'band_contract',
              balance_before: bandBalance.toString(),
              nano_wallet_balance: nanoWalletBalance.toString(),
              network: NETWORK,
            },
          });
        } catch (error) {
          console.error('[CRON] Band refill error:', error);
        }
      } else {
        console.log(`[CRON] Nano wallet has insufficient balance to refill Band`);
        console.log(`[CRON] Needed: ${formatUnits(refillAmount, 6)} USDC, Available: ${formatUnits(nanoWalletBalance, 6)} USDC`);

        // Log insufficient balance event
        await supabase.from('wallet_events').insert({
          event_type: 'band_refill_insufficient',
          metadata: {
            needed_amount: refillAmount.toString(),
            available_amount: nanoWalletBalance.toString(),
            band_balance: bandBalance.toString(),
            network: NETWORK,
          },
        });
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
          band_refill: BAND_REFILL_THRESHOLD.toString(),
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
        bandRefill: formatUnits(BAND_REFILL_THRESHOLD, 6),
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