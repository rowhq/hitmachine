import { CURRENT_NETWORK, CONTRACTS } from './config/environment';

export const config = {
  // Contract addresses from environment config
  STORE_CONTRACT: CONTRACTS.storeContract,
  BAND_CONTRACT: CONTRACTS.bandContract,
  USDC_ADDRESS: CONTRACTS.usdcAddress,
  SOPH_ADDRESS: '0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b' as `0x${string}`, // TODO: Add to environment config
  PAYMASTER_ADDRESS: CONTRACTS.paymasterAddress,
  
  // Chain config from environment
  CHAIN_ID: CURRENT_NETWORK.chainId,
  RPC_URL: CURRENT_NETWORK.rpcUrl,
  NETWORK_NAME: CURRENT_NETWORK.name,
  EXPLORER_URL: CURRENT_NETWORK.explorerUrl,
};