'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { config } from '../config';
import jobsAbi from '../abi/jobsV2.json';

export default function JobsContract() {
  const { address } = useAccount();
  const [payAddress, setPayAddress] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');
  const [nativeAmount, setNativeAmount] = useState('');

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleClaimFromStore = () => {
    writeContract({
      address: config.JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'claimFromStore',
    });
  };

  const handlePayUser = () => {
    if (!payAddress || (!usdcAmount && !nativeAmount)) return;
    
    writeContract({
      address: config.JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'payUser',
      args: [
        payAddress as `0x${string}`,
        usdcAmount ? parseUnits(usdcAmount, 6) : BigInt(0),
        nativeAmount ? parseUnits(nativeAmount, 18) : BigInt(0),
      ],
    });
  };

  const handleEmergencyWithdraw = () => {
    const token = prompt('Token address (USDC or native):');
    const to = prompt('Recipient address:');
    const amount = prompt('Amount:');
    
    if (!token || !to || !amount) return;
    
    const decimals = token.toLowerCase() === config.USDC_ADDRESS.toLowerCase() ? 6 : 18;
    
    writeContract({
      address: config.JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'emergencyWithdraw',
      args: [
        token as `0x${string}`,
        to as `0x${string}`,
        parseUnits(amount, decimals),
      ],
    });
  };

  const handlePause = () => {
    writeContract({
      address: config.JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'pause',
    });
  };

  const handleUnpause = () => {
    writeContract({
      address: config.JOBS_CONTRACT,
      abi: jobsAbi,
      functionName: 'unpause',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Jobs Contract</h2>
      
      <div className="space-y-4">
        {/* Claim from Store */}
        <div>
          <button
            onClick={handleClaimFromStore}
            disabled={isPending || isConfirming}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Claim Funds from Store
          </button>
        </div>

        {/* Pay User Section */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Pay User</h3>
          <input
            type="text"
            placeholder="User address"
            value={payAddress}
            onChange={(e) => setPayAddress(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="USDC amount (optional)"
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="text"
            placeholder="Native amount (optional)"
            value={nativeAmount}
            onChange={(e) => setNativeAmount(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button
            onClick={handlePayUser}
            disabled={isPending || isConfirming || !payAddress}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Pay User
          </button>
        </div>

        {/* Emergency & Controls */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Emergency Controls</h3>
          <div className="space-y-2">
            <button
              onClick={handleEmergencyWithdraw}
              disabled={isPending || isConfirming}
              className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 disabled:opacity-50"
            >
              Emergency Withdraw
            </button>
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