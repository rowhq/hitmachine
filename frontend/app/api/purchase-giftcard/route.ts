import { NextRequest, NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, parseUnits, type Hex } from "viem";
import { getGeneralPaymasterInput } from 'viem/zksync';
import { sophonTestnet, sophonMainnet } from "../../config/chains";
import { kv } from "@vercel/kv";
import storeAbi from "../../abi/nanoMusicStore.json";
import usdcAbi from "../../abi/mockUsdc.json";
import { corsHeaders } from "../cors";

const MNEMONIC = process.env.MNEMONIC!;
const PAYMASTER_ADDRESS = "0x98546B226dbbA8230cf620635a1e4ab01F6A99B2";

// Determine network from query parameter
function getNetworkConfig(request: NextRequest) {
  const url = new URL(request.url);
  const isTestnet = url.searchParams.has("testnet");

  if (isTestnet) {
    return {
      chain: sophonTestnet,
      storeContract: (process.env.NEXT_PUBLIC_TESTNET_STORE_CONTRACT ||
        "0x86E1D788FFCd8232D85dD7eB02c508e7021EB474") as `0x${string}`, // NanoMusicStore Proxy
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
      usdcAddress: (process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS ||
        process.env.NEXT_PUBLIC_USDC_ADDRESS ||
        "0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F") as `0x${string}`,
      rpcUrl: process.env.MAINNET_RPC_URL || "https://rpc.sophon.xyz",
      network: "mainnet",
    };
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders();

  try {
    // Get network configuration
    const config = getNetworkConfig(request);

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
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400, headers }
      );
    }

    const index = (await kv.get(
      `wallet_address_to_index:${address.toLowerCase()}`
    )) as number;

    console.log(
      `Looking up wallet ${address.toLowerCase()}, found index: ${index}`
    );

    // Validate index range
    if (index === null || index === undefined || isNaN(index) || index < 0) {
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
    const maxIndex = await kv.get(indexKey);
    if (index > Number(maxIndex)) {
      return NextResponse.json(
        { error: `Index out of bounds: max is ${maxIndex}` },
        { status: 400, headers }
      );
    }

    const account = mnemonicToAccount(MNEMONIC, {
      path: `m/44'/60'/0'/0/${index}`,
    });

    console.log(`Derived wallet for index ${index}: ${account.address}`);

    // Verify the derived wallet matches the input address
    if (account.address.toLowerCase() !== address.toLowerCase()) {
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
    });

    // Get the gift card price from the store contract
    const giftcardPrice = (await publicClient.readContract({
      address: config.storeContract,
      abi: storeAbi,
      functionName: "giftcardPrice",
    })) as bigint;

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
        paymaster: PAYMASTER_ADDRESS,
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
        paymaster: PAYMASTER_ADDRESS,
        paymasterInput: paymasterInput
      });

      console.log(`Purchase tx sent: ${purchaseTx}`);
      transactions.push({ type: 'purchase', hash: purchaseTx });

      // Wait for all transactions to be confirmed
      const receipts = await Promise.all(
        transactions.map(tx => 
          publicClient.waitForTransactionReceipt({ hash: tx.hash })
        )
      );

      // Check if all transactions succeeded
      const allSuccessful = receipts.every(r => r.status === 'success');

      return NextResponse.json(
        {
          message: allSuccessful ? "Gift card purchased successfully" : "Transaction failed",
          buyer: account.address,
          index,
          transactions: transactions,
          receipts: receipts.map(r => ({
            blockNumber: r.blockNumber.toString(),
            status: r.status,
            transactionHash: r.transactionHash
          })),
          approvalNeeded: currentAllowance < giftcardPrice,
        },
        { headers }
      );
    } catch (error: any) {
      console.error(
        "Transaction failed:",
        error.message || "Unknown error"
      );

      // Return more detailed error
      return NextResponse.json(
        {
          error: "Transaction failed",
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
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500, headers }
    );
  }
}
