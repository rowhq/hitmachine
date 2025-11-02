#!/usr/bin/env node

/**
 * Update Album Price Script
 * Updates the NanoMusicStore price from 31.96 to 7.99 USDC
 *
 * Run from project root:
 * node scripts/update-price.js testnet
 * node scripts/update-price.js mainnet
 */

import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { eip712WalletActions } from 'viem/zksync';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const NEW_PRICE = parseUnits('7.99', 6); // 7.99 USDC with 6 decimals

// Chain definitions
const sophonTestnet = {
  id: 531050104,
  name: 'Sophon Testnet',
  network: 'sophon-testnet',
  nativeCurrency: { name: 'Sophon', symbol: 'SOPH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.sophon.xyz'] },
    public: { http: ['https://rpc.testnet.sophon.xyz'] }
  },
  testnet: true
};

const sophonMainnet = {
  id: 50104,
  name: 'Sophon',
  network: 'sophon',
  nativeCurrency: { name: 'Sophon', symbol: 'SOPH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sophon.xyz'] },
    public: { http: ['https://rpc.sophon.xyz'] }
  },
  testnet: false
};

const NETWORKS = {
  testnet: {
    chain: sophonTestnet,
    storeAddress: '0xe8C61482Ad4412Fc5A0683C8a7E3b751a3e82674' // NanoMusicStore Proxy (testnet)
  },
  mainnet: {
    chain: sophonMainnet,
    storeAddress: '0x963842e934594072B0996366c568e37B1Ad5F3f2' // NanoMusicStore Proxy (mainnet)
  }
};

// NanoMusicStore ABI (only the functions we need)
const STORE_ABI = [
  {
    inputs: [],
    name: 'giftcardPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'newPrice', type: 'uint256' }],
    name: 'updatePrice',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' }
    ],
    name: 'hasRole',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'OPERATOR_ROLE',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  }
];

async function updatePrice(network) {
  const config = NETWORKS[network];
  const chain = config.chain;

  console.log('\n========================================');
  console.log(`${chain.name.toUpperCase()} PRICE UPDATE`);
  console.log('========================================');
  console.log(`Network: ${chain.name}`);
  console.log(`Chain ID: ${chain.id}`);
  console.log(`Store Address: ${config.storeAddress}`);
  console.log('========================================\n');

  // Check for PROD_WALLET mnemonic
  if (!process.env.PROD_WALLET) {
    console.error('❌ Error: PROD_WALLET mnemonic not found in .env');
    process.exit(1);
  }

  try {
    // Derive account from mnemonic (index 0)
    const account = mnemonicToAccount(process.env.PROD_WALLET, { addressIndex: 0 });
    console.log(`Operator Wallet: ${account.address}`);

    // Create clients
    const publicClient = createPublicClient({
      chain,
      transport: http()
    });

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http()
    }).extend(eip712WalletActions());

    // Get wallet balance
    const balance = await publicClient.getBalance({ address: account.address });
    const balanceInEther = Number(balance) / 1e18;
    console.log(`Wallet Balance: ${balanceInEther.toFixed(4)} SOPH\n`);

    if (balance === 0n) {
      console.error('❌ Error: Wallet has no SOPH for gas fees');
      process.exit(1);
    }

    // Get current price
    console.log('Fetching current price...');
    const currentPrice = await publicClient.readContract({
      address: config.storeAddress,
      abi: STORE_ABI,
      functionName: 'giftcardPrice'
    });

    const currentPriceDisplay = Number(currentPrice) / 1e6;
    const newPriceDisplay = Number(NEW_PRICE) / 1e6;

    console.log(`Current Price: ${currentPriceDisplay} USDC (${currentPrice.toString()})`);
    console.log(`New Price: ${newPriceDisplay} USDC (${NEW_PRICE.toString()})\n`);

    // Check if price is already updated
    if (currentPrice === NEW_PRICE) {
      console.log('✅ Price is already set to 7.99 USDC');
      return;
    }

    // Check OPERATOR_ROLE
    const operatorRole = await publicClient.readContract({
      address: config.storeAddress,
      abi: STORE_ABI,
      functionName: 'OPERATOR_ROLE'
    });

    const hasRole = await publicClient.readContract({
      address: config.storeAddress,
      abi: STORE_ABI,
      functionName: 'hasRole',
      args: [operatorRole, account.address]
    });

    if (!hasRole) {
      console.error(`❌ Error: Wallet ${account.address} does not have OPERATOR_ROLE`);
      process.exit(1);
    }

    console.log('✅ Wallet has OPERATOR_ROLE');

    // Confirm for mainnet
    if (network === 'mainnet') {
      console.log('\n⚠️  WARNING: YOU ARE ABOUT TO UPDATE THE PRICE ON MAINNET!');
      console.log(`⚠️  This will change the album price from ${currentPriceDisplay} to ${newPriceDisplay} USDC`);
      console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Update price
    console.log('Sending updatePrice transaction...');
    const hash = await walletClient.writeContract({
      address: config.storeAddress,
      abi: STORE_ABI,
      functionName: 'updatePrice',
      args: [NEW_PRICE]
    });

    console.log(`Transaction sent: ${hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Verify new price
    const newPrice = await publicClient.readContract({
      address: config.storeAddress,
      abi: STORE_ABI,
      functionName: 'giftcardPrice'
    });

    const verifiedPriceDisplay = Number(newPrice) / 1e6;

    console.log('\n========================================');
    console.log('PRICE UPDATE COMPLETE!');
    console.log('========================================');
    console.log(`Old Price: ${currentPriceDisplay} USDC`);
    console.log(`New Price: ${verifiedPriceDisplay} USDC`);
    console.log('========================================\n');

    if (newPrice !== NEW_PRICE) {
      console.error('⚠️  Warning: Price verification failed!');
      process.exit(1);
    }

    console.log('✅ Price verified successfully!');

  } catch (error) {
    console.error('\n❌ Error updating price:');
    console.error(error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const network = args[0];

if (!network || !['testnet', 'mainnet'].includes(network)) {
  console.error('Usage: node update-price.js <testnet|mainnet>');
  process.exit(1);
}

// Run the script
updatePrice(network);
