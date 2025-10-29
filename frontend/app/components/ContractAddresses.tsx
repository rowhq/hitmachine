'use client';

import { config } from '../config';
import { useState } from 'react';

export default function ContractAddresses() {
  const [showAddresses, setShowAddresses] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Contract Configuration ({config.NETWORK})
        </h3>
        <button
          onClick={() => setShowAddresses(!showAddresses)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
        >
          {showAddresses ? 'Hide Addresses' : 'Show Addresses'}
        </button>
      </div>

      {showAddresses && (
        <div className="space-y-3">
          {/* Network Info */}
          <div className="border-b pb-2">
            <p className="text-sm font-semibold text-gray-600">Network</p>
            <div className="flex justify-between items-center">
              <p className="text-sm">{config.NETWORK_NAME}</p>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Chain ID: {config.CHAIN_ID}
              </span>
            </div>
          </div>

          {/* Store Contract */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-600">Store Contract</p>
              <p className="text-xs font-mono">{config.STORE_CONTRACT}</p>
            </div>
            <button
              onClick={() => copyToClipboard(config.STORE_CONTRACT)}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              Copy
            </button>
          </div>

          {/* Band Contract */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-600">Band Contract</p>
              <p className="text-xs font-mono">{config.BAND_CONTRACT}</p>
            </div>
            <button
              onClick={() => copyToClipboard(config.BAND_CONTRACT)}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              Copy
            </button>
          </div>

          {/* USDC Address */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-600">USDC Token</p>
              <p className="text-xs font-mono">{config.USDC_ADDRESS}</p>
            </div>
            <button
              onClick={() => copyToClipboard(config.USDC_ADDRESS)}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              Copy
            </button>
          </div>

          {/* Paymaster */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-600">Paymaster</p>
              <p className="text-xs font-mono">{config.PAYMASTER_ADDRESS}</p>
            </div>
            <button
              onClick={() => copyToClipboard(config.PAYMASTER_ADDRESS)}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
            >
              Copy
            </button>
          </div>

          {/* Explorer Link */}
          <div className="pt-2 border-t">
            <a
              href={config.EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              View on Block Explorer →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
