// Import official Sophon chain definitions from viem
// These include the proper zkSync configuration and EIP-712 domain
import { sophon as sophonMainnet, sophonTestnet } from 'viem/chains';

// Import current network configuration
import { CURRENT_NETWORK, IS_MAINNET } from './environment';

// Export the current chain based on environment
export const currentChain = IS_MAINNET ? sophonMainnet : sophonTestnet;

// Re-export for backwards compatibility
export { sophonMainnet, sophonTestnet };