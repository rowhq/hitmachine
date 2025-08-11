export const config = {
  // Contract addresses - update these after deployment
  STORE_CONTRACT: process.env.NEXT_PUBLIC_STORE_CONTRACT as `0x${string}` || '0x0000000000000000000000000000000000000000',
  JOBS_CONTRACT: process.env.NEXT_PUBLIC_JOBS_CONTRACT as `0x${string}` || '0x0000000000000000000000000000000000000000',
  USDC_ADDRESS: '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F' as `0x${string}`,
  
  // API endpoints
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  
  // Chain config
  CHAIN_ID: 50104,
  RPC_URL: 'https://rpc.sophon.xyz',
};