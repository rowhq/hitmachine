'use client';

import { useState, useEffect } from 'react';

interface Analytics {
  blockchain: {
    totalAlbumsSold: string;
    albumPrice: string;
    totalRevenue: string;
    storeBalance: string;
    totalClaimedByJobs: string;
    totalDistributed: string;
    totalUsersPaid: string;
  };
  wallets: {
    totalGenerated: number;
    currentIndex: number;
    uniqueIpsFromGeneration: number;
    averageRevenuePerWallet: string;
    recentWallets: any[];
  };
  traffic: {
    uniqueVisitors: number;
    totalPageViews: number;
    topCountries: { country: string; count: number }[];
    recentVisits: any[];
  };
  contracts: {
    store: string;
    jobs: string;
    usdc: string;
  };
  timestamp: string;
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics-dashboard');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }
      
      setAnalytics(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">Error loading analytics: {error}</p>
        <button 
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Title and Refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">📊 Analytics Dashboard</h2>
        <button 
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90">Total Albums Sold</p>
          <p className="text-2xl font-bold">{analytics.blockchain.totalAlbumsSold}</p>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90">Total Revenue</p>
          <p className="text-2xl font-bold">{analytics.blockchain.totalRevenue}</p>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90">Wallets Generated</p>
          <p className="text-2xl font-bold">{analytics.wallets.totalGenerated}</p>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-4">
          <p className="text-sm opacity-90">Unique IPs</p>
          <p className="text-2xl font-bold">{analytics.wallets.uniqueIpsFromGeneration}</p>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">💰 Financial Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Album Price</p>
            <p className="font-medium">{analytics.blockchain.albumPrice}</p>
          </div>
          <div>
            <p className="text-gray-600">Store Balance</p>
            <p className="font-medium">{analytics.blockchain.storeBalance}</p>
          </div>
          <div>
            <p className="text-gray-600">Jobs Claimed</p>
            <p className="font-medium">{analytics.blockchain.totalClaimedByJobs}</p>
          </div>
          <div>
            <p className="text-gray-600">Total Distributed</p>
            <p className="font-medium">{analytics.blockchain.totalDistributed}</p>
          </div>
          <div>
            <p className="text-gray-600">Users Paid</p>
            <p className="font-medium">{analytics.blockchain.totalUsersPaid}</p>
          </div>
          <div>
            <p className="text-gray-600">Avg Revenue/Wallet</p>
            <p className="font-medium">{analytics.wallets.averageRevenuePerWallet}</p>
          </div>
        </div>
      </div>

      {/* Traffic Analytics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">🌍 Traffic Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-gray-600 text-sm">Unique Visitors</p>
            <p className="text-xl font-bold">{analytics.traffic.uniqueVisitors}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Page Views</p>
            <p className="text-xl font-bold">{analytics.traffic.totalPageViews}</p>
          </div>
        </div>
        
        {analytics.traffic.topCountries.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-sm mb-2">Top Countries</h4>
            <div className="space-y-2">
              {analytics.traffic.topCountries.map((country, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm">{country.country}</span>
                  <span className="text-sm font-medium">{country.count} visits</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Wallets */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">👛 Recent Wallets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">Address</th>
                <th className="text-left py-2">Index</th>
                <th className="text-left py-2">IP</th>
                <th className="text-left py-2">Country</th>
                <th className="text-left py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {analytics.wallets.recentWallets.slice(0, 5).map((wallet, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 font-mono text-xs">
                    {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                  </td>
                  <td className="py-2">{wallet.index}</td>
                  <td className="py-2 text-xs">{wallet.ip}</td>
                  <td className="py-2">{wallet.country || '-'}</td>
                  <td className="py-2 text-xs">
                    {wallet.timestamp ? new Date(wallet.timestamp).toLocaleTimeString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Contract Addresses</h3>
        <div className="text-xs font-mono space-y-1">
          <p>Store: {analytics.contracts.store}</p>
          <p>Jobs: {analytics.contracts.jobs}</p>
          <p>USDC: {analytics.contracts.usdc}</p>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Last updated: {new Date(analytics.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}