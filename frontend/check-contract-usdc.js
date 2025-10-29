const { createPublicClient, http } = require('viem');
const { sophonTestnet } = require('viem/chains');

const storeAbi = require('./app/abi/nanoMusicStore.json');
const bandAbi = require('./app/abi/nanoBand.json');

const client = createPublicClient({
  chain: sophonTestnet,
  transport: http('https://rpc.testnet.sophon.xyz')
});

(async () => {
  console.log('Checking USDC addresses stored in deployed contracts...\n');
  
  const storeContract = '0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674';
  const bandContract = '0x417823822aF4D207c91AE54615453e68aE55320a';
  
  const storeUsdc = await client.readContract({
    address: storeContract,
    abi: storeAbi,
    functionName: 'usdc'
  });
  
  const bandUsdc = await client.readContract({
    address: bandContract,
    abi: bandAbi,
    functionName: 'usdc'
  });
  
  console.log('Store contract USDC address:', storeUsdc);
  console.log('Band contract USDC address:', bandUsdc);
  console.log('\nExpected USDC address: 0xd55D16791377587ac3bF0374094AE71F11360a0B');
  console.log('\n❌ THE DEPLOYED CONTRACTS HAVE THE WRONG USDC ADDRESS!');
  console.log('You need to update the USDC address in the deployed contracts.');
})();
