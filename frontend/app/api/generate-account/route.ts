import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { getGeneralPaymasterInput, eip712WalletActions } from "viem/zksync";
import { currentChain } from "../../config/chains";
import { kv } from "@vercel/kv";
import usdcAbi from "../../abi/mockUsdc.json";
import storeAbi from "../../abi/nanoMusicStore.json";
import bandAbi from "../../abi/nanoBand.json";
import { corsHeaders } from "../cors";
import { CONTRACTS, GIFT_CARD_PRICE, GIFT_CARD_PRICE_DISPLAY, CURRENT_NETWORK, NETWORK } from "../../config/environment";
import {
  trackGenerateAttempt,
  trackWalletGenerated,
  trackWalletFunded,
  trackError,
  incrementCounter,
  addToSet,
  pushToList
} from "../../utils/analytics-service";

const USER_MNEMONIC = process.env.USER_MNEMONIC!;

// Get network configuration (now unified from environment)
function getNetworkConfig() {
  return {
    chain: currentChain,
    ...CONTRACTS,
    network: NETWORK,
    rpcUrl: CURRENT_NETWORK.rpcUrl,
  };
}


export async function POST(request: NextRequest) {
  const headers = corsHeaders();

  try {
    // Parse optional request body
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body is optional, continue without it
    }
    // Get network configuration
    const config = getNetworkConfig();

    // Log only essential info in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`Generate account - Network: ${config.network}`);
    }

    // Use improved IP detection
    const { getClientIP, getGeoInfo } = await import('../../utils/ip-detection');
    const ip = getClientIP(request);
    const geoInfo = getGeoInfo(request);
    
    // Log IP detection in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('IP Detection:', { ip });
    }

    // Simple rate limiting - 10 requests per second per IP
    const rateLimitKey = `rate:${ip}:${Math.floor(Date.now() / 1000)}`;
    const requests = await kv.incr(rateLimitKey);
    await kv.expire(rateLimitKey, 2); // Expire after 2 seconds
    
    if (requests > 10) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again in a moment.",
          retryAfter: 1
        },
        { status: 429, headers }
      );
    }

    // Track the attempt after rate limit check
    await trackGenerateAttempt(request);

    const indexKey = `wallet_index_${config.network}`;
    
    // Get and increment index atomically
    const index = await kv.incr(indexKey) - 1;

    // Derive new wallet for the user
    const recipient = mnemonicToAccount(USER_MNEMONIC, {
      path: `m/44'/60'/0'/0/${index}`,
    });

    // Track wallet generation
    await trackWalletGenerated(request, recipient.address, index);

    // Prepare all clients and data upfront
    const distributor = privateKeyToAccount(
      `0x${process.env.WALLET_PRIVATE_KEY!}`
    );

    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    const distributorClient = createWalletClient({
      account: distributor,
      chain: config.chain,
      transport: http(config.rpcUrl),
    }).extend(eip712WalletActions());

    const recipientClient = createWalletClient({
      account: recipient,
      chain: config.chain,
      transport: http(config.rpcUrl),
    }).extend(eip712WalletActions());

    // Prepare paymaster input once
    const paymasterInput: Hex = getGeneralPaymasterInput({
      innerInput: "0x",
    });

    // Get nonce in parallel with other operations
    const noncePromise = publicClient.getTransactionCount({
      address: distributor.address,
      blockTag: "pending",
    });

    // Start KV storage operation early
    const kvPromise = kv.set(
      `wallet_address_to_index:${recipient.address.toLowerCase()}`,
      index
    );

    // Wait for nonce before sending transactions
    const confirmedNonce = await noncePromise;

    // Execute both transactions in parallel
    const [payTx, approveTx] = await Promise.all([
      // Send USDC to recipient
      distributorClient.writeContract({
        address: config.bandContract,
        abi: bandAbi,
        functionName: "paySongSubmitter",
        args: [recipient.address, GIFT_CARD_PRICE, BigInt(0)],
        chain: config.chain,
        nonce: confirmedNonce,
        paymaster: config.paymasterAddress,
        paymasterInput: paymasterInput,
      }),
      // Approve Store contract spending (from recipient wallet)
      recipientClient.writeContract({
        address: config.usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [config.storeContract, BigInt(2) ** BigInt(256) - BigInt(1)], // Max uint256
        chain: config.chain,
        paymaster: config.paymasterAddress,
        paymasterInput: paymasterInput,
      })
    ]);

    // Ensure KV storage is complete
    await kvPromise;

    // Track wallet funding with transaction hashes
    await trackWalletFunded(request, recipient.address, payTx.toString(), approveTx.toString());

    // Additional KV analytics
    await Promise.all([
      addToSet("unique_ips", ip),
      incrementCounter("total_wallets_generated"),
      pushToList("recent_wallets", {
        address: recipient.address,
        ip,
        timestamp: new Date().toISOString(),
        index,
        network: config.network,
        country: geoInfo.country,
        city: geoInfo.city,
        region: geoInfo.region,
      }, 100)
    ]);

    return NextResponse.json(
      {
        message: "Account created and funded",
        address: recipient.address,
        index,
        payTx: payTx.toString(),
        approveTx: approveTx.toString(),
        fundedWith: {
          usdc: `${GIFT_CARD_PRICE_DISPLAY} USDC (from Band contract - for gift card purchase)`,
          soph: "0 SOPH (not needed - paymaster covers all gas)",
        },
        storeContract: config.storeContract,
        usdcAddress: config.usdcAddress,
        status: "pending", // Transactions are pending, not confirmed
      },
      { headers }
    );
  } catch (err: any) {
    console.error("Generate account error:", err);
    console.error("Error details:", {
      message: err.message,
      cause: err.cause,
      details: err.details,
      stack: err.stack,
    });

    // Check for specific error types
    let errorMessage = "Unexpected error";
    if (err.message?.includes("insufficient funds")) {
      errorMessage = "Distributor wallet has insufficient funds";
    } else if (err.message?.includes("nonce")) {
      errorMessage = "Transaction nonce error - please retry";
    } else if (err.message?.includes("paymaster")) {
      errorMessage = "Paymaster error - check paymaster configuration";
    } else if (err.message?.includes("eip712") || err.message?.includes("zkSync")) {
      errorMessage = `zkSync error: ${err.message}`;
    } else if (err.message) {
      errorMessage = err.message;
    }

    // Track the error
    await trackError(request, 'generate_account_attempt', errorMessage, undefined, {
      error_stack: err.stack,
      error_cause: err.cause
    });

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500, headers }
    );
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
