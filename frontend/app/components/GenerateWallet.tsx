'use client';

import { useState } from 'react';
import { config } from '../config';

export default function GenerateWallet() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const generateWallet = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${config.API_URL}/api/generate-account`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate wallet');
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
      <h2 className="text-xl font-semibold mb-4">Generate & Fund Wallet</h2>
      
      <button
        onClick={generateWallet}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating...' : 'Generate New Wallet'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-700 font-medium">{result.message}</p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded space-y-2">
            <div>
              <span className="font-medium">Address:</span>
              <code className="ml-2 text-sm bg-gray-200 px-2 py-1 rounded">{result.address}</code>
            </div>
            <div>
              <span className="font-medium">Index:</span>
              <span className="ml-2">{result.index}</span>
            </div>
            <div>
              <span className="font-medium">SOPH Sent:</span>
              <span className="ml-2">{result.sophSent} (${result.priceUsd}/SOPH)</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Transaction Hashes:</h3>
            <div className="text-sm space-y-1">
              <div>
                USDC: <a href={`https://explorer.sophon.xyz/tx/${result.txHashes.usdc}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {result.txHashes.usdc.slice(0, 10)}...
                </a>
              </div>
              <div>
                SOPH: <a href={`https://explorer.sophon.xyz/tx/${result.txHashes.soph}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {result.txHashes.soph.slice(0, 10)}...
                </a>
              </div>
              <div>
                Approval: <a href={`https://explorer.sophon.xyz/tx/${result.txHashes.approveTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {result.txHashes.approveTxHash.slice(0, 10)}...
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}