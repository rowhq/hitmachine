import { defineChain } from 'viem';

export const sophonTestnet = defineChain({
  id: 531050104,
  name: 'Sophon Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Sophon',
    symbol: 'SOPH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.sophon.xyz'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Sophon Explorer', 
      url: 'https://explorer.testnet.sophon.xyz' 
    },
  },
  testnet: true,
});

// Token addresses on Sophon Testnet
export const USDC_ADDRESS_TESTNET = '0x10Af06Bb43F5ed51A289d22641135c6fC97987Ad'; // Mock USDC on testnet
export const SOPH_ADDRESS_TESTNET = '0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b'; // Mock SOPH on testnet

// Contract addresses on Sophon Testnet
export const STORE_CONTRACT_TESTNET = '0x9af4b8A05B001A7dCbfD428C444f73Ff7d10d520';
export const JOBS_CONTRACT_TESTNET = '0x935f8Fd143720B337c521354a545a342DF584D18';