'use client';

import { useState } from 'react';
import { config } from '../config';

export default function PurchaseGiftcard() {
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handlePurchase = async () => {
    if (!walletAddress) {
      setError('Please enter a wallet address');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/purchase-giftcard?testnet=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: walletAddress }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase gift card');
      }

      setResult(data);
      setWalletAddress(''); // Clear input on success
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">🎁 Purchase Gift Card</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter the wallet address that will purchase the gift card (must have 32 USDC)
          </p>
        </div>

        <button
          onClick={handlePurchase}
          disabled={isLoading || !walletAddress}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Purchase Gift Card (32 USDC)'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">❌ {error}</p>
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800 font-medium">✅ Gift Card Purchase Transactions Sent!</p>
            <div className="mt-2 text-xs space-y-1">
              <p><strong>Buyer:</strong> {result.buyer}</p>
              {result.index !== undefined && (
                <p><strong>Wallet Index:</strong> {result.index}</p>
              )}
              {result.transactions && result.transactions.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Transactions:</p>
                  {result.transactions.map((tx: any, idx: number) => (
                    <div key={idx} className="mt-1">
                      <span className="capitalize">{tx.type}:</span>{' '}
                      <a 
                        href={`${config.EXPLORER_URL}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {tx.hash?.slice(0, 10)}...{tx.hash?.slice(-8)}
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {/* Fallback for single transaction display */}
              {!result.transactions && result.txHash && (
                <>
                  <p><strong>Transaction:</strong> {result.txHash?.slice(0, 10)}...{result.txHash?.slice(-8)}</p>
                  <a 
                    href={`${config.EXPLORER_URL}/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-block mt-2"
                  >
                    View on Explorer →
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-medium text-sm mb-2">Quick Purchase Options:</h3>
          <div className="space-y-2">
            <button
              onClick={async () => {
                // Generate a new wallet and purchase
                setIsLoading(true);
                setError('');
                try {
                  // First generate a wallet
                  const genResponse = await fetch('/api/generate-account?testnet=true', {
                    method: 'POST',
                  });
                  const genData = await genResponse.json();
                  
                  if (!genResponse.ok) {
                    throw new Error(genData.error || 'Failed to generate wallet');
                  }
                  
                  // Then purchase with that wallet
                  setWalletAddress(genData.address);
                  setTimeout(() => handlePurchase(), 1000); // Wait a bit for chain to sync
                } catch (err: any) {
                  setError(err.message);
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Generate New Wallet & Purchase
            </button>
            
            <p className="text-xs text-gray-500 text-center">
              This will create a new wallet, fund it with USDC and gas, then purchase an album
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>Store Contract: {config.STORE_CONTRACT.slice(0, 10)}...{config.STORE_CONTRACT.slice(-8)}</p>
          <p>USDC Address: {config.USDC_ADDRESS.slice(0, 10)}...{config.USDC_ADDRESS.slice(-8)}</p>
          <p>Network: {config.NETWORK_NAME || 'Sophon Testnet'}</p>
        </div>
      </div>
    </div>
  );
}