import { CURRENT_NETWORK, CONTRACTS, NETWORK } from './config/environment';

export const config = {
  // Contract addresses from environment config
  STORE_CONTRACT: CONTRACTS.storeContract,
  BAND_CONTRACT: CONTRACTS.bandContract,
  USDC_ADDRESS: CONTRACTS.usdcAddress,
  SOPH_ADDRESS: '0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b' as `0x${string}`,
  PAYMASTER_ADDRESS: CONTRACTS.paymasterAddress,
  JOBS_CONTRACT: (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0xAAfD6b707770BC9F60A773405dE194348B6C4392') as `0x${string}`, // NanoAnimalCare Proxy

  // Chain config from environment
  CHAIN_ID: CURRENT_NETWORK.chainId,
  RPC_URL: CURRENT_NETWORK.rpcUrl,
  NETWORK_NAME: CURRENT_NETWORK.name,
  EXPLORER_URL: CURRENT_NETWORK.explorerUrl,
  NETWORK: NETWORK,
};