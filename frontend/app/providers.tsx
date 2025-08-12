'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { defineChain } from 'viem';

// Import testnet config
import { sophonTestnet } from './config/chains';

// Use mainnet for production, testnet for development
const sophonMainnet = defineChain({
  id: 50104,
  name: 'Sophon Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Sophon',
    symbol: 'SOPH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sophon.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.sophon.xyz' },
  },
});

// Use testnet by default, can switch to mainnet in production
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
const activeChain = isMainnet ? sophonMainnet : sophonTestnet;

const config = getDefaultConfig({
  appName: 'HitMachine',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [activeChain],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}