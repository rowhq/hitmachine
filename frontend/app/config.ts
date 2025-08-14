export const config = {
  // Contract addresses from latest deployment
  STORE_CONTRACT: (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x86E1D788FFCd8232D85dD7eB02c508e7021EB474') as `0x${string}`, // NanoMusicStore Proxy
  JOBS_CONTRACT: (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0xAAfD6b707770BC9F60A773405dE194348B6C4392') as `0x${string}`, // NanoAnimalCare Proxy
  USDC_ADDRESS: (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f') as `0x${string}`, // MockUSDC
  SOPH_ADDRESS: (process.env.NEXT_PUBLIC_SOPH_ADDRESS || '0x60863D4336d9aF2fB846209F2A8f6137ECA3eF1b') as `0x${string}`,
  PAYMASTER_ADDRESS: (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || '0x98546B226dbbA8230cf620635a1e4ab01F6A99B2') as `0x${string}`,
  
  // Chain config - Using Sophon Testnet
  CHAIN_ID: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 531050104,
  RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.sophon.xyz',
  NETWORK_NAME: process.env.NEXT_PUBLIC_NETWORK_NAME || 'Sophon Testnet',
  EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.testnet.sophon.xyz',
};