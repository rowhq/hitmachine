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

// USDC address on Sophon Testnet (you'll need to update this with the actual testnet address)
export const USDC_ADDRESS_TESTNET = '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F'; // TODO: Update with testnet address
export const SOPH_ADDRESS_TESTNET = '0x0000000000000000000000000000000000000000'; // Native token

// For now, using placeholder addresses until contracts are deployed
export const STORE_CONTRACT_TESTNET = '0x0000000000000000000000000000000000000000';
export const JOBS_CONTRACT_TESTNET = '0x0000000000000000000000000000000000000000';