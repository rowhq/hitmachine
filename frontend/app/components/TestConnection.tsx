'use client';

import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { useState, useEffect } from 'react';
import { config } from '../config';

export default function TestConnection() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [balance, setBalance] = useState<string>('0');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function checkBalance() {
      if (address && publicClient) {
        try {
          const bal = await publicClient.getBalance({ address });
          setBalance((Number(bal) / 1e18).toFixed(6));
        } catch (err: any) {
          setError(err.message);
        }
      }
    }
    checkBalance();
  }, [address, publicClient]);

  if (!isConnected) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Wallet not connected. Please connect your wallet.</p>
      </div>
    );
  }

  const expectedChainId = config.CHAIN_ID;
  const isCorrectChain = chainId === expectedChainId;

  return (
    <div className={`border rounded-lg p-4 ${isCorrectChain ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <h3 className="font-bold text-lg mb-2">🔗 Connection Status</h3>
      <div className="space-y-1 text-sm">
        <p><strong>Address:</strong> {address}</p>
        <p><strong>Connector:</strong> {connector?.name}</p>
        <p><strong>Chain ID:</strong> {chainId} {isCorrectChain ? '✅' : `❌ (Expected: ${expectedChainId})`}</p>
        <p><strong>Balance:</strong> {balance} SOPH</p>
        <p><strong>Wallet Client:</strong> {walletClient ? '✅ Available' : '❌ Not available'}</p>
        <p><strong>Public Client:</strong> {publicClient ? '✅ Available' : '❌ Not available'}</p>
      </div>
      
      {!isCorrectChain && (
        <div className="mt-4 p-3 bg-yellow-100 rounded">
          <p className="text-sm font-medium">⚠️ Wrong Network</p>
          <p className="text-xs mt-1">Please switch to Sophon Testnet (Chain ID: {expectedChainId})</p>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 rounded">
          <p className="text-sm text-red-800">Error: {error}</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="font-medium text-sm mb-2">Configuration:</h4>
        <div className="text-xs space-y-1 font-mono">
          <p>Store: {config.STORE_CONTRACT.slice(0, 10)}...{config.STORE_CONTRACT.slice(-8)}</p>
          <p>USDC: {config.USDC_ADDRESS.slice(0, 10)}...{config.USDC_ADDRESS.slice(-8)}</p>
          <p>RPC: {config.RPC_URL}</p>
        </div>
      </div>
    </div>
  );
}