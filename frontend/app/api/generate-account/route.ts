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
import { createClient } from "@supabase/supabase-js";
import usdcAbi from "../../abi/mockUsdc.json";
import storeAbi from "../../abi/nanoMusicStore.json";
import animalCareAbi from "../../abi/nanoAnimalCare.json";
import { corsHeaders } from "../cors";
import { CONTRACTS, GIFT_CARD_PRICE, GIFT_CARD_PRICE_DISPLAY, CURRENT_NETWORK, NETWORK } from "../../config/environment";

const MNEMONIC = process.env.MNEMONIC!;

// Get network configuration (now unified from environment)
function getNetworkConfig() {
  return {
    chain: currentChain,
    ...CONTRACTS,
    network: NETWORK,
    rpcUrl: CURRENT_NETWORK.rpcUrl,
  };
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const indexKey = `wallet_index_${config.network}`;
    
    // Get and increment index atomically
    const index = await kv.incr(indexKey) - 1;

    // Derive new wallet for the user
    const recipient = mnemonicToAccount(MNEMONIC, {
      path: `m/44'/60'/0'/0/${index}`,
    });

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

    // Execute all transactions in parallel
    const [payTx, approveStoreTx, approveAnimalCareTx] = await Promise.all([
      // Send USDC to recipient
      distributorClient.writeContract({
        address: config.animalCareContract,
        abi: animalCareAbi,
        functionName: "payCatFeeder",
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
      }),
      // Approve AnimalCare contract spending (from recipient wallet) - for revoke
      recipientClient.writeContract({
        address: config.usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [config.animalCareContract, BigInt(2) ** BigInt(256) - BigInt(1)], // Max uint256
        chain: config.chain,
        nonce: 1, // Second transaction from recipient
        paymaster: config.paymasterAddress,
        paymasterInput: paymasterInput,
      })
    ]);

    // Ensure KV storage is complete
    await kvPromise;

    // Start all analytics operations in parallel (non-blocking)
    const analyticsPromises = [
      // Supabase tracking
      (async () => {
        try {
          await supabase.from("wallet_events").insert({
            ip_address: ip,
            event_type: "wallet_generated",
            metadata: {
              wallet_address: recipient.address,
              index,
              funded_usdc: GIFT_CARD_PRICE_DISPLAY,
              funded_soph: "0",
              network: config.network,
            },
          });
        } catch (err) {
          console.log("Supabase error:", err);
        }
      })(),
      
      // KV analytics
      kv.sadd("unique_ips", ip),
      kv.incr("total_wallets_generated"),
      kv.lpush(
        "recent_wallets",
        JSON.stringify({
          address: recipient.address,
          ip,
          timestamp: new Date().toISOString(),
          index,
          network: config.network,
          country: geoInfo.country,
          city: geoInfo.city,
          region: geoInfo.region,
        })
      ).then(() => kv.ltrim("recent_wallets", 0, 99))
    ];
    
    // Don't wait for analytics to complete
    Promise.all(analyticsPromises).catch(err => 
      console.error("Analytics error:", err)
    );

    return NextResponse.json(
      {
        message: "Account created and funded",
        address: recipient.address,
        index,
        payTx: payTx.toString(),
        approveTx: approveStoreTx.toString(),
        approveAnimalCareTx: approveAnimalCareTx.toString(),
        fundedWith: {
          usdc: `${GIFT_CARD_PRICE_DISPLAY} USDC (from Jobs contract - for gift card purchase)`,
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
