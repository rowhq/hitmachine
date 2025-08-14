'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { config } from '../config';
import storeAbi from '../abi/nanoMusicStore.json';
import jobsAbi from '../abi/nanoAnimalCare.json';

export default function ContractStats() {
  const [apiStats, setApiStats] = useState<any>(null);

  // Store stats - use getStats which returns all info
  const { data: storeStats } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'getStats',
  }) as { data: [bigint, bigint, bigint, bigint] | undefined };
  // Returns: [giftcardPrice, totalPurchases, totalRevenue, balance]

  // Jobs/AnimalCare stats - only has getUSDCBalance
  const { data: jobsBalance } = useReadContract({
    address: config.JOBS_CONTRACT,
    abi: jobsAbi,
    functionName: 'getUSDCBalance',
  });

  // Fetch API stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/check-balances');
        const data = await response.json();
        setApiStats(data);
      } catch (err) {
        console.error('Failed to fetch API stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Store Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Store Contract</h3>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-500">Balance</p>
            <p className="text-xl font-bold">
              ${storeStats ? formatUnits(storeStats[3], 6) : '0'} USDC
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Purchases</p>
            <p className="text-lg font-semibold">{storeStats ? storeStats[1].toString() : '0'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Gift Card Price</p>
            <p className="text-lg">${storeStats ? formatUnits(storeStats[0], 6) : '0'} USDC</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-lg">${storeStats ? formatUnits(storeStats[2], 6) : '0'} USDC</p>
          </div>
        </div>
      </div>

      {/* Jobs Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Animal Care Contract</h3>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-500">USDC Balance</p>
            <p className="text-xl font-bold">
              ${jobsBalance ? formatUnits(jobsBalance as bigint, 6) : '0'} USDC
            </p>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">System Status</h3>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-500">Auto-Refill Status</p>
            <p className={`text-lg font-semibold ${apiStats?.shouldRefill ? 'text-yellow-600' : 'text-green-600'}`}>
              {apiStats?.shouldRefill ? 'Needs Refill' : 'Healthy'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Last Check</p>
            <p className="text-sm">{apiStats?.timestamp ? new Date(apiStats.timestamp).toLocaleTimeString() : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Refill Threshold</p>
            <p className="text-lg">$1,000 USDC</p>
          </div>
        </div>
      </div>
    </div>
  );
}