'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import NanoMusicStore from './components/NanoMusicStore';
import NanoAnimalCare from './components/NanoAnimalCare';
import GenerateWallet from './components/GenerateWallet';
import ContractStats from './components/ContractStats';
import MintTestUSDC from './components/MintTestUSDC';
import TestConnection from './components/TestConnection';
import PurchaseGiftcard from './components/PurchaseGiftcard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import PasswordProtection from './components/PasswordProtection';
import CheckWallet from './components/CheckWallet';
import { AdminDashboard } from './components/AdminDashboard';
import { RoleGate } from './components/RoleGate';
import { useRoles } from './hooks/useRoles';
import { Role } from './config/roles';

export default function Home() {
  const { isConnected } = useAccount();
  const { isAdmin } = useRoles();

  return (
    <PasswordProtection>
      <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Nano Music & Animal Care Dashboard</h1>
          <ConnectButton />
        </div>

        {/* Admin Dashboard - Only visible to admin users */}
        {isConnected && isAdmin && (
          <AdminDashboard />
        )}

        {/* Connection Test */}
        {isConnected && (
          <div className="mb-8">
            <TestConnection />
          </div>
        )}

        {/* Analytics Dashboard - Only visible to admins */}
        <RoleGate requireAdmin>
          <AnalyticsDashboard />
        </RoleGate>
        
        {/* Stats Overview */}
        <ContractStats />

        {/* Testnet Tools (only shows on testnet) */}
        {isConnected && (
          <div className="mt-8">
            <MintTestUSDC />
          </div>
        )}

        {/* Main Actions - Distributor can generate wallets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <RoleGate allowedRoles={[Role.DISTRIBUTOR, Role.ADMIN]}>
            <GenerateWallet />
          </RoleGate>
          <PurchaseGiftcard />
        </div>

        {/* Debug Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <CheckWallet />
        </div>

        {isConnected ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <RoleGate requireAdmin>
              <NanoAnimalCare />
            </RoleGate>
            <RoleGate allowedRoles={[Role.ADMIN_STORE_ADMIN, Role.ADMIN, Role.MARKETING_BUDGET]}>
              <NanoMusicStore />
            </RoleGate>
          </div>
        ) : (
          <div className="mt-8 p-8 bg-white rounded-lg shadow text-center">
            <p className="text-gray-600">Please connect your wallet to interact with contracts</p>
          </div>
        )}
      </div>
    </main>
    </PasswordProtection>
  );
}
