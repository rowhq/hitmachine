export const NETWORKS = {
  testnet: {
    name: 'Sophon Testnet',
    chainId: 531050104,
    rpcUrl: 'https://rpc.testnet.sophon.xyz',
    explorer: 'https://explorer.testnet.sophon.xyz',
    contracts: {
      store: process.env.NEXT_PUBLIC_TESTNET_STORE_CONTRACT || '',
      jobs: process.env.NEXT_PUBLIC_TESTNET_JOBS_CONTRACT || '',
      usdc: process.env.NEXT_PUBLIC_TESTNET_USDC_ADDRESS || '',
      soph: process.env.NEXT_PUBLIC_TESTNET_SOPH_ADDRESS || '',
    },
    paymaster: process.env.NEXT_PUBLIC_TESTNET_PAYMASTER || '0x98546B226dbbA8230cf620635a1e4ab01F6A99B2',
  },
  mainnet: {
    name: 'Sophon Mainnet',
    chainId: 50104,
    rpcUrl: 'https://rpc.sophon.xyz',
    explorer: 'https://explorer.sophon.xyz',
    contracts: {
      store: process.env.NEXT_PUBLIC_MAINNET_STORE_CONTRACT || '',
      jobs: process.env.NEXT_PUBLIC_MAINNET_JOBS_CONTRACT || '',
      usdc: process.env.NEXT_PUBLIC_MAINNET_USDC_ADDRESS || '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
      soph: process.env.NEXT_PUBLIC_MAINNET_SOPH_ADDRESS || '',
    },
    paymaster: process.env.NEXT_PUBLIC_MAINNET_PAYMASTER || '',
  },
} as const;

export type NetworkType = keyof typeof NETWORKS;

export function getNetwork(type: NetworkType = 'testnet') {
  return NETWORKS[type];
}

export function getNetworkFromChainId(chainId: number): NetworkType | null {
  if (chainId === NETWORKS.testnet.chainId) return 'testnet';
  if (chainId === NETWORKS.mainnet.chainId) return 'mainnet';
  return null;
}