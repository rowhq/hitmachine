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
      const response = await fetch('/api/generate-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
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
            <p className="text-green-700 font-medium">✅ {result.message}</p>
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
            {result.fundedWith && (
              <div>
                <span className="font-medium">Funded with:</span>
                <span className="ml-2">{result.fundedWith.usdc} + {result.fundedWith.soph}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Transactions:</h3>
            <div className="text-sm space-y-1">
              {result.payTx && (
                <div>
                  <span className="text-gray-600">USDC Payment:</span>{' '}
                  <a href={`https://explorer.testnet.sophon.xyz/tx/${result.payTx}`} 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline">
                    {result.payTx?.slice(0, 10)}...{result.payTx?.slice(-8)}
                  </a>
                </div>
              )}
              {result.approveTx && (
                <div>
                  <span className="text-gray-600">USDC Approval:</span>{' '}
                  <a href={`https://explorer.testnet.sophon.xyz/tx/${result.approveTx}`} 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline">
                    {result.approveTx?.slice(0, 10)}...{result.approveTx?.slice(-8)}
                  </a>
                </div>
              )}
              {/* Fallback for old response format */}
              {!result.payTx && result.txHash && (
                <div>
                  <span className="text-gray-600">Transaction:</span>{' '}
                  <a href={`https://explorer.testnet.sophon.xyz/tx/${result.txHash}`} 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline">
                    {result.txHash?.slice(0, 10)}...{result.txHash?.slice(-8)}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}