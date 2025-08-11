'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { defineChain } from 'viem';

// Define Sophon chain
const sophon = defineChain({
  id: 50104,
  name: 'Sophon',
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

const config = getDefaultConfig({
  appName: 'HitMachine Admin',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [sophon],
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