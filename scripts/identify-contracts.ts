import { createPublicClient, http, formatUnits } from "viem";
import { defineChain } from "viem";

// Define Sophon chains
const sophonTestnet = defineChain({
  id: 531050104,
  name: "Sophon Testnet",
  network: "sophon-testnet",
  nativeCurrency: { name: "SOPH", symbol: "SOPH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.sophon.xyz"] },
    public: { http: ["https://rpc.testnet.sophon.xyz"] },
  },
});

const sophonMainnet = defineChain({
  id: 50104,
  name: "Sophon Mainnet",
  network: "sophon-mainnet",
  nativeCurrency: { name: "SOPH", symbol: "SOPH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sophon.xyz"] },
    public: { http: ["https://rpc.sophon.xyz"] },
  },
});

// Contract ABIs - just the methods we need to identify
const STORE_ABI = [
  {
    inputs: [],
    name: "giftcardPrice",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalPurchases",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const BAND_ABI = [
  {
    inputs: [],
    name: "getUSDCBalance",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface ContractInfo {
  address: string;
  type: "NanoMusicStore" | "NanoBand" | "Unknown";
  details?: any;
}

async function identifyContract(
  address: `0x${string}`,
  client: any
): Promise<ContractInfo> {
  console.log(`\nChecking ${address}...`);

  // Try NanoMusicStore methods
  try {
    const [price, purchases] = await Promise.all([
      client.readContract({
        address,
        abi: STORE_ABI,
        functionName: "giftcardPrice",
      }),
      client.readContract({
        address,
        abi: STORE_ABI,
        functionName: "totalPurchases",
      }),
    ]);
    console.log(`  ✓ NanoMusicStore detected`);
    console.log(`    - Gift card price: ${formatUnits(price, 6)} USDC`);
    console.log(`    - Total purchases: ${purchases.toString()}`);
    return {
      address,
      type: "NanoMusicStore",
      details: {
        giftcardPrice: price.toString(),
        totalPurchases: purchases.toString(),
      },
    };
  } catch (e) {
    // Not a store contract
  }

  // Try NanoBand methods
  try {
    const balance = await client.readContract({
      address,
      abi: BAND_ABI,
      functionName: "getUSDCBalance",
    });
    console.log(`  ✓ NanoBand detected`);
    console.log(`    - USDC balance: ${formatUnits(balance, 6)} USDC`);
    return {
      address,
      type: "NanoBand",
      details: {
        usdcBalance: balance.toString(),
      },
    };
  } catch (e) {
    // Not a band contract
  }

  console.log(`  ✗ Unknown contract type`);
  return { address, type: "Unknown" };
}

async function main() {
  const testnetAddresses: `0x${string}`[] = [
    "0xa38be59C90953E082BF40098356198DD5E8fEfdD",
    "0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674",
    "0x417823822aF4D207c91AE54615453e68aE55320a",
  ];

  const mainnetAddresses: `0x${string}`[] = [
    "0x963842e934594072B0996366c568e37B1Ad5F3f2",
    "0x66abbc0753595C7301BFd209Bca4b953d6fe274f",
  ];

  console.log("=".repeat(60));
  console.log("SOPHON TESTNET (Chain ID: 531050104)");
  console.log("=".repeat(60));

  const testnetClient = createPublicClient({
    chain: sophonTestnet,
    transport: http(),
  });
  const testnetResults: ContractInfo[] = [];

  for (const address of testnetAddresses) {
    const info = await identifyContract(address, testnetClient);
    testnetResults.push(info);
  }

  console.log("\n" + "=".repeat(60));
  console.log("SOPHON MAINNET (Chain ID: 50104)");
  console.log("=".repeat(60));

  const mainnetClient = createPublicClient({
    chain: sophonMainnet,
    transport: http(),
  });
  const mainnetResults: ContractInfo[] = [];

  for (const address of mainnetAddresses) {
    const info = await identifyContract(address, mainnetClient);
    mainnetResults.push(info);
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  console.log("\nTestnet Contracts:");
  testnetResults.forEach((info) => {
    console.log(`  ${info.address}: ${info.type}`);
  });

  console.log("\nMainnet Contracts:");
  mainnetResults.forEach((info) => {
    console.log(`  ${info.address}: ${info.type}`);
  });

  // Generate config snippet
  console.log("\n" + "=".repeat(60));
  console.log("CONFIGURATION SNIPPET");
  console.log("=".repeat(60));

  const testnetStore = testnetResults.find(
    (r) => r.type === "NanoMusicStore"
  )?.address;
  const testnetBand = testnetResults.find(
    (r) => r.type === "NanoBand"
  )?.address;
  const mainnetStore = mainnetResults.find(
    (r) => r.type === "NanoMusicStore"
  )?.address;
  const mainnetBand = mainnetResults.find(
    (r) => r.type === "NanoBand"
  )?.address;

  console.log("\ntestnet: {");
  console.log(`  storeContract: "${testnetStore || "NOT_FOUND"}",`);
  console.log(`  bandContract: "${testnetBand || "NOT_FOUND"}",`);
  console.log("}");

  console.log("\nmainnet: {");
  console.log(`  storeContract: "${mainnetStore || "NOT_FOUND"}",`);
  console.log(`  bandContract: "${mainnetBand || "NOT_FOUND"}",`);
  console.log("}");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
