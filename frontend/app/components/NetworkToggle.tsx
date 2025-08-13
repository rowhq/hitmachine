'use client';

import { useState, useEffect } from 'react';
import { NETWORKS, NetworkType, getNetwork } from '../config/networks';
import { useAccount, useNetwork, useSwitchNetwork } from 'wagmi';

export function NetworkToggle() {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>('testnet');
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const { isConnected } = useAccount();

  // Load saved network preference
  useEffect(() => {
    const saved = localStorage.getItem('selectedNetwork') as NetworkType;
    if (saved && (saved === 'testnet' || saved === 'mainnet')) {
      setSelectedNetwork(saved);
    }
  }, []);

  // Save network preference
  const handleNetworkChange = async (network: NetworkType) => {
    setSelectedNetwork(network);
    localStorage.setItem('selectedNetwork', network);
    
    // If wallet is connected, prompt to switch networks
    if (isConnected && switchNetwork) {
      const targetNetwork = getNetwork(network);
      try {
        await switchNetwork(targetNetwork.chainId);
      } catch (error) {
        console.error('Failed to switch network:', error);
      }
    }

    // Reload page to update API endpoints
    window.location.reload();
  };

  // Check for network mismatch
  const networkMismatch = isConnected && chain && chain.id !== getNetwork(selectedNetwork).chainId;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-100 rounded-lg">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Network:</label>
        <select
          value={selectedNetwork}
          onChange={(e) => handleNetworkChange(e.target.value as NetworkType)}
          className="px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="testnet">Testnet</option>
          <option value="mainnet">Mainnet</option>
        </select>
      </div>

      {/* Network Status Indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${selectedNetwork === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="text-xs text-gray-600">
          {NETWORKS[selectedNetwork].name}
        </span>
      </div>

      {/* Network Mismatch Warning */}
      {networkMismatch && (
        <div className="ml-4 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
          ⚠️ Wallet on wrong network
        </div>
      )}
    </div>
  );
}

export function useCurrentNetwork(): NetworkType {
  const [network, setNetwork] = useState<NetworkType>('testnet');
  
  useEffect(() => {
    const saved = localStorage.getItem('selectedNetwork') as NetworkType;
    if (saved && (saved === 'testnet' || saved === 'mainnet')) {
      setNetwork(saved);
    }
  }, []);
  
  return network;
}