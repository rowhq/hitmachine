'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { config } from '../config';
import storeAbi from '../abi/nanoMusicStore.json';

export default function StoreContract() {
  const { address } = useAccount();
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [marketingPayAddress, setMarketingPayAddress] = useState('');
  const [marketingPayAmount, setMarketingPayAmount] = useState('');

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Read public variables
  const { data: giftcardPrice } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'giftcardPrice',
  });

  const { data: totalPurchases } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'totalPurchases',
  });

  const { data: totalRevenue } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'totalRevenue',
  });

  const { data: usdcAddress } = useReadContract({
    address: config.STORE_CONTRACT,
    abi: storeAbi,
    functionName: 'usdc',
  });

  const handleWithdrawAll = () => {
    const recipient = withdrawAddress || address;
    if (!recipient) return;
    writeContract({
      address: config.STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'withdrawAll',
      args: [recipient as `0x${string}`],
    });
  };

  const handleWithdrawFunds = () => {
    const recipient = withdrawAddress || address;
    if (!recipient || !withdrawAmount) return;
    writeContract({
      address: config.STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'withdrawFunds',
      args: [recipient as `0x${string}`, parseUnits(withdrawAmount, 6)],
    });
  };

  const handlePayMarketing = () => {
    if (!marketingPayAddress || !marketingPayAmount) return;
    writeContract({
      address: config.STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'payMarketing',
      args: [marketingPayAddress as `0x${string}`, parseUnits(marketingPayAmount, 6)],
    });
  };

  const handlePause = () => {
    writeContract({
      address: config.STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'pause',
    });
  };

  const handleUnpause = () => {
    writeContract({
      address: config.STORE_CONTRACT,
      abi: storeAbi,
      functionName: 'unpause',
    });
  };


  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">🎵 Nano Music Store</h2>
      
      <div className="space-y-4">
        {/* Public Variables Display */}
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-medium mb-2">Contract State</h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">Gift Card Price:</span>{' '}
              {giftcardPrice ? `${formatUnits(giftcardPrice as bigint, 6)} USDC` : 'Loading...'}
            </p>
            <p>
              <span className="font-medium">Total Purchases:</span>{' '}
              {totalPurchases ? totalPurchases.toString() : 'Loading...'}
            </p>
            <p>
              <span className="font-medium">Total Revenue:</span>{' '}
              {totalRevenue ? `${formatUnits(totalRevenue as bigint, 6)} USDC` : 'Loading...'}
            </p>
            <p>
              <span className="font-medium">USDC Token:</span>{' '}
              {usdcAddress ? String(usdcAddress) : 'Loading...'}
            </p>
          </div>
        </div>
        {/* Pay Marketing Section */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">💰 Pay Marketing (from marketing budget)</h3>
          <input
            type="text"
            placeholder="Recipient address"
            value={marketingPayAddress}
            onChange={(e) => setMarketingPayAddress(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Amount (USDC)"
            value={marketingPayAmount}
            onChange={(e) => setMarketingPayAmount(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button
            onClick={handlePayMarketing}
            disabled={isPending || isConfirming || !marketingPayAddress || !marketingPayAmount}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Pay Marketing
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Requires MARKETING_ROLE. Pays from the marketing commission budget.
          </p>
        </div>

        {/* Withdraw Section */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Withdraw Funds (Admin)</h3>
          <input
            type="text"
            placeholder={`Recipient address (leave empty for ${address?.slice(0, 6)}...)`}
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Amount (USDC)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleWithdrawAll}
              disabled={isPending || isConfirming}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Withdraw All
            </button>
            <button
              onClick={handleWithdrawFunds}
              disabled={isPending || isConfirming || !withdrawAmount}
              className="flex-1 bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 disabled:opacity-50"
            >
              Withdraw Amount
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Leave recipient empty to send to your connected wallet.
          </p>
        </div>

        {/* Pause Controls */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Contract Controls</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePause}
              disabled={isPending || isConfirming}
              className="flex-1 bg-yellow-600 text-white py-2 px-4 rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              Pause
            </button>
            <button
              onClick={handleUnpause}
              disabled={isPending || isConfirming}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
            >
              Unpause
            </button>
          </div>
        </div>

        {/* Transaction Status */}
        {hash && (
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="text-sm">Transaction Hash: {hash}</p>
            <p className="text-sm">
              Status: {isConfirming ? 'Confirming...' : isSuccess ? 'Confirmed!' : 'Pending...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}