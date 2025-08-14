'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { 
  getDefaultConfig, 
  RainbowKitProvider,
  getDefaultWallets,
  Wallet
} from '@rainbow-me/rainbowkit';
import { 
  rabbyWallet,
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet
} from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// Import both testnet and mainnet configs
import { sophonTestnet, sophonMainnet } from './config/chains';

// Use testnet by default, can switch to mainnet in production
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
const activeChain = isMainnet ? sophonMainnet : sophonTestnet;

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const config = getDefaultConfig({
  appName: 'HitMachine',
  projectId,
  chains: [activeChain],
  wallets: [
    {
      groupName: 'Popular',
      wallets: [
        rabbyWallet,
        metaMaskWallet,
        rainbowWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
  ],
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