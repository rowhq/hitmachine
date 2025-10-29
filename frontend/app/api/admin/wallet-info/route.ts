import { NextResponse } from "next/server";
import { mnemonicToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits } from "viem";
import { currentChain } from "../../../config/chains";
import { CONTRACTS, CURRENT_NETWORK } from "../../../config/environment";
import usdcAbi from "../../../abi/mockUsdc.json";
import storeAbi from "../../../abi/nanoMusicStore.json";
import bandAbi from "../../../abi/nanoBand.json";

const PROD_WALLET = process.env.PROD_WALLET!;

export async function GET() {
  try {
    // Initialize public client
    const publicClient = createPublicClient({
      chain: currentChain,
      transport: http(CURRENT_NETWORK.rpcUrl),
    });

    // Derive key wallets from mnemonic
    const wallets = [
      // Index 0: Deployer/Nano/Admin
      {
        index: 0,
        account: mnemonicToAccount(PROD_WALLET, { path: `m/44'/60'/0'/0/0` }),
        role: "Deployer/Nano/Admin",
        description: "Main admin wallet - receives from Store, sends to Band",
      },
      // Index 2: Band Admin
      {
        index: 2,
        account: mnemonicToAccount(PROD_WALLET, { path: `m/44'/60'/0'/0/2` }),
        role: "Band Admin",
        description: "Has ADMIN_ROLE on Band contract",
      },
      // Index 3: Store Admin
      {
        index: 3,
        account: mnemonicToAccount(PROD_WALLET, { path: `m/44'/60'/0'/0/3` }),
        role: "Store Admin",
        description: "Has ADMIN_ROLE on Store contract",
      },
      // Index 4: Marketing Budget Admin
      {
        index: 4,
        account: mnemonicToAccount(PROD_WALLET, { path: `m/44'/60'/0'/0/4` }),
        role: "Marketing Budget",
        description: "Has MARKETING_BUDGET_ROLE on Store - executes payMarketing()",
      },
    ];

    // Add distributor wallets (100-102 as examples)
    for (let i = 100; i < 103; i++) {
      wallets.push({
        index: i,
        account: mnemonicToAccount(PROD_WALLET, { path: `m/44'/60'/0'/0/${i}` }),
        role: "Distributor",
        description: `Distributor wallet ${i} - has DISTRIBUTOR_ROLE on Band`,
      });
    }

    // Fetch balances for all wallets
    const walletInfos = await Promise.all(
      wallets.map(async (w) => {
        const balance = await publicClient.readContract({
          address: CONTRACTS.usdcAddress,
          abi: usdcAbi,
          functionName: "balanceOf",
          args: [w.account.address],
        }) as bigint;

        return {
          index: w.index,
          address: w.account.address,
          role: w.role,
          description: w.description,
          balance: formatUnits(balance, 6),
        };
      })
    );

    // Fetch contract balances
    const storeBalance = await publicClient.readContract({
      address: CONTRACTS.storeContract,
      abi: storeAbi,
      functionName: "getContractBalance",
    }) as bigint;

    const bandBalance = await publicClient.readContract({
      address: CONTRACTS.bandContract,
      abi: bandAbi,
      functionName: "getUSDCBalance",
    }) as bigint;

    const nanoWalletBalance = await publicClient.readContract({
      address: CONTRACTS.usdcAddress,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [wallets[0].account.address], // Index 0 = nano
    }) as bigint;

    return NextResponse.json({
      wallets: walletInfos,
      balances: {
        store: formatUnits(storeBalance, 6),
        band: formatUnits(bandBalance, 6),
        nano: formatUnits(nanoWalletBalance, 6),
      },
    });
  } catch (error: any) {
    console.error("[API] Wallet info error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch wallet info",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
