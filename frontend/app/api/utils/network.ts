import { getNetwork, NetworkType } from '../../config/networks';

export function getNetworkConfig(request: Request) {
  const url = new URL(request.url);
  const network = (url.searchParams.get('network') || 'testnet') as NetworkType;
  
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new Error('Invalid network parameter');
  }
  
  const config = getNetwork(network);
  
  return {
    network,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    contracts: config.contracts,
    paymaster: config.paymaster,
  };
}