'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import mockUsdcAbi from '../abi/mockUsdc.json';

export default function MintTestUSDC() {
  const { address, isConnected } = useAccount();
  const [isMinting, setIsMinting] = useState(false);
  
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
  
  const { data: hash, writeContract } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = async () => {
    if (!isConnected || !usdcAddress || usdcAddress === '0x0000000000000000000000000000000000000000') {
      alert('Please deploy contracts first using setup-testnet.sh');
      return;
    }
    
    setIsMinting(true);
    try {
      writeContract({
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: 'mint',
      });
    } catch (error) {
      console.error('Mint error:', error);
      setIsMinting(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  // Only show on testnet
  const isTestnet = !process.env.NEXT_PUBLIC_NETWORK || process.env.NEXT_PUBLIC_NETWORK !== 'mainnet';
  
  if (!isTestnet) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-2">🧪 Testnet Tools</h3>
      <p className="text-sm text-gray-600 mb-4">
        You&apos;re on Sophon Testnet. Use these tools for testing.
      </p>
      
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Mint Test USDC</h4>
          <p className="text-sm text-gray-600 mb-2">
            Get 1000 test USDC (once per hour)
          </p>
          <button
            onClick={handleMint}
            disabled={isMinting || isConfirming}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isConfirming ? 'Minting...' : isSuccess ? 'Success!' : 'Mint 1000 USDC'}
          </button>
          {hash && (
            <p className="text-xs text-gray-500 mt-2">
              Tx: {hash.slice(0, 10)}...{hash.slice(-8)}
            </p>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          <p>Network: Sophon Testnet (Chain ID: 531050104)</p>
          <p>USDC Contract: {usdcAddress}</p>
        </div>
      </div>
    </div>
  );
}