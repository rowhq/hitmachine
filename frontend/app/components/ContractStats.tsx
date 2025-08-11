'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { config } from '../config';
import storeAbi from '../abi/storeV2.json';
import jobsAbi from '../abi/jobsV2.json';

export default function ContractStats() {
  const [apiStats, setApiStats] = useState<any>(null);

  // Store stats
  const { data: storeBalance } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'getContractBalance',
  });

  const { data: totalSales } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'totalSales',
  });

  const { data: albumPrice } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'albumPrice',
  });

  // Jobs stats
  const { data: jobsBalances } = useReadContract({
    address: config.JOBS_CONTRACT,
    abi: jobsAbi,
    functionName: 'getBalances',
  });

  const { data: jobsStats } = useReadContract({
    address: config.JOBS_CONTRACT,
    abi: jobsAbi,
    functionName: 'getStats',
  });

  // Fetch API stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${config.API_URL}/api/check-balances`);
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
              ${storeBalance ? formatUnits(storeBalance as bigint, 6) : '0'} USDC
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Sales</p>
            <p className="text-lg font-semibold">{totalSales?.toString() || '0'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Album Price</p>
            <p className="text-lg">${albumPrice ? formatUnits(albumPrice as bigint, 6) : '0'} USDC</p>
          </div>
        </div>
      </div>

      {/* Jobs Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Jobs Contract</h3>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-500">USDC Balance</p>
            <p className="text-xl font-bold">
              ${jobsBalances ? formatUnits((jobsBalances as any)[0], 6) : '0'} USDC
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Users Paid</p>
            <p className="text-lg font-semibold">
              {jobsStats ? (jobsStats as any)[0].toString() : '0'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Distributed</p>
            <p className="text-lg">
              ${jobsStats ? formatUnits((jobsStats as any)[1], 6) : '0'} USDC
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