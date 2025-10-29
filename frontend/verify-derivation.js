const { mnemonicToAccount } = require('viem/accounts');

const PROD_WALLET = process.env.PROD_WALLET;

if (!PROD_WALLET) {
  console.log('ERROR: PROD_WALLET not set');
  process.exit(1);
}

console.log('\n🔐 Wallet Derivation from Single Mnemonic:');
console.log('=' .repeat(60));

// Nano wallet (index 0) - receives funds from Store, sends to Band
const nanoWallet = mnemonicToAccount(PROD_WALLET, {
  path: `m/44'/60'/0'/0/0`,
});
console.log('\n📍 Nano Wallet (index 0):');
console.log(`  Path: m/44'/60'/0'/0/0`);
console.log(`  Address: ${nanoWallet.address}`);
console.log(`  Role: Receives from Store → Sends to Band`);

// Distributor wallets (indices 100-199) - fund user wallets
console.log('\n💰 Distributor Wallets (indices 100-199):');
for (let i = 100; i < 103; i++) {
  const distributor = mnemonicToAccount(PROD_WALLET, {
    path: `m/44'/60'/0'/0/${i}`,
  });
  console.log(`  Distributor ${i}: ${distributor.address}`);
}
console.log(`  ... (97 more distributors)`);
console.log(`  Role: Fund user wallets with USDC from Band`);

// User wallets (indices 200+) - receive USDC, buy gift cards
console.log('\n👤 User Wallets (indices 200+):');
for (let i = 200; i < 203; i++) {
  const user = mnemonicToAccount(PROD_WALLET, {
    path: `m/44'/60'/0'/0/${i}`,
  });
  console.log(`  User ${i}: ${user.address}`);
}
console.log(`  ... (continues for each generated wallet)`);
console.log(`  Role: Receive USDC → Purchase gift cards → Funds go to Store`);

console.log('\n📊 Fund Flow:');
console.log('  Band (contract)');
console.log('    ↓ paySongSubmitter() via Distributor wallets (100-199)');
console.log('  User Wallets (200+)');
console.log('    ↓ buyGiftcard()');
console.log('  Store (contract)');
console.log('    ↓ withdrawFunds() when balance > 3K');
console.log('  Nano Wallet (index 0)');
console.log('    ↓ transfer() when Band < 10K');
console.log('  Band (contract) ← CYCLE COMPLETE');

console.log('\n✅ All wallets derived from SINGLE mnemonic (PROD_WALLET)');
console.log('=' .repeat(60));
