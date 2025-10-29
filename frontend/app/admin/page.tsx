"use client";

import { useEffect, useState } from "react";

interface WalletInfo {
  index: number;
  address: string;
  role: string;
  description: string;
  balance?: string;
}

interface ContractBalances {
  store: string;
  band: string;
  nano: string;
}

export default function AdminDashboard() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [balances, setBalances] = useState<ContractBalances | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
    const interval = setInterval(fetchAdminData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchAdminData = async () => {
    try {
      const response = await fetch("/api/admin/wallet-info");
      const data = await response.json();
      setWallets(data.wallets);
      setBalances(data.balances);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Admin Dashboard - Wallet & Role Management
        </h1>

        {/* Contract Balances */}
        {balances && (
          <div className="bg-white rounded-lg shadow mb-8 p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">
              Contract Balances
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-sm text-gray-600">Store Contract</div>
                <div className="text-2xl font-bold text-blue-600">
                  {balances.store} USDC
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-sm text-gray-600">Band Contract</div>
                <div className="text-2xl font-bold text-green-600">
                  {balances.band} USDC
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-sm text-gray-600">Nano Wallet</div>
                <div className="text-2xl font-bold text-purple-600">
                  {balances.nano} USDC
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Wallets */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Key Wallets (From PROD_WALLET Mnemonic)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Index
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wallets.map((wallet) => (
                  <tr
                    key={wallet.index}
                    className={
                      wallet.index === 0
                        ? "bg-purple-50"
                        : wallet.index >= 100 && wallet.index < 200
                        ? "bg-blue-50"
                        : "bg-gray-50"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {wallet.index}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                      {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.address);
                        }}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                        title="Copy full address"
                      >
                        📋
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          wallet.role.includes("Deployer")
                            ? "bg-purple-200 text-purple-800"
                            : wallet.role.includes("Distributor")
                            ? "bg-blue-200 text-blue-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {wallet.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {wallet.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {wallet.balance || "..."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Assignments */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Complete Role Assignments (All from PROD_WALLET Mnemonic)
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">
                Store Contract Roles
              </h3>
              <div className="space-y-3">
                <div className="bg-purple-50 p-3 rounded">
                  <div className="font-semibold text-purple-900">WITHDRAWER_ROLE</div>
                  <div className="text-sm text-gray-700">Index 0 (Deployer/Nano)</div>
                  <div className="text-xs text-gray-600 italic">Can call withdrawFunds()</div>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <div className="font-semibold text-blue-900">MARKETING_BUDGET_ROLE</div>
                  <div className="text-sm text-gray-700">Index 4 (Marketing Admin)</div>
                  <div className="text-xs text-gray-600 italic">Can call payMarketing() - used for Store → Nano transfers</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold text-gray-900">ADMIN_ROLE</div>
                  <div className="text-sm text-gray-700">Index 0, Index 3</div>
                  <div className="text-xs text-gray-600 italic">Contract administration</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold text-gray-900">OPERATOR_ROLE</div>
                  <div className="text-sm text-gray-700">Index 0</div>
                  <div className="text-xs text-gray-600 italic">Operational control</div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 text-lg">
                Band Contract Roles
              </h3>
              <div className="space-y-3">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="font-semibold text-blue-900">DISTRIBUTOR_ROLE</div>
                  <div className="text-sm text-gray-700">Indices 100-199 (100 wallets)</div>
                  <div className="text-xs text-gray-600 italic">Can call paySongSubmitter() to fund user wallets</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold text-gray-900">ADMIN_ROLE</div>
                  <div className="text-sm text-gray-700">Index 0, Index 2</div>
                  <div className="text-xs text-gray-600 italic">Contract administration</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-semibold text-gray-900">OPERATOR_ROLE</div>
                  <div className="text-sm text-gray-700">Index 0</div>
                  <div className="text-xs text-gray-600 italic">Operational control</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Circular Flow Explanation */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Circular Flow of Funds
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="font-semibold text-blue-900 mb-2">
                1. Band → Distributors → Users
              </div>
              <div className="text-sm text-gray-700 pl-4">
                Band Contract → Distributors (indices 100-199) call{" "}
                <code className="bg-white px-1 rounded">paySongSubmitter()</code> → User
                Wallets (indices 200+)
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="font-semibold text-green-900 mb-2">
                2. Users → Store
              </div>
              <div className="text-sm text-gray-700 pl-4">
                User Wallets call{" "}
                <code className="bg-white px-1 rounded">buyGiftcard()</code> → Store
                Contract accumulates funds
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="font-semibold text-purple-900 mb-2">
                3. Store → Nano (when Store &gt; 3,000 USDC)
              </div>
              <div className="text-sm text-gray-700 pl-4">
                Marketing Wallet (index 4) calls{" "}
                <code className="bg-white px-1 rounded">
                  payMarketing(nanoAddress, amount)
                </code>{" "}
                → Nano Wallet (index 0)
              </div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="font-semibold text-indigo-900 mb-2">
                4. Nano → Band (when Band &lt; 10,000 USDC)
              </div>
              <div className="text-sm text-gray-700 pl-4">
                Nano Wallet (index 0) calls{" "}
                <code className="bg-white px-1 rounded">transfer()</code> → Band
                Contract refilled
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="font-semibold text-orange-900 mb-2">
                5. Clawback (when total &lt; 15,000 USDC)
              </div>
              <div className="text-sm text-gray-700 pl-4">
                Idle User Wallets (oldest first) call{" "}
                <code className="bg-white px-1 rounded">revoke()</code> → Funds
                returned to Band Contract
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
