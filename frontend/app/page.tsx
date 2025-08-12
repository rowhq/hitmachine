'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import StoreContract from './components/StoreContract';
import JobsContract from './components/JobsContract';
import GenerateWallet from './components/GenerateWallet';
import ContractStats from './components/ContractStats';
import MintTestUSDC from './components/MintTestUSDC';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">HitMachine Admin Dashboard</h1>
          <ConnectButton />
        </div>

        {/* Stats Overview */}
        <ContractStats />

        {/* Testnet Tools (only shows on testnet) */}
        {isConnected && (
          <div className="mt-8">
            <MintTestUSDC />
          </div>
        )}

        {/* Generate Wallet Section */}
        <div className="mt-8">
          <GenerateWallet />
        </div>

        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <StoreContract />
            <JobsContract />
          </div>
        ) : (
          <div className="mt-8 p-8 bg-white rounded-lg shadow text-center">
            <p className="text-gray-600">Please connect your wallet to interact with contracts</p>
          </div>
        )}
      </div>
    </main>
  );
}
