// Environment configuration
// Set NEXT_PUBLIC_NETWORK to "mainnet" for production, defaults to "testnet"
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "testnet") as
  | "testnet"
  | "mainnet";
export const IS_MAINNET = NETWORK === "mainnet";
export const IS_TESTNET = NETWORK === "testnet";

// Gift card configuration for wallet funding
// Frontend should read actual price from contract
export const GIFT_CARD_PRICE = BigInt(31.96e6); // 31.96 USDC on mainnet (with 6 decimals)

export const GIFT_CARD_PRICE_DISPLAY = "31.96"; // For display on mainnet

// Network configurations
export const NETWORKS = {
  testnet: {
    name: "Sophon Testnet",
    chainId: 531050104,
    rpcUrl: "https://rpc.testnet.sophon.xyz",
    explorerUrl: "https://explorer.testnet.sophon.xyz",
    contracts: {
      storeContract:
        "0x86E1D788FFCd8232D85dD7eB02c508e7021EB474" as `0x${string}`, // NanoMusicStore Proxy
      animalCareContract:
        "0xAAfD6b707770BC9F60A773405dE194348B6C4392" as `0x${string}`, // NanoAnimalCare Proxy
      usdcAddress:
        "0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f" as `0x${string}`, // MockUSDC
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
        "0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5" as `0x${string}`, // NanoMusicStore Proxy
      animalCareContract: "" as `0x${string}`, // TODO: Deploy and add mainnet address
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
    contracts.animalCareContract &&
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
