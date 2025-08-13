export const config = {
  // Contract addresses from environment or fallback to deployed testnet addresses
  STORE_CONTRACT: (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x9af4b8A05B001A7dCbfD428C444f73Ff7d10d520') as `0x${string}`,
  JOBS_CONTRACT: (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x935f8Fd143720B337c521354a545a342DF584D18') as `0x${string}`,
  USDC_ADDRESS: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x10Af06Bb43F5ed51A289d22641135c6fC97987Ad') as `0x${string}`,
  SOPH_ADDRESS: (process.env.NEXT_PUBLIC_SOPH_ADDRESS || '0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b') as `0x${string}`,
  
  // Chain config - Using Sophon Testnet
  CHAIN_ID: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 531050104,
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.sophon.xyz',
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'Sophon Testnet',
  EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.testnet.sophon.xyz',
};