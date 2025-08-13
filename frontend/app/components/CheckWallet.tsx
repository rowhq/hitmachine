'use client';

import { useState } from 'react';

export default function CheckWallet() {
  const [address, setAddress] = useState('0xe500904Ca046111D2939143e59BB079Dd84d18AF');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkWallet = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/check-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check wallet');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">🔍 Check Wallet Balance</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Wallet Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="0x..."
          />
        </div>

        <button
          onClick={checkWallet}
          disabled={loading || !address}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Wallet'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium">Native SOPH (for gas)</p>
              <p className="font-mono text-xs">{result.balances.soph.formatted}</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium">USDC Balance</p>
              <p className="font-mono text-xs">{result.balances.usdc.formatted}</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium">USDC Allowance for Store</p>
              <p className="font-mono text-xs">{result.allowance.formatted}</p>
              <p className="text-xs text-gray-500 mt-1">Store: {result.allowance.store}</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium">Contracts</p>
              <p className="text-xs">USDC: {result.contracts.usdc}</p>
              <p className="text-xs">Store: {result.contracts.store}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}