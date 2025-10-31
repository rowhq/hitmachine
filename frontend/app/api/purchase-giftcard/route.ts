import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, parseUnits, type Hex } from "viem";
import { getGeneralPaymasterInput, eip712WalletActions } from 'viem/zksync';
import { currentChain } from "../../config/chains";
import { kv } from "@vercel/kv";
import storeAbi from "../../abi/nanoMusicStore.json";
import usdcAbi from "../../abi/mockUsdc.json";
import { corsHeaders } from "../cors";
import { CONTRACTS, GIFT_CARD_PRICE, CURRENT_NETWORK, NETWORK } from "../../config/environment";
import { getClientIP } from "../../utils/ip-detection";
import {
  trackPurchaseAttempt,
  trackPurchaseCompleted,
  trackError,
  incrementCounter
} from "../../utils/analytics-service";

const PROD_WALLET = process.env.PROD_WALLET!;

// Get network configuration (now unified from environment)
function getNetworkConfig() {
  return {
    chain: currentChain,
    ...CONTRACTS,
    network: NETWORK,
    rpcUrl: CURRENT_NETWORK.rpcUrl,
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders();
  
  // Get IP address for tracking
  const ip = getClientIP(request);
  console.log(`Purchase attempt from IP: ${ip}`);
  
  // Rate limiting - 10000 purchase attempts per minute per IP (temporarily high for testing)
  const rateLimitKey = `purchase:${ip}:${Math.floor(Date.now() / 60000)}`;
  const requests = await kv.incr(rateLimitKey);
  await kv.expire(rateLimitKey, 120); // Expire after 2 minutes

  if (requests > 10000) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: 60
      },
      { status: 429, headers }
    );
  }

  try {
    // Get network configuration
    const config = getNetworkConfig();

    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseError.message },
        { status: 400, headers }
      );
    }
    const address = body.address as `0x${string}`;

    if (!address) {
      await trackError(request, 'purchase_attempt', 'Address parameter is required');
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400, headers }
      );
    }

    // Track purchase attempt with wallet address
    await trackPurchaseAttempt(request, address);

    const index = (await kv.get(
      `wallet_address_to_index:${address.toLowerCase()}`
    )) as number;

    console.log(
      `Looking up wallet ${address.toLowerCase()}, found index: ${index}`
    );

    // Validate index range
    if (index === null || index === undefined || isNaN(index) || index < 0) {
      await trackError(request, 'purchase_attempt', 'Wallet not found in system', address, {
        indexFound: index
      });
      return NextResponse.json(
        {
          error: "Wallet not found in system",
          details:
            "This wallet was not generated through the system. Please use Generate Wallet first.",
          address: address,
          indexFound: index,
        },
        { status: 400, headers }
      );
    }

    const indexKey = `wallet_index_${config.network}`;
    const rawMaxIndex = await kv.get(indexKey);
    const maxIndex = 200 + Number(rawMaxIndex); // User addresses start at 200
    if (index > maxIndex) {
      await trackError(request, 'purchase_attempt', `Index out of bounds: max is ${maxIndex}`, address, {
        index,
        maxIndex
      });
      return NextResponse.json(
        { error: `Index out of bounds: max is ${maxIndex}` },
        { status: 400, headers }
      );
    }

    const account = mnemonicToAccount(PROD_WALLET, {
      path: `m/44'/60'/0'/0/${index}`,
    });

    console.log(`Derived wallet for index ${index}: ${account.address}`);

    // Verify the derived wallet matches the input address
    if (account.address.toLowerCase() !== address.toLowerCase()) {
      await trackError(request, 'purchase_attempt', 'Wallet mismatch', address, {
        providedAddress: address,
        derivedAddress: account.address,
        index: index
      });
      return NextResponse.json(
        {
          error: "Wallet mismatch",
          details: "The derived wallet does not match the provided address",
          providedAddress: address,
          derivedAddress: account.address,
          index: index,
        },
        { status: 400, headers }
      );
    }

    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    // Note: The new NanoMusicStore contract doesn't track individual purchases
    // Users can buy multiple gift cards if they want

    const walletClient = createWalletClient({
      account,
      chain: config.chain,
      transport: http(config.rpcUrl),
    }).extend(eip712WalletActions());

    // Use gift card price from config
    const giftcardPrice = GIFT_CARD_PRICE;

    // Get the nonce for the wallet
    const nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending'
    });

    // Check current allowance
    const currentAllowance = (await publicClient.readContract({
      address: config.usdcAddress,
      abi: usdcAbi,
      functionName: "allowance",
      args: [account.address, config.storeContract],
    })) as bigint;

    console.log(
      `Current allowance: ${currentAllowance.toString()}, Gift card price: ${giftcardPrice.toString()}`
    );

    // Prepare paymaster input
    const paymasterInput: Hex = getGeneralPaymasterInput({
      innerInput: "0x"
    });

    // Prepare both transactions to send at the same time
    const transactions = [];
    
    // If allowance is insufficient, prepare the approval transaction
    if (currentAllowance < giftcardPrice) {
      console.log(
        `Current allowance: ${currentAllowance.toString()}, needed: ${giftcardPrice.toString()}. Approving...`
      );

      // First check the wallet has USDC balance
      const usdcBalance = (await publicClient.readContract({
        address: config.usdcAddress,
        abi: usdcAbi,
        functionName: "balanceOf",
        args: [account.address],
      })) as bigint;

      console.log(`Wallet USDC balance: ${usdcBalance.toString()}`);
      
      // Validate sufficient balance
      if (usdcBalance < giftcardPrice) {
        const shortfall = giftcardPrice - usdcBalance;
        await trackError(request, 'purchase_attempt', 'Insufficient USDC balance', address, {
          balance: usdcBalance.toString(),
          required: giftcardPrice.toString(),
          shortfall: shortfall.toString()
        });
        return NextResponse.json(
          {
            error: "Insufficient USDC balance",
            details: `Wallet has ${(Number(usdcBalance) / 1e6).toFixed(2)} USDC but needs ${(Number(giftcardPrice) / 1e6).toFixed(2)} USDC`,
            balance: usdcBalance.toString(),
            required: giftcardPrice.toString(),
            shortfall: shortfall.toString(),
          },
          { status: 400, headers }
        );
      }

      // Approve infinite amount so user only needs to approve once
      const approvalAmount = BigInt(2) ** BigInt(256) - BigInt(1); // Max uint256

      console.log(
        `Preparing approval tx with nonce ${nonce} from ${account.address} to ${config.storeContract}`
      );

      // Send approval transaction with current nonce
      const approveTx = await walletClient.writeContract({
        address: config.usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [config.storeContract, approvalAmount],
        chain: config.chain,
        nonce: nonce,
        paymaster: config.paymasterAddress,
        paymasterInput: paymasterInput
      });

      console.log(`Approval tx sent: ${approveTx}`);
      transactions.push({ type: 'approval', hash: approveTx });
    }

    // Now send the purchase transaction
    try {
      // Use nonce+1 if we sent an approval, otherwise use current nonce
      const purchaseNonce = currentAllowance < giftcardPrice ? nonce + 1 : nonce;
      
      console.log(
        `Sending buyGiftcard tx with nonce ${purchaseNonce}`
      );

      // Send purchase transaction
      const purchaseTx = await walletClient.writeContract({
        address: config.storeContract,
        abi: storeAbi,
        functionName: "buyGiftcard",
        args: [],
        chain: config.chain,
        nonce: purchaseNonce,
        paymaster: config.paymasterAddress,
        paymasterInput: paymasterInput
      });

      console.log(`Purchase tx sent: ${purchaseTx}`);
      transactions.push({ type: 'purchase', hash: purchaseTx });
      
      // Track successful purchase
      await trackPurchaseCompleted(request, account.address, purchaseTx.toString(), transactions);

      // Additional KV analytics (network-specific)
      await incrementCounter(`total_purchases_completed_${config.network}`);

      // Don't wait for confirmations - return immediately
      // Find the purchase transaction hash for the UI
      const purchaseTxObj = transactions.find(t => t.type === 'purchase');

      return NextResponse.json(
        {
          message: "Gift card purchase transactions sent",
          buyer: account.address,
          index,
          transactions: transactions,
          txHash: purchaseTxObj?.hash, // Main transaction hash for UI
          status: 'pending', // Transactions are pending, not confirmed
          approvalNeeded: currentAllowance < giftcardPrice,
        },
        { headers }
      );
    } catch (error: any) {
      console.error(
        "Transaction failed:",
        error.message || "Unknown error"
      );

      // Track failed purchase
      await trackError(request, 'purchase_attempt', error.message || "Unknown error", account.address, {
        reason: error.cause?.reason || error.cause?.message,
        transactions
      });
      
      // Parse error for better user feedback
      let userFriendlyError = "Transaction failed";
      if (error.message?.includes("insufficient funds")) {
        userFriendlyError = "Insufficient funds for gas fees";
      } else if (error.message?.includes("nonce")) {
        userFriendlyError = "Transaction nonce error - please retry";
      } else if (error.message?.includes("paymaster")) {
        userFriendlyError = "Gas sponsorship failed - please try again";
      }
      
      // Return more detailed error
      return NextResponse.json(
        {
          error: userFriendlyError,
          details: error.message || "Transaction failed",
          reason:
            error.cause?.reason || error.cause?.message,
          transactions: transactions,
        },
        { status: 400, headers }
      );
    }
  } catch (err: any) {
    console.error("Purchase album error:", err.message || err);
    
    // Track top-level error
    await trackError(request, 'purchase_attempt', err.message || "Unexpected error", undefined, {
      stack: err.stack
    });
    
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500, headers }
    );
  }
}
