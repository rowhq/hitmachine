const { mnemonicToAccount } = require('viem/accounts');

// Derive nano wallet from PROD_WALLET mnemonic
const PROD_WALLET = process.env.PROD_WALLET;

if (!PROD_WALLET) {
  console.log('ERROR: PROD_WALLET env var not set');
  process.exit(1);
}

const nanoWallet = mnemonicToAccount(PROD_WALLET, {
  path: `m/44'/60'/0'/0/0`,
});

console.log('\n📍 Nano Wallet Info:');
console.log(`  Address: ${nanoWallet.address}`);
console.log(`  Path: m/44'/60'/0'/0/0`);
console.log('\nThis is where Store funds should be withdrawn to.');
