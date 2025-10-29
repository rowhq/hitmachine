const { createPublicClient, http, formatUnits } = require('viem');
const { sophonTestnet } = require('viem/chains');

const BAND = "0x417823822aF4D207c91AE54615453e68aE55320a";
const STORE = "0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674";
const USDC = "0xa38be59C90953E082BF40098356198DD5E8fEfdD";

const usdcAbi = require('./app/abi/mockUsdc.json');
const bandAbi = require('./app/abi/nanoBand.json');
const storeAbi = require('./app/abi/nanoMusicStore.json');

async function trace() {
  console.log('🔍 Tracing fund movements on testnet...\n');

  const client = createPublicClient({
    chain: sophonTestnet,
    transport: http('https://rpc.testnet.sophon.xyz'),
  });

  // Check current balances
  const bandBal = await client.readContract({
    address: BAND,
    abi: bandAbi,
    functionName: 'getUSDCBalance',
  });

  const storeBal = await client.readContract({
    address: STORE,
    abi: storeAbi,
    functionName: 'getContractBalance',
  });

  console.log(`Current balances:`);
  console.log(`  Band: ${formatUnits(bandBal, 6)} USDC`);
  console.log(`  Store: ${formatUnits(storeBal, 6)} USDC`);
  console.log(`  Total: ${formatUnits(bandBal + storeBal, 6)} USDC\n`);

  // The issue: We started with funds in Band, distributed to users,
  // some went to Store, some were clawed back to Band.
  // We need to account for what's still in user wallets that haven't been clawed back yet.

  console.log('💡 Analysis:');
  console.log('  If we started with ~20K USDC in Band:');
  console.log('  - Distributed to users via paySongSubmitter()');
  console.log('  - Some users purchased → funds in Store (351.56 USDC)');
  console.log('  - Some were clawed back → funds back in Band (2,805.52 USDC)');
  console.log('  - Missing: ~17K USDC\n');

  console.log('🤔 The missing funds are likely:');
  console.log('  1. Still in user wallets (not yet clawed back)');
  console.log('  2. In distributor wallets (indices 100-199)');
  console.log('  3. Or we never started with 20K\n');
}

trace().catch(console.error);
