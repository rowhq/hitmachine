'use client';

import { useState } from 'react';
import { useCurrentNetwork } from './NetworkToggle';
import { getNetwork } from '../config/networks';

export function AlbumPurchase() {
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<string | null>(null);
  const network = useCurrentNetwork();
  const config = getNetwork(network);

  const generateWallet = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/generate-account-v2?network=${network}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.address) {
        setWalletAddress(data.address);
        setPurchaseStatus(`Wallet created! Funded with 0.01 USDC and 2 SOPH on ${config.name}`);
      }
    } catch (error) {
      console.error('Failed to generate wallet:', error);
      setPurchaseStatus('Failed to generate wallet');
    } finally {
      setLoading(false);
    }
  };

  const purchaseAlbum = async () => {
    if (!walletAddress) {
      setPurchaseStatus('Please generate a wallet first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/purchase-album?network=${network}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      });
      const data = await response.json();
      
      if (data.txHash) {
        setPurchaseStatus(`Album purchased successfully! TX: ${data.txHash}`);
      } else {
        setPurchaseStatus(data.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Failed to purchase album:', error);
      setPurchaseStatus('Failed to purchase album');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Album Purchase System</h2>
      
      {/* Network indicator */}
      <div className="mb-4 p-2 bg-gray-100 rounded">
        <span className="text-sm">Network: </span>
        <span className={`font-bold ${network === 'mainnet' ? 'text-green-600' : 'text-yellow-600'}`}>
          {config.name}
        </span>
      </div>

      {/* Step 1: Generate Wallet */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Step 1: Generate Wallet</h3>
        <button
          onClick={generateWallet}
          disabled={loading || !!walletAddress}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {walletAddress ? `Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Generate Wallet'}
        </button>
      </div>

      {/* Step 2: Purchase Album */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Step 2: Purchase Album</h3>
        <button
          onClick={purchaseAlbum}
          disabled={loading || !walletAddress}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Buy Album (0.01 USDC)
        </button>
      </div>

      {/* Status */}
      {purchaseStatus && (
        <div className={`p-3 rounded ${purchaseStatus.includes('success') ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <p className="text-sm">{purchaseStatus}</p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Explorer link */}
      {walletAddress && (
        <div className="mt-4 text-center">
          <a
            href={`${config.explorer}/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-sm"
          >
            View on Explorer →
          </a>
        </div>
      )}
    </div>
  );
}