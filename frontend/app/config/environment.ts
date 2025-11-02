// Environment configuration
// Set NEXT_PUBLIC_NETWORK to "mainnet" for production, defaults to "testnet"
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "testnet") as
  | "testnet"
  | "mainnet";
export const IS_MAINNET = NETWORK === "mainnet";
export const IS_TESTNET = NETWORK === "testnet";

// Gift card price configuration
// NOTE: These are DEPRECATED - use getGiftCardPrice() from utils/price-service.ts instead
// The price is now read dynamically from the NanoMusicStore contract
// These are kept only for backwards compatibility and will be removed in future versions
/** @deprecated Use getGiftCardPrice() from utils/price-service.ts instead */
export const GIFT_CARD_PRICE = BigInt(7.99e6); // Fallback only - actual price read from contract

/** @deprecated Use getGiftCardPriceDisplay() from utils/price-service.ts instead */
export const GIFT_CARD_PRICE_DISPLAY = "7.99"; // Fallback only - actual price read from contract

// Network configurations
export const NETWORKS = {
  testnet: {
    name: "Sophon Testnet",
    chainId: 531050104,
    rpcUrl: "https://rpc.testnet.sophon.xyz",
    explorerUrl: "https://explorer.testnet.sophon.xyz",
    contracts: {
      storeContract:
        "0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674" as `0x${string}`, // NanoMusicStore Proxy
      bandContract:
        "0x417823822aF4D207c91AE54615453e68aE55320a" as `0x${string}`, // NanoBand Proxy
      usdcAddress:
        "0xa38be59C90953E082BF40098356198DD5E8fEfdD" as `0x${string}`, // MockUSDC (address set in deployed contracts)
      paymasterAddress:
        "0x98546B226dbbA8230cf620635a1e4ab01F6A99B2" as `0x${string}`,
    },
  },
  mainnet: {
    name: "Sophon Mainnet",
    chainId: 50104,
    rpcUrl: "https://rpc.sophon.xyz",
    explorerUrl: "https://explorer.sophon.xyz",
    contracts: {
      storeContract:
        "0x963842e934594072B0996366c568e37B1Ad5F3f2" as `0x${string}`, // NanoMusicStore Proxy
      bandContract:
        "0x66abbc0753595C7301BFd209Bca4b953d6fe274f" as `0x${string}`, // NanoBand Proxy
      usdcAddress:
        "0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F" as `0x${string}`, // Mainnet USDC
      paymasterAddress:
        "0x98546B226dbbA8230cf620635a1e4ab01F6A99B2" as `0x${string}`,
    },
  },
} as const;

// Current network configuration
export const CURRENT_NETWORK = NETWORKS[NETWORK];
export const CONTRACTS = CURRENT_NETWORK.contracts;

// Deployment configuration for contracts
export const DEPLOYMENT_CONFIG = {
  initialGiftcardPrice: GIFT_CARD_PRICE,
  paymasterAddress: CONTRACTS.paymasterAddress,
} as const;

// Helper to check if all contracts are deployed
export const areContractsDeployed = () => {
  const contracts = CURRENT_NETWORK.contracts;
  return !!(
    contracts.storeContract &&
    contracts.bandContract &&
    contracts.usdcAddress
  );
};

// Export for backwards compatibility
export default {
  NETWORK,
  IS_MAINNET,
  IS_TESTNET,
  CURRENT_NETWORK,
  CONTRACTS,
  GIFT_CARD_PRICE,
  GIFT_CARD_PRICE_DISPLAY,
};
