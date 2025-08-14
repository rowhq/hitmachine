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
import { sophonTestnet, sophonMainnet } from "../../config/chains";
import { kv } from "@vercel/kv";
import { createClient } from "@supabase/supabase-js";
import usdcAbi from "../../abi/mockUsdc.json";
import storeAbi from "../../abi/nanoMusicStore.json";
import animalCareAbi from "../../abi/nanoAnimalCare.json";
import { corsHeaders } from "../cors";

const MNEMONIC = process.env.MNEMONIC!;
const PAYMASTER_ADDRESS =
  "0x98546B226dbbA8230cf620635a1e4ab01F6A99B2" as `0x${string}`;

// Determine network from query parameter
function getNetworkConfig(request: NextRequest) {
  const url = new URL(request.url);
  const isTestnet = url.searchParams.has("testnet");

  if (isTestnet) {
    return {
      chain: sophonTestnet,
      storeContract: (process.env.NEXT_PUBLIC_TESTNET_STORE_CONTRACT ||
        "0x86E1D788FFCd8232D85dD7eB02c508e7021EB474") as `0x${string}`, // NanoMusicStore Proxy
      animalCareContract: (process.env.NEXT_PUBLIC_TESTNET_JOBS_CONTRACT ||
        "0xAAfD6b707770BC9F60A773405dE194348B6C4392") as `0x${string}`, // NanoAnimalCare Proxy
      usdcAddress: (process.env.NEXT_PUBLIC_TESTNET_USDC_ADDRESS ||
        "0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f") as `0x${string}`, // MockUSDC
      rpcUrl: "https://rpc.testnet.sophon.xyz",
      network: "testnet",
    };
  } else {
    return {
      chain: sophonMainnet,
      storeContract: (process.env.NEXT_PUBLIC_MAINNET_STORE_CONTRACT ||
        process.env.NEXT_PUBLIC_STORE_CONTRACT ||
        "") as `0x${string}`,
      animalCareContract: (process.env.NEXT_PUBLIC_MAINNET_JOBS_CONTRACT ||
        process.env.NEXT_PUBLIC_JOBS_CONTRACT ||
        "") as `0x${string}`,
      usdcAddress: (process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS ||
        process.env.NEXT_PUBLIC_USDC_ADDRESS ||
        "0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F") as `0x${string}`,
      rpcUrl: process.env.MAINNET_RPC_URL || "https://rpc.sophon.xyz",
      network: "mainnet",
    };
  }
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders();

  try {
    // Get network configuration
    const config = getNetworkConfig(request);

    console.log(
      `Generate account request - Network: ${config.network}, Chain ID: ${config.chain.id}`
    );
    console.log(
      `Using contracts - Store: ${config.storeContract}, AnimalCare: ${config.animalCareContract}`
    );
    console.log(
      `Using USDC: ${config.usdcAddress}, Paymaster: ${PAYMASTER_ADDRESS}`
    );

    // Get IP address for basic tracking
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const indexKey = `wallet_index_${config.network}`;
    const index = (await kv.get(indexKey)) || 0;

    // Derive new wallet for the user
    const recipient = mnemonicToAccount(MNEMONIC, {
      path: `m/44'/60'/0'/0/${index}`,
    });

    // increment wallet index
    await kv.incr(indexKey);

    // Use deployer wallet to call Jobs contract
    const distributor = privateKeyToAccount(
      `0x${process.env.WALLET_PRIVATE_KEY!}`
    );

    console.log(`Distributor wallet: ${distributor.address}`);
    console.log(`New recipient wallet: ${recipient.address} (index: ${index})`);

    const client = createWalletClient({
      account: distributor,
      chain: config.chain,
      transport: http(config.rpcUrl),
    }).extend(eip712WalletActions());

    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    // Get nonce for distributor
    const confirmedNonce = await publicClient.getTransactionCount({
      address: distributor.address,
      blockTag: "pending",
    });

    // Get the gift card price from the store contract
    const giftcardPrice = (await publicClient.readContract({
      address: config.storeContract,
      abi: storeAbi,
      functionName: "giftcardPrice",
    })) as bigint;

    console.log(
      `Gift card price: ${giftcardPrice.toString()} (${
        Number(giftcardPrice) / 1e6
      } USDC)`
    );

    // Prepare paymaster input
    const paymasterInput: Hex = getGeneralPaymasterInput({
      innerInput: "0x",
    });

    console.log(`Paymaster input: ${paymasterInput}`);

    // Call payCatFeeder on the NanoAnimalCare contract to send USDC to the new wallet
    console.log(
      `Sending payCatFeeder transaction with nonce ${confirmedNonce}...`
    );
    const payTx = await client.writeContract({
      address: config.animalCareContract,
      abi: animalCareAbi,
      functionName: "payCatFeeder",
      args: [recipient.address, giftcardPrice, BigInt(0)], // Send gift card amount in USDC, 0 native tokens
      chain: config.chain,
      nonce: confirmedNonce,
      paymaster: PAYMASTER_ADDRESS,
      paymasterInput: paymasterInput,
      // gas: BigInt(500000), // Hardcoded gas limit
      // maxFeePerGas: BigInt(250000000), // 0.25 gwei
      // maxPriorityFeePerGas: BigInt(1000000) // 0.001 gwei
    });

    console.log(`PayCatFeeder transaction sent: ${payTx}`);

    // Now approve the Store contract to spend USDC for the recipient
    // We need to do this from the recipient's wallet
    const recipientClient = createWalletClient({
      account: recipient,
      chain: config.chain,
      transport: http(config.rpcUrl),
    }).extend(eip712WalletActions());

    // Approve the Store contract to spend USDC (max amount so they only approve once)
    const approvalAmount = BigInt(2) ** BigInt(256) - BigInt(1); // Max uint256
    console.log(`Sending approval transaction from recipient wallet...`);
    const approveTx = await recipientClient.writeContract({
      address: config.usdcAddress,
      abi: usdcAbi,
      functionName: "approve",
      args: [config.storeContract, approvalAmount],
      chain: config.chain,
      paymaster: PAYMASTER_ADDRESS,
      paymasterInput: paymasterInput,
    //   gas: BigInt(300000), // Hardcoded gas limit for approval
    //   maxFeePerGas: BigInt(250000000), // 0.25 gwei
    //   maxPriorityFeePerGas: BigInt(1000000), // 0.001 gwei
    });

    console.log(`Approval transaction sent: ${approveTx}`);

    // Store address => index mapping in KV
    await kv.set(
      `wallet_address_to_index:${recipient.address.toLowerCase()}`,
      index
    );

    // Track to Supabase
    try {
      await supabase.from("wallet_events").insert({
        ip_address: ip,
        event_type: "wallet_generated",
        metadata: {
          wallet_address: recipient.address,
          index,
          funded_usdc: "32",
          funded_soph: "0.1",
        },
      });
    } catch (supabaseError) {
      console.log("Supabase tracking error:", supabaseError);
    }

    // Basic analytics tracking in KV
    await kv.sadd("unique_ips", ip);
    await kv.incr("total_wallets_generated");
    await kv.lpush(
      "recent_wallets",
      JSON.stringify({
        address: recipient.address,
        ip,
        timestamp: new Date().toISOString(),
        index,
      })
    );
    await kv.ltrim("recent_wallets", 0, 99); // Keep last 100

    return NextResponse.json(
      {
        message: "Account created and funded",
        address: recipient.address,
        index,
        payTx: payTx.toString(),
        approveTx: approveTx.toString(),
        fundedWith: {
          usdc: "32 USDC (from Jobs contract - for gift card purchase)",
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
